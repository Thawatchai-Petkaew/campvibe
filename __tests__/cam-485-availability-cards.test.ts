/**
 * cam-485-availability-cards.test.ts — CAM-485 (story.md AC-1..4, BR-1..4,
 * EC-1..5): the availability answer's "cards get dropped mid-flight" bug.
 *
 * Root cause (story.md): the engine collector (`collectCardsFromToolData`,
 * lib/ai/openrouter-client.ts) only ever read a tool result's `cards` key —
 * `bulkAvailability` returned its camp cards under `camps` (never `cards`)
 * and `checkAvailability` returned no card data at all, so a real,
 * already-queried card silently never reached the carousel.
 *
 * Coverage matrix:
 *   - AC-1/BR-1 (unit, bulk-availability.ts): top-level `cards[]` = only the
 *     camps with >=1 free cell; `remaining` = the FIRST free cell
 *     (deterministic on a multi-range ask, never the last/an aggregate)
 *   - EC-1 (unit, bulk-availability.ts): no camp free anywhere -> `cards:[]`
 *     (present, never absent, never throws) while `camps[]` (BR-4, untouched)
 *     still lists every full camp
 *   - AC-2/BR-2 (unit, check-availability.ts): the success path (visible camp
 *     + a real getRemainingCapacity result) attaches `cards:[card]`,
 *     `remaining` = the SAME just-computed number (no second capacity calc)
 *   - EC-2 (unit, check-availability.ts): NO_DATA (unpublished / nonexistent
 *     id) -> no `cards` key at all — preserves the no-existence-oracle
 *     contract (CAM-469), never leaks "this id triggered a card lookup"
 *   - EC-3 (unit, check-availability.ts): RANGE_TOO_WIDE -> unchanged
 *     `{ok:false,code}` shape, no `cards`, card fetch never attempted
 *   - edge (unit, check-availability.ts): the card row races away between the
 *     visibility gate and the card fetch -> fails open (numbers still
 *     returned, no `cards` key, never a throw)
 *   - AC-3/EC-4 (integration, openrouter-client.ts via runAssistantTurn): two
 *     different tools in ONE turn (e.g. searchCampsites + bulkAvailability)
 *     return overlapping camp ids -> the engine's accumulated `cards[]` lists
 *     each camp ONCE, first-seen order preserved
 *   - EC-5 (integration): a card with no readable `id` (malformed/foreign
 *     shape) is pushed unconditionally — dedup never drops or throws on it
 *   - BR-4 (regression, both units): `bulkAvailability`'s `camps`+`cells` key
 *     and `checkAvailability`'s capacity-number shape are byte-identical to
 *     pre-CAM-485 on every path that doesn't add `cards` — additive only
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

const mockGetRemainingCapacity = vi.fn();
const mockGetRemainingCapacityForCamps = vi.fn();
vi.mock('@/lib/campsite-availability', async () => {
  const actual = await vi.importActual<typeof import('@/lib/campsite-availability')>(
    '@/lib/campsite-availability'
  );
  return {
    ...actual,
    getRemainingCapacity: (...args: unknown[]) => mockGetRemainingCapacity(...args),
    getRemainingCapacityForCamps: (...args: unknown[]) => mockGetRemainingCapacityForCamps(...args),
  };
});

const mockDispatchTool = vi.fn();
vi.mock('@/lib/ai/tool-registry', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/tool-registry')>('@/lib/ai/tool-registry');
  return {
    ...actual,
    dispatchTool: (...args: unknown[]) => mockDispatchTool(...args),
  };
});

const { executeBulkAvailability, bulkAvailabilityArgsSchema } = await import('@/lib/ai/tools/bulk-availability');
const { executeCheckAvailability, checkAvailabilityArgsSchema } = await import('@/lib/ai/tools/check-availability');
const { AvailabilityRangeTooWideError } = await import('@/lib/campsite-availability');
const { runAssistantTurn } = await import('@/lib/ai/openrouter-client');

// ---------------------------------------------------------------------------
// Shared fixtures / helpers
// ---------------------------------------------------------------------------

/** Matches `aiCampCardSelect`'s shape — same minimal fixture cam-465's own test file uses. */
function candidateRow(id: string) {
  return { id, reviewCount: 0, location: { province: 'Chiang Mai' }, options: [] };
}

function dateRange(offsetDays: number) {
  const start = new Date('2026-09-01T00:00:00.000Z');
  start.setUTCDate(start.getUTCDate() + offsetDays);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const NONEXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

function checkArgs(campSiteId: string) {
  return checkAvailabilityArgsSchema.parse({ campSiteId, startDate: '2026-08-01', endDate: '2026-08-03' });
}

const FAKE_KEY = 'sk-or-test-cam485';

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function assistantMessage(content: string | null, toolCalls?: unknown[]) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: toolCalls } }] };
}

