/**
 * cam-564-search-aware-badge.test.ts — CAM-564
 *
 * "Chat result cards show the tag that matched the camper's search." Full
 * spec: docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-564-search-aware-badge/story.md
 *
 * This is the follow-up CAM-547 AC-6 documented and left unbuilt: the badge
 * used to always read the camp's own FIXED first Terrain-group tag
 * (`options[0]`) regardless of what the camper searched for — a search for
 * "ริมน้ำ" (river) still showed "ป่า" (forest) if that happened to be the
 * camp's alphabetically-first Terrain code. `deriveMatchedTags`
 * (lib/ai/tools/search-campsites.ts) fixes this by deriving the badge from
 * the search's OWN supplied filters, verified against the camp's real
 * MasterData rows via one small, batched query (never inferred from `args`
 * alone, never a per-card loop).
 *
 * Coverage matrix:
 *   - normal: a matched filter shows THAT tag, proven to differ from the
 *     camp's fixed `options[0]` (the exact case a "does a badge render"
 *     test would miss on the pre-existing broken behavior)
 *   - normal/BR-2 (multi-match, cross-group): terrain beats facilities
 *     when both are supplied and both match the same card
 *   - normal/BR-2 (multi-match, within one OR-group array): the camper's
 *     own supplied order wins when the row carries more than one candidate;
 *     the row's REAL carried code wins when only one of the array is present
 *   - null/empty (no-match — BR-1/BR-3): no taxonomy filter supplied at all
 *     -> matchedTag null for every card, AND the enrichment query is skipped
 *     entirely (never pays for a query whose answer is always "no match")
 *   - null/empty: a taxonomy filter supplied but the enrichment query comes
 *     back with no candidate codes for this specific row -> null, never a crash
 *   - error/validation: the enrichment query throws -> fail-open, matchedTag
 *     null for every card, the search itself still succeeds
 *   - perf/N+1 guard: the enrichment query runs exactly ONCE per page,
 *     never once per card, regardless of page size
 *   - boundary: a zero-match search never fires the enrichment query at all
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { executeSearchCampsites, searchCampsitesArgsSchema } = await import('@/lib/ai/tools/search-campsites');

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf-8');
const cardSrc = read('components/ai-chat/AiChatCampCard.tsx');

/** The card row the MAIN select returns — carries the camp's OWN fixed first tag (unrelated to the search). */
function mainRow(id: string, fixedFirstTag: { code: string; nameTh: string; nameEn: string } | null) {
  return {
    id,
    reviewCount: 5,
    location: { province: 'Chiang Mai' },
    options: fixedFirstTag ? [fixedFirstTag] : [],
  };
}

/** The enrichment query's row shape — id + whichever candidate codes THIS camp actually carries. */
function tagRow(id: string, matched: { code: string; nameTh: string; nameEn: string }[]) {
  return { id, options: matched };
}

const FORE = { code: 'FORE', nameTh: 'ป่า', nameEn: 'Forest' };
const RIVE = { code: 'RIVE', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek' };
const BEAC = { code: 'BEAC', nameTh: 'ชายหาด', nameEn: 'Beach' };
const WIFI = { code: 'WIFI', nameTh: 'ไวไฟ', nameEn: 'Wifi' };
const TENT = { code: 'TENT', nameTh: 'เต็นท์', nameEn: 'Tent' };
const POWE = { code: 'POWE', nameTh: 'ปลั๊กสนาม', nameEn: 'Power plug' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deriveMatchedTags — normal: the badge reflects the search, not the camp\'s fixed tag', () => {
  it('[normal] a terrain filter that matches this card shows THAT tag — proven to differ from the camp\'s own fixed options[0] (the exact defect the owner reported: every card showed "ป่า")', async () => {
    // Main query: the camp's own fixed first tag is FORE/ป่า (the reported bug's constant value).
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE)]);
    // Enrichment query: this camp's real match for the searched terrain code is RIVE.
    mockFindMany.mockResolvedValueOnce([tagRow('c1', [RIVE])]);

    const args = searchCampsitesArgsSchema.parse({ terrain: 'RIVE' });
    const result = await executeSearchCampsites(args);

    expect(result.cards[0].matchedTag).toEqual({ nameTh: RIVE.nameTh, nameEn: RIVE.nameEn });
    // A test asserting merely "a badge/tag renders" would pass on the OLD
    // broken behavior too (which always read options[0], i.e. FORE) — this
    // proves the value itself is the searched tag, not the fixed one.
    expect(result.cards[0].matchedTag).not.toEqual({ nameTh: FORE.nameTh, nameEn: FORE.nameEn });
    expect(result.cards[0].options).toEqual([FORE]); // the fixed field is untouched, just no longer read for the badge
  });
});

describe('deriveMatchedTags — normal: multi-match PRIORITY across groups (BR-2)', () => {
  it('[normal] terrain beats facilities when a card matches both supplied groups', async () => {
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE)]);
    mockFindMany.mockResolvedValueOnce([tagRow('c1', [RIVE, WIFI])]);

    const args = searchCampsitesArgsSchema.parse({ terrain: 'RIVE', facilities: 'WIFI' });
    const result = await executeSearchCampsites(args);

    expect(result.cards[0].matchedTag).toEqual({ nameTh: RIVE.nameTh, nameEn: RIVE.nameEn });
  });

  it('[normal] facilities alone (no terrain supplied) still wins its own badge — priority only breaks a TIE, it never suppresses the only supplied group', async () => {
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE)]);
    mockFindMany.mockResolvedValueOnce([tagRow('c1', [WIFI])]);

    const args = searchCampsitesArgsSchema.parse({ facilities: 'WIFI' });
    const result = await executeSearchCampsites(args);

    expect(result.cards[0].matchedTag).toEqual({ nameTh: WIFI.nameTh, nameEn: WIFI.nameEn });
  });
});

