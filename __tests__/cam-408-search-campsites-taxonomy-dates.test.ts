/**
 * CAM-408 AC-1/AC-2/AC-3, BR-1/BR-2/BR-3/BR-4 — real-smoke defect fix.
 *
 * `หาที่แคมป์ติดน้ำ หมาเข้าได้` and `ลานกางเต้นวิวภูเขา ว่างเสาร์อาทิตย์หน้า`
 * both returned zero results though matching camps exist. Root cause 1:
 * `searchCampsites` exposed no terrain/access/activities/facilities args
 * (lib/ai/tools/search-campsites.ts). Root cause 2: the system prompt carried
 * no reference date, so a relative Thai date could not resolve to an ISO
 * date for `checkAvailability` (lib/ai/openrouter-client.ts).
 *
 * Coverage matrix:
 *   - normal: valid terrain/access/activities/facilities/keyword codes parse
 *     and pass through to buildCampSiteWhere unchanged (AC-1, BR-1, BR-2)
 *   - normal: jsonSchema advertises the real codes + a Thai gloss for terrain
 *   - error/validation: an unrecognized code per group fails zod (invalid_args
 *     before Prisma runs) (AC-3, BR-3, EC-3)
 *   - normal: the system prompt carries today's Asia/Bangkok date + the
 *     relative-date/keyword guidance sentences, computed fresh (not cached)
 *     from an injected clock — format asserted, not a real-clock value (AC-2, BR-4)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { executeSearchCampsites, searchCampsitesArgsSchema, searchCampsitesTool } = await import(
  '@/lib/ai/tools/search-campsites'
);
// runAssistantTurn's module side-effect-imports '@/lib/ai/tools/index', which registers the
// REAL searchCampsites tool into the tool-registry — importing it here (before dispatchTool
// is used below) means the QA-added real-wiring test exercises the actual registered tool,
// not a fake stand-in.
const { runAssistantTurn, formatTodayContextLine } = await import('@/lib/ai/openrouter-client');
const { dispatchTool } = await import('@/lib/ai/tool-registry');

beforeEach(() => {
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */
/* AC-1/BR-1/BR-2 — valid taxonomy codes pass through unchanged               */
/* -------------------------------------------------------------------------- */