function toolCall(id: string, name = 'searchCampsites') {
  return { id, type: 'function', function: { name, arguments: '{}' } };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

// ---------------------------------------------------------------------------
// AC-1/BR-1/EC-1 — bulkAvailability top-level cards[]
// ---------------------------------------------------------------------------
describe('bulkAvailability — top-level cards[] (CAM-485 BR-1/AC-1)', () => {
  it('[normal] a camp free for the single requested range -> cards[] carries it, remaining = that cell', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({
      c1: { capacity: 10, bookedGuests: 2, heldGuests: 0, remaining: 8, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards).toEqual([expect.objectContaining({ id: 'c1', remaining: 8 })]);
      // BR-4 — `camps` (with `cells`) is untouched, additive only.
      expect(result.camps).toEqual([
        expect.objectContaining({ id: 'c1', cells: [{ status: 'free', remaining: 8 }] }),
      ]);
    }
  });

  it('[normal] a multi-range ask -> cards[] remaining = the FIRST free cell, never the last/an aggregate (BR-1 deterministic)', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps
      .mockResolvedValueOnce({ c1: { capacity: 10, bookedGuests: 10, heldGuests: 0, remaining: 0, blockedByHost: false } }) // range 0: full
      .mockResolvedValueOnce({ c1: { capacity: 10, bookedGuests: 3, heldGuests: 0, remaining: 7, blockedByHost: false } }); // range 1: free

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0), dateRange(7)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cards).toEqual([expect.objectContaining({ id: 'c1', remaining: 7 })]);
  });

  it('[normal] a mix of free and full camps -> cards[] contains ONLY the free ones, camps[] still lists both', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1'), candidateRow('c2')]);
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({
      c1: { capacity: 10, bookedGuests: 0, heldGuests: 0, remaining: 10, blockedByHost: false },
      c2: { capacity: 5, bookedGuests: 5, heldGuests: 0, remaining: 0, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards.map((c) => c.id)).toEqual(['c1']);
      expect(result.camps).toHaveLength(2); // BR-4 — c2 still present in camps[]
    }
  });

  it('[EC-1] no camp free in any requested range -> cards:[] (present, never absent, never throws)', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1'), candidateRow('c2')]);
    mockGetRemainingCapacityForCamps.mockResolvedValue({
      c1: { capacity: 5, bookedGuests: 5, heldGuests: 0, remaining: 0, blockedByHost: false },
      c2: { capacity: 5, bookedGuests: 5, heldGuests: 0, remaining: 0, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards).toEqual([]);
      expect(result.camps).toHaveLength(2); // BR-4 — full-everywhere camps still present
    }
  });

  it('[EC-1] an unknown (unbounded, not blocked) cell is not free -> excluded from cards[]', async () => {
    mockFindMany.mockResolvedValueOnce([candidateRow('c1')]);
    mockGetRemainingCapacityForCamps.mockResolvedValueOnce({
      c1: { capacity: null, bookedGuests: 0, heldGuests: 0, remaining: null, blockedByHost: false },
    });

    const args = bulkAvailabilityArgsSchema.parse({ dates: [dateRange(0)] });
    const result = await executeBulkAvailability(args);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cards).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-2/BR-2/EC-2/EC-3 — checkAvailability cards on the success path only
// ---------------------------------------------------------------------------
describe('checkAvailability — cards on the success path only (CAM-485 BR-2/AC-2)', () => {
  it('[normal] a visible camp with a real result -> cards:[card], remaining = the SAME computed result (AC-2)', async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: VALID_UUID }) // visibility gate (BR-1/BR-2, select:{id:true})
      .mockResolvedValueOnce(candidateRow(VALID_UUID)); // BR-2's own card fetch (aiCampCardSelect)
    mockGetRemainingCapacity.mockResolvedValueOnce({
      capacity: 20,
      bookedGuests: 5,
      heldGuests: 2,
      remaining: 13,
      blockedByHost: false,
    });

    const result = await executeCheckAvailability(checkArgs(VALID_UUID));

    expect(result.ok).toBe(true);
    if (result.ok) {
      // BR-4 — capacity numbers unchanged, byte-identical to the pre-CAM-485 shape.
      expect(result).toMatchObject({
        capacity: 20,
        bookedGuests: 5,
        heldGuests: 2,
        remaining: 13,
        blockedByHost: false,
      });
      expect(result.cards).toEqual([expect.objectContaining({ id: VALID_UUID, remaining: 13 })]);
    }
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    // the visibility gate itself is UNCHANGED — still select:{id:true}, never widened
    // (a gated id must never leak more just because the card fetch exists now).
    expect(mockFindFirst).toHaveBeenNthCalledWith(1, {
      where: { id: VALID_UUID, isActive: true, isPublished: true, deletedAt: null },
      select: { id: true },
    });
    expect(mockGetRemainingCapacity).toHaveBeenCalledOnce();
  });

  it('[EC-2] an unpublished campSiteId -> NO cards key at all, no existence oracle', async () => {
    mockFindFirst.mockResolvedValueOnce(null); // gate fails -> early return, card fetch never attempted
    const result = await executeCheckAvailability(checkArgs(VALID_UUID));

    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty('cards');
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockGetRemainingCapacity).not.toHaveBeenCalled();
  });

  it('[EC-2] a syntactically-valid but nonexistent campSiteId -> the SAME no-cards shape (no oracle)', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const result = await executeCheckAvailability(checkArgs(NONEXISTENT_UUID));

    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty('cards');
  });

  it('[EC-3] RANGE_TOO_WIDE -> unchanged {ok:false,code} shape, no cards, card fetch never attempted', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: VALID_UUID }); // gate passes
    mockGetRemainingCapacity.mockRejectedValueOnce(new AvailabilityRangeTooWideError(400));

    const result = await executeCheckAvailability(checkArgs(VALID_UUID));

    expect(result).toEqual({ ok: false, code: 'RANGE_TOO_WIDE' });
    expect(mockFindFirst).toHaveBeenCalledTimes(1); // the card-fetch findFirst is never reached
  });

  it('[edge] the card row races away between the gate and the card fetch -> fails open: numbers returned, no cards key, no throw', async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: VALID_UUID }) // gate passes
      .mockResolvedValueOnce(null); // card fetch loses the race (e.g. deleted in-between)
    mockGetRemainingCapacity.mockResolvedValueOnce({
      capacity: 10,
      bookedGuests: 0,
      heldGuests: 0,
      remaining: 10,
      blockedByHost: false,
    });

    const result = await executeCheckAvailability(checkArgs(VALID_UUID));

    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty('cards');
    if (result.ok) expect(result.remaining).toBe(10); // the real numbers are unaffected
  });
});

