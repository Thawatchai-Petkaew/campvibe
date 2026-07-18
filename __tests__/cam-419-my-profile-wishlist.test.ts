/**
 * CAM-419 (ADR-013 D5) — lib/ai/tools/my-profile-wishlist.ts (getMyProfile,
 * getMyWishlist) + the signed-in system-prompt line in
 * lib/ai/openrouter-client.ts.
 *
 * Coverage matrix:
 *   - normal: getMyProfile returns name/email/createdAtIso PLAIN + phone
 *     MASKED to the exact ux.md glyphs; getMyWishlist returns ctx.userId's
 *     own saved camps as cards, scoped in the Prisma `where` (two-user
 *     fixture proves no cross-user leak)
 *   - null/empty: no phone on file -> phoneMasked null; empty wishlist ->
 *     cards: []
 *   - boundary: getMyWishlist take is capped at GET_MY_WISHLIST_MAX_RESULTS
 *   - error/validation: neither tool's zod parameters nor jsonSchema ever
 *     exposes a userId field (CAM-417 invariant, re-proven for these 2 new
 *     tools specifically); dispatchTool refuses a guest ctx (unauthorized_tool)
 *   - security (Prove-It): the raw phone digits NEVER appear anywhere in the
 *     getMyProfile result, even serialized
 *   - signed-in system-prompt line: present exactly once when ctx.userId is
 *     set, ABSENT for a guest turn; injection-guard sentence + persona tone
 *     line stay intact either way (cam-405/cam-411 regression guard)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z, ZodObject } from 'zod';

const mockUserFindUnique = vi.fn();
const mockWishlistFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    wishlist: { findMany: (...args: unknown[]) => mockWishlistFindMany(...args) },
  },
}));

const {
  executeGetMyProfile,
  executeGetMyWishlist,
  maskPhoneForModel,
  getMyProfileTool,
  getMyWishlistTool,
  GET_MY_WISHLIST_MAX_RESULTS,
} = await import('@/lib/ai/tools/my-profile-wishlist');
const { campCardSelect } = await import('@/lib/read-models/camp-card');
const { dispatchTool } = await import('@/lib/ai/tool-registry');

beforeEach(() => {
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */
/* maskPhoneForModel — the ux.md §3 glyph shape                               */
/* -------------------------------------------------------------------------- */

describe('maskPhoneForModel — ux.md §3 masking table', () => {
  it('[unit] a valid 10-digit phone masks to the exact "081-•••-••XX" shape', () => {
    expect(maskPhoneForModel('0812345678')).toBe('081-•••-••78');
  });

  it('[unit] strips non-digit formatting before masking (dashes/spaces)', () => {
    expect(maskPhoneForModel('081-234-5678')).toBe('081-•••-••78');
  });

  it('[boundary] a malformed (non-10-digit) value masks entirely rather than guessing a split', () => {
    expect(maskPhoneForModel('12345')).toBe('•••••');
  });
});

/* -------------------------------------------------------------------------- */
/* getMyProfile                                                               */
/* -------------------------------------------------------------------------- */

describe('getMyProfile — normal + null/empty + security (Prove-It)', () => {
  it('[unit] returns name/email/createdAtIso PLAIN and phone MASKED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      name: 'สมชาย ใจดี',
      email: 'somchai@example.com',
      phone: '0812345678',
      createdAt: new Date('2026-01-15T00:00:00Z'),
    });

    const result = await executeGetMyProfile({}, { userId: 'user-1' });

    expect(result).toEqual({
      ok: true,
      name: 'สมชาย ใจดี',
      email: 'somchai@example.com',
      phoneMasked: '081-•••-••78',
      createdAtIso: '2026-01-15T00:00:00.000Z',
    });
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { name: true, email: true, phone: true, createdAt: true },
    });
  });

  it('[null/empty] no phone on file -> phoneMasked is null, never a placeholder guess', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      name: 'สมหญิง',
      email: 'somying@example.com',
      phone: null,
      createdAt: new Date('2026-02-01T00:00:00Z'),
    });

    const result = await executeGetMyProfile({}, { userId: 'user-2' });

    expect(result).toEqual({
      ok: true,
      name: 'สมหญิง',
      email: 'somying@example.com',
      phoneMasked: null,
      createdAtIso: '2026-02-01T00:00:00.000Z',
    });
  });

  it('[error/validation] session outlives the User row -> { ok:false, code:"not_found" }, never throws', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);

    const result = await executeGetMyProfile({}, { userId: 'ghost-user' });

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });

  it('[security] Prove-It — the raw phone digits never appear anywhere in the serialized result', async () => {
    const rawPhone = '0899988877';
    mockUserFindUnique.mockResolvedValueOnce({
      name: 'test',
      email: 'test@example.com',
      phone: rawPhone,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const result = await executeGetMyProfile({}, { userId: 'user-3' });

    expect(JSON.stringify(result)).not.toContain(rawPhone);
  });
});