describe('searchCampsites — taxonomy args (AC-1, normal)', () => {
  it('[unit] terrain:"RIVE" (water-adjacent) + petFriendly reaches buildCampSiteWhere as an AND option filter', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'c1' }]);

    const args = searchCampsitesArgsSchema.parse({ terrain: 'RIVE', petFriendly: true });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(call.where.AND).toContainEqual({ options: { some: { code: 'RIVE' } } });
    expect(call.where.AND).toContainEqual({ petFriendly: true });
  });

  it('[unit] terrain:"MTNS" (mountain view) + type:"CAGD" reaches buildCampSiteWhere unchanged', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ terrain: 'MTNS', type: 'CAGD' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as {
      where: { campSiteType?: string; AND?: unknown[] };
    };
    expect(call.where.campSiteType).toBe('CAGD');
    expect(call.where.AND).toContainEqual({ options: { some: { code: 'MTNS' } } });
  });

  it('[unit] access/activities/facilities each reach buildCampSiteWhere as their own AND option filter', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ access: 'DRIV', activities: 'SWIM', facilities: 'WIFI' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    expect(call.where.AND).toContainEqual({ options: { some: { code: 'DRIV' } } });
    expect(call.where.AND).toContainEqual({ options: { some: { code: 'SWIM' } } });
    expect(call.where.AND).toContainEqual({ options: { some: { code: 'WIFI' } } });
  });

  it('[unit] keyword passes through to buildCampSiteWhere\'s existing name/description OR match', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ keyword: 'ม่อนแจ่ม' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { OR?: unknown[] } };
    expect(Array.isArray(call.where.OR)).toBe(true);
    expect(call.where.OR).toContainEqual({ nameTh: { contains: 'ม่อนแจ่ม' } });
  });

  it('[unit] no taxonomy args supplied leaves the where.AND clause empty of option filters', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const args = searchCampsitesArgsSchema.parse({ province: 'ระยอง' });
    await executeSearchCampsites(args);

    const call = mockFindMany.mock.calls[0][0] as { where: { AND?: unknown[] } };
    const andEntries = call.where.AND ?? [];
    expect(andEntries.some((e) => JSON.stringify(e).includes('options'))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* jsonSchema — real codes + Thai gloss advertised to the model               */
/* -------------------------------------------------------------------------- */

describe('searchCampsitesTool — jsonSchema advertises real MasterData codes (AC-1)', () => {
  it('[unit] terrain enum matches the real seeded MasterData codes with a Thai gloss in the description', () => {
    const schema = searchCampsitesTool.jsonSchema as {
      properties: { terrain: { enum: readonly string[]; description: string } };
    };
    // CAM-513 (S1) — bumped from 4 to the full 12 real seeded Terrain codes.
    expect(schema.properties.terrain.enum).toEqual(
      expect.arrayContaining([
        'BEAC', 'FORE', 'RIVE', 'MTNS',
        'SEA', 'COAS', 'LAKE', 'WATF', 'SWMH', 'FILD', 'CAVE', 'FARM',
      ])
    );
    expect(schema.properties.terrain.enum).toHaveLength(12);
    expect(schema.properties.terrain.description).toContain('แม่น้ำ');
    expect(schema.properties.terrain.description).toContain('ภูเขา');
    expect(schema.properties.terrain.description).toContain('ชายหาด');
    expect(schema.properties.terrain.description).toContain('ป่า');
    // CAM-513 (S1) — new codes' Thai trigger words taught in the description.
    expect(schema.properties.terrain.description).toContain('ทะเล');
    expect(schema.properties.terrain.description).toContain('น้ำตก');
    expect(schema.properties.terrain.description).toContain('แอ่งเล่นน้ำ');
    expect(schema.properties.terrain.description).toContain('ทุ่ง');
    expect(schema.properties.terrain.description).toContain('ถ้ำ');
    expect(schema.properties.terrain.description).toContain('ไร่');
    expect(schema.properties.terrain.description).toContain('ริมชายฝั่ง');
    expect(schema.properties.terrain.description).toContain('ทะเลสาบ');
  });

  it('[unit] access/activities/facilities enums are present with the real seeded codes', () => {
    const schema = searchCampsitesTool.jsonSchema as {
      properties: {
        access: { enum: readonly string[] };
        activities: { enum: readonly string[] };
        facilities: { enum: readonly string[] };
      };
    };
    expect(schema.properties.access.enum).toEqual(expect.arrayContaining(['DRIV', 'WALK', 'HIKE', 'BAOT']));
    expect(schema.properties.activities.enum).toEqual(expect.arrayContaining(['SWIM', 'FISH', 'CLIM']));
    expect(schema.properties.facilities.enum).toEqual(expect.arrayContaining(['WIFI', 'SHOW', 'TOIL']));
  });
});

/* -------------------------------------------------------------------------- */
/* AC-3/BR-3/EC-3 — unrecognized code rejected before Prisma runs             */
/* -------------------------------------------------------------------------- */

describe('searchCampsites — unrecognized taxonomy code (AC-3, BR-3, EC-3)', () => {
  it('[unit] an unknown terrain code fails zod validation — safeParse rejects, executeSearchCampsites never runs', () => {
    const parsed = searchCampsitesArgsSchema.safeParse({ terrain: 'KITC' });
    expect(parsed.success).toBe(false);
  });

  it('[unit] an unknown facilities code fails zod validation (the exact class of bug this story fixes for terrain)', () => {
    const parsed = searchCampsitesArgsSchema.safeParse({ facilities: 'PARK' });
    expect(parsed.success).toBe(false);
  });

  it('[unit] an unknown access/activities code fails zod validation', () => {
    expect(searchCampsitesArgsSchema.safeParse({ access: 'FLY' }).success).toBe(false);
    expect(searchCampsitesArgsSchema.safeParse({ activities: 'NOPE' }).success).toBe(false);
  });

  // QA adversarial check (b): prove the REAL registered tool — not a fake stand-in — rejects
  // an unrecognized code through dispatchTool's actual safeParse gate, and that Prisma is
  // never reached (AC-3 System effect: "invalid_args, no query").
  it('[integration] dispatchTool("searchCampsites", { terrain: "KITC" }) — real registry rejects invalid_args, findMany never runs', async () => {
    const result = await dispatchTool('searchCampsites', { terrain: 'KITC' });

    expect(result).toEqual({ ok: false, code: 'invalid_args', message: expect.any(String) });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('[integration] dispatchTool("searchCampsites", { facilities: "PARK" }) — real registry rejects invalid_args, findMany never runs', async () => {
    const result = await dispatchTool('searchCampsites', { facilities: 'PARK' });

    expect(result).toEqual({ ok: false, code: 'invalid_args', message: expect.any(String) });
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* AC-2/BR-4 — today's date in the system prompt (openrouter-client)         */
/* -------------------------------------------------------------------------- */

describe('openrouter-client — today\'s date + guidance in the system prompt (AC-2, BR-4)', () => {
  function res(body: unknown, ok = true, status = 200): Response {
    return { ok, status, json: async () => body } as Response;
  }

  function assistantMessage(content: string | null) {
    return { choices: [{ message: { role: 'assistant', content, tool_calls: undefined } }] };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('[unit] formatTodayContextLine formats an injected date deterministically — ISO date + Thai weekday, never the real clock', () => {
    // 2026-07-18T10:00:00Z is 2026-07-18 17:00 in Asia/Bangkok, a Saturday.
    const line = formatTodayContextLine(new Date('2026-07-18T10:00:00Z'));
    expect(line).toBe("Today's date is 2026-07-18 (วันเสาร์), Asia/Bangkok time.");
  });

  it('[unit] the system prompt sent to the model contains an ISO-date + Thai-weekday line and the relative-date/keyword guidance', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-408';
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    await runAssistantTurn('มีแคมป์ไหมคะ');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMessage.content).toMatch(/today's date is \d{4}-\d{2}-\d{2} \(วัน.+\), asia\/bangkok time\./i);
    // CAM-462 (BR-6) — the model no longer computes ISO dates itself; it
    // calls the resolveDates tool for a relative/holiday Thai date phrase
    // (see __tests__/cam-462-prompt-date-tool.test.ts for the full pin).
    expect(systemMessage.content).toMatch(/call resolvedates and use the ranges it returns/i);
    expect(systemMessage.content).toMatch(/use the keyword argument only for a specific campsite name/i);
  });

  // BR-4 regression guard: "computed fresh on every call ... never a cached/module-load
  // value". Two turns at two different real-clock times must carry two different date
  // lines — if a future edit hoisted the date line to a module-level constant (the exact
  // class of bug this story fixes), this test would go red.
  it('[unit] BR-4 freshness — two turns at two different clock times carry two different date lines (never cached at module load)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-408';
    const mockFetch = vi.fn().mockResolvedValue(res(assistantMessage('ok')));
    vi.stubGlobal('fetch', mockFetch);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-07-18T10:00:00Z')); // 2026-07-18 (Saturday) Bangkok
      await runAssistantTurn('มีแคมป์ไหมคะ');
      const bodyDay1 = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
      const systemDay1 = bodyDay1.messages.find((m: { role: string }) => m.role === 'system').content;

      vi.setSystemTime(new Date('2026-08-25T10:00:00Z')); // 2026-08-25 (Tuesday) Bangkok
      await runAssistantTurn('มีแคมป์ไหมคะ');
      const bodyDay2 = JSON.parse((mockFetch.mock.calls[1] as [string, RequestInit])[1].body as string);
      const systemDay2 = bodyDay2.messages.find((m: { role: string }) => m.role === 'system').content;

      expect(systemDay1).toContain('2026-07-18');
      expect(systemDay2).toContain('2026-08-25');
      expect(systemDay1).not.toBe(systemDay2);
    } finally {
      vi.useRealTimers();
    }
  });
});