describe('deriveMatchedTags — normal: multi-match WITHIN one OR-array group (BR-2)', () => {
  it('[normal] the row carries only the SECOND supplied code — the winner is the code the camp REALLY has, not array[0]', async () => {
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE)]);
    mockFindMany.mockResolvedValueOnce([tagRow('c1', [RIVE])]); // camp only really has RIVE, not BEAC

    const args = searchCampsitesArgsSchema.parse({ terrain: ['BEAC', 'RIVE'] });
    const result = await executeSearchCampsites(args);

    expect(result.cards[0].matchedTag).toEqual({ nameTh: RIVE.nameTh, nameEn: RIVE.nameEn });
  });

  it('[normal] the row carries BOTH supplied codes — the camper\'s own supplied order wins (first-in-array), never DB/return order', async () => {
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE)]);
    // Enrichment row lists WIFI before... actually list RIVE after BEAC in DB
    // return order to prove arg order (not return order) decides the winner.
    mockFindMany.mockResolvedValueOnce([tagRow('c1', [RIVE, BEAC])]);

    const args = searchCampsitesArgsSchema.parse({ terrain: ['BEAC', 'RIVE'] });
    const result = await executeSearchCampsites(args);

    expect(result.cards[0].matchedTag).toEqual({ nameTh: BEAC.nameTh, nameEn: BEAC.nameEn });
  });

  it('[normal] equipment (AND-semantics, lowest priority) still resolves — first supplied code wins when it is the only group', async () => {
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE)]);
    mockFindMany.mockResolvedValueOnce([tagRow('c1', [TENT, POWE])]);

    const args = searchCampsitesArgsSchema.parse({ equipment: ['TENT', 'POWE'] });
    const result = await executeSearchCampsites(args);

    expect(result.cards[0].matchedTag).toEqual({ nameTh: TENT.nameTh, nameEn: TENT.nameEn });
  });
});

describe('deriveMatchedTags — null/empty (no-match, BR-1/BR-3): honesty over invention', () => {
  it('[null/empty] no taxonomy filter supplied at all (e.g. province-only search) -> matchedTag is null for every card, and the enrichment query never runs (the common free-text/location case pays nothing extra)', async () => {
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE), mainRow('c2', null)]);

    const args = searchCampsitesArgsSchema.parse({ province: 'เชียงใหม่' });
    const result = await executeSearchCampsites(args);

    expect(result.cards.map((c) => c.matchedTag)).toEqual([null, null]);
    expect(mockFindMany).toHaveBeenCalledOnce(); // only the main select ran
  });

  it('[null/empty] a taxonomy filter supplied, but the enrichment lookup finds no candidate code on this specific row -> null, never a crash', async () => {
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE)]);
    mockFindMany.mockResolvedValueOnce([tagRow('c1', [])]); // no candidate code actually present

    const args = searchCampsitesArgsSchema.parse({ terrain: 'RIVE' });
    const result = await executeSearchCampsites(args);

    expect(result.cards[0].matchedTag).toBeNull();
  });

  it('[boundary] a zero-match search never fires the enrichment query (no cards to enrich)', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const args = searchCampsitesArgsSchema.parse({ terrain: 'RIVE' });
    const result = await executeSearchCampsites(args);

    expect(result.cards).toEqual([]);
    expect(mockFindMany).toHaveBeenCalledOnce();
  });
});

describe('deriveMatchedTags — error/validation: fail-open (BR-5)', () => {
  it('[error] the enrichment query throwing never blocks the search itself — every card just gets matchedTag:null this turn', async () => {
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE), mainRow('c2', FORE)]);
    mockFindMany.mockRejectedValueOnce(new Error('db down'));

    const args = searchCampsitesArgsSchema.parse({ terrain: 'RIVE' });
    const result = await executeSearchCampsites(args);

    expect(result.cards).toHaveLength(2);
    expect(result.cards.every((c) => c.matchedTag === null)).toBe(true);
  });
});

describe('deriveMatchedTags — perf/N+1 guard: batched once per page, never per card', () => {
  it('[perf] a 3-card page fires the enrichment query exactly ONCE, not three times', async () => {
    mockFindMany.mockResolvedValueOnce([mainRow('c1', FORE), mainRow('c2', FORE), mainRow('c3', FORE)]);
    mockFindMany.mockResolvedValueOnce([tagRow('c1', [RIVE]), tagRow('c2', [RIVE]), tagRow('c3', [])]);

    const args = searchCampsitesArgsSchema.parse({ terrain: 'RIVE' });
    const result = await executeSearchCampsites(args);

    expect(mockFindMany).toHaveBeenCalledTimes(2); // main select + ONE batched enrichment call
    expect(result.cards.map((c) => c.matchedTag?.nameEn ?? null)).toEqual(['River, stream, or creek', 'River, stream, or creek', null]);
  });
});

describe('AiChatCampCard.tsx — the badge renders cleanly with no empty outline / layout jump either way (source-inspection, node env, CAM-272 convention)', () => {
  it('[structural] the badge is gated behind the SAME single tagName conditional whether matchedTag is present or null — no unconditional Badge left ungated', () => {
    const badgeOccurrences = (cardSrc.match(/<Badge variant="secondary"/g) ?? []).length;
    expect(badgeOccurrences).toBe(1);
    expect(cardSrc).toContain('{tagName && (');
  });
});