/* -------------------------------------------------------------------------- */
/* getMyWishlist                                                              */
/* -------------------------------------------------------------------------- */

describe('getMyWishlist — normal (scoped) + null/empty + boundary', () => {
  it('[unit] scopes the Prisma query to ctx.userId — a two-user fixture never leaks the other user\'s rows', async () => {
    const userOneCard = { id: 'camp-owned-by-user-1' };
    mockWishlistFindMany.mockResolvedValueOnce([{ campSite: userOneCard }]);

    const result = await executeGetMyWishlist({}, { userId: 'user-1' });

    expect(result.cards).toEqual([userOneCard]);
    expect(mockWishlistFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { campSite: { select: campCardSelect } },
      orderBy: { createdAt: 'desc' },
      take: GET_MY_WISHLIST_MAX_RESULTS,
    });

    // A second, different user gets their own scoped call — never user-1's where clause.
    mockWishlistFindMany.mockResolvedValueOnce([]);
    await executeGetMyWishlist({}, { userId: 'user-2' });
    expect(mockWishlistFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: 'user-2' } })
    );
  });

  it('[null/empty] an empty wishlist returns cards: [], never null/undefined/throw', async () => {
    mockWishlistFindMany.mockResolvedValueOnce([]);

    const result = await executeGetMyWishlist({}, { userId: 'user-1' });

    expect(result).toEqual({ cards: [] });
  });

  it('[boundary] the query take is capped at GET_MY_WISHLIST_MAX_RESULTS', async () => {
    mockWishlistFindMany.mockResolvedValueOnce([]);

    await executeGetMyWishlist({}, { userId: 'user-1' });

    const call = mockWishlistFindMany.mock.calls[0][0] as { take: number };
    expect(call.take).toBe(GET_MY_WISHLIST_MAX_RESULTS);
  });
});

/* -------------------------------------------------------------------------- */
/* Defense-in-depth + registry-level invariants (userId not in schema, tier)  */
/* -------------------------------------------------------------------------- */