// ---------------------------------------------------------------------------
// AC-3/EC-4/EC-5 — engine dedup (collectCardsFromToolData, shared by every
// tool-call path via executeToolCalls)
// ---------------------------------------------------------------------------
describe('engine — collectCardsFromToolData dedup by id (CAM-485 BR-3/AC-3/EC-4/EC-5)', () => {
  it('[AC-3/EC-4] two different tools in one turn return overlapping camp ids -> each camp appears ONCE, first-seen order kept', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1', 'searchCampsites')])))
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_2', 'bulkAvailability')])))
      .mockResolvedValueOnce(res(assistantMessage('เจอลานที่ว่างให้แล้วค่ะ')));
    vi.stubGlobal('fetch', mockFetch);

    mockDispatchTool
      .mockResolvedValueOnce({ ok: true, data: { cards: [{ id: 'a' }, { id: 'b' }] } }) // search -> A, B
      .mockResolvedValueOnce({ ok: true, data: { cards: [{ id: 'b' }, { id: 'c' }] } }); // bulk -> B (dup), C

    const result = await runAssistantTurn('เสาร์หน้ามีลานไหนว่าง');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // B kept ONCE — never A,B,B,C — in first-seen order (A,B,C).
      expect(result.cards).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    }
  });

  it('[EC-5] a card with no readable id is pushed unconditionally — never dropped, never thrown', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1', 'searchCampsites')])))
      .mockResolvedValueOnce(res(assistantMessage('พบแคมป์ครับ')));
    vi.stubGlobal('fetch', mockFetch);

    mockDispatchTool.mockResolvedValueOnce({
      ok: true,
      // a duplicate 'a' (same tool result) alongside a card with NO `id` property at all.
      data: { cards: [{ id: 'a' }, { name: 'ผิดรูป ไม่มี id' }, { id: 'a' }] },
    });

    const result = await runAssistantTurn('หาแคมป์ในเชียงใหม่');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards).toEqual([{ id: 'a' }, { name: 'ผิดรูป ไม่มี id' }]);
    }
  });

  it('[null/empty] no duplicate ids across the turn -> every card passes through unchanged (regression, non-dedup path)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(res(assistantMessage(null, [toolCall('call_1', 'searchCampsites')])))
      .mockResolvedValueOnce(res(assistantMessage('พบแคมป์ 2 แห่งครับ')));
    vi.stubGlobal('fetch', mockFetch);

    mockDispatchTool.mockResolvedValueOnce({ ok: true, data: { cards: [{ id: 'c1' }, { id: 'c2' }] } });

    const result = await runAssistantTurn('หาแคมป์');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cards).toEqual([{ id: 'c1' }, { id: 'c2' }]);
  });
});