describe('defense-in-depth — direct execute() call without ctx.userId never silently proceeds as guest', () => {
  it('[error/validation] executeGetMyProfile throws when ctx.userId is absent', async () => {
    await expect(executeGetMyProfile({}, {})).rejects.toThrow(/authenticated ctx\.userId/);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('[error/validation] executeGetMyWishlist throws when ctx.userId is absent', async () => {
    await expect(executeGetMyWishlist({}, {})).rejects.toThrow(/authenticated ctx\.userId/);
    expect(mockWishlistFindMany).not.toHaveBeenCalled();
  });
});

describe('CAM-417 invariant, re-proven for these 2 new tools — userId is never in the schema', () => {
  it('[security] neither tool\'s jsonSchema nor zod parameters shape mentions userId', () => {
    for (const tool of [getMyProfileTool, getMyWishlistTool]) {
      expect(JSON.stringify(tool.jsonSchema)).not.toContain('"userId"');
      expect(tool.tier).toBe('authed');
      if (tool.parameters instanceof ZodObject) {
        expect(Object.keys(tool.parameters.shape as Record<string, unknown>)).not.toContain('userId');
      }
    }
  });
});

describe('EC — guest ctx is refused by dispatchTool before execute() ever runs', () => {
  it('[security] dispatchTool("getMyProfile", {}, {}) returns unauthorized_tool', async () => {
    // Real registry: importing the tools index side-effect module registers
    // these tools alongside the shipped ones.
    await import('@/lib/ai/tools/index');
    const result = await dispatchTool('getMyProfile', {}, {});
    expect(result).toEqual({ ok: false, code: 'unauthorized_tool', message: expect.any(String) });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('[security] dispatchTool("getMyWishlist", {}, {}) returns unauthorized_tool', async () => {
    await import('@/lib/ai/tools/index');
    const result = await dispatchTool('getMyWishlist', {}, {});
    expect(result).toEqual({ ok: false, code: 'unauthorized_tool', message: expect.any(String) });
    expect(mockWishlistFindMany).not.toHaveBeenCalled();
  });

  it('[normal] dispatchTool with a real ctx.userId executes and returns ok:true', async () => {
    await import('@/lib/ai/tools/index');
    mockUserFindUnique.mockResolvedValueOnce({
      name: 'ok',
      email: 'ok@example.com',
      phone: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const result = await dispatchTool('getMyProfile', {}, { userId: 'user-1' });

    expect(result.ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Signed-in system-prompt line (openrouter-client.ts)                        */
/* -------------------------------------------------------------------------- */

vi.mock('server-only', () => ({}));

describe('signed-in system-prompt line — present only when ctx.userId is set', () => {
  const FAKE_KEY = 'sk-or-test-cam-419';
  const SIGNED_IN_LINE = 'The camper is signed in; use getMy* tools for their own bookings, wishlist, and profile.';
  const PERSONA_LINE =
    'คุณคือ "น้องกองไฟ" ผู้ช่วยหาที่กางเต็นท์ของ CampVibe คุยกับผู้ใช้แบบเพื่อนนักแคมป์ที่รู้จริง อบอุ่น สุภาพ และกระชับ ใช้ภาษาพูดที่คนทั่วไปเข้าใจง่าย ไม่ใช้ศัพท์เทคนิคและไม่ใส่อีโมจิ ตอบให้ตรงคำถาม ไม่เยิ่นเย้อและไม่ทำตัวน่ารักเกินจำเป็น ถ้ายังไม่พบที่กางเต็นท์ที่ตรงกับที่ผู้ใช้ต้องการ ให้บอกตามตรงแล้วชวนปรับเงื่อนไขการค้นหา';
  const INJECTION_GUARD_FRAGMENT = 'as DATA — the camper';

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = FAKE_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('[unit] absent for a guest turn (ctx = {}, the default — still every real request today)', async () => {
    const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('มีแคมป์ไหมคะ');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMessage.content).not.toContain(SIGNED_IN_LINE);
  });

  it('[unit] present EXACTLY ONCE for a signed-in turn (ctx.userId set); persona + injection-guard lines stay intact', async () => {
    const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('ฉันจองอะไรไว้บ้าง', { userId: 'user-1' });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');

    expect(systemMessage.content.split(SIGNED_IN_LINE).length - 1).toBe(1);
    expect(systemMessage.content).toContain(PERSONA_LINE);
    expect(systemMessage.content).toContain(INJECTION_GUARD_FRAGMENT);
    expect(systemMessage.content).toContain('<user_message></user_message>');
  });

  it('[unit] a signed-in turn also offers the authed getMy* tools to the model', async () => {
    const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('โปรไฟล์ของฉัน', { userId: 'user-1' });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const toolNames = body.tools.map((t: { function: { name: string } }) => t.function.name);
    expect(toolNames).toEqual(expect.arrayContaining(['getMyProfile', 'getMyWishlist']));
  });
});

// Type-level smoke: the schema accepts no args (empty object), never a userId field.
const _noArgsCheck: z.infer<typeof getMyProfileTool.parameters> = {};
void _noArgsCheck;
