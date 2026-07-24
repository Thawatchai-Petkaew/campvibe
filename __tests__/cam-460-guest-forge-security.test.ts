/**
 * cam-460-guest-forge-security.test.ts — CAM-460 QA independent-verify
 * (dispatch step 3): the GUEST UNTRUSTED PATH's real risk — a guest can
 * forge ANY campSiteId into `lastResults` (never one they actually saw).
 *
 * This file does NOT re-derive the gate logic itself: `getCampDetail`'s
 * `isActive/isPublished/deletedAt` filter is already exhaustively proven by
 * __tests__/cam-427-get-camp-detail.test.ts, and `checkAvailability`'s
 * identical gate (CAM-469) is already exhaustively proven by
 * __tests__/cam-469-check-availability-gate.test.ts (published/inactive/
 * deleted/nonexistent, all four, plus the "no existence oracle" invariant).
 * Re-testing that here would be a worthless duplicate (qa.md "more tests
 * != better coverage").
 *
 * What this file closes instead — CAM-460's OWN composition claim
 * (tech.md D2 SECURITY REVIEW POINT 1): a forged campId that rides in via
 * the newly-added `lastResults` wire is NEVER validated/authorized by any
 * CAM-460 code (deriveShownState / toShownResults / buildSystemPrompt) —
 * it is opaque data at every hop — and is SAFE only because it lands,
 * unconditionally, on the tool boundary that already re-fetches + gates by
 * id. Proven end-to-end below by calling the REAL `executeGetCampDetail` /
 * `executeCheckAvailability` with a forged id a mocked DB confirms does not
 * exist / is not public.
 *
 * Also closes the co-location drift risk conversation-store.ts's own
 * `MAX_SHOWN_RESULTS` comment flags explicitly ("DELIBERATELY a local,
 * independently-declared constant... If the tool's cap ever changes, update
 * this value too") — a comment is not a guard; this file adds one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

// Neither tool ever reaches these on the gated (not-found) path exercised
// below, but both modules import them at load time (mirrors the existing
// cam-427-get-camp-detail.test.ts / cam-469-check-availability-gate.test.ts
// mock shape — never let the REAL module (and its own transitive prisma
// import) load unmocked).
vi.mock('@/lib/campsite-availability', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/campsite-availability')>('@/lib/campsite-availability');
  return {
    ...actual,
    getCampSiteDailyAvailability: vi.fn(),
    getEffectiveCapacity: vi.fn(),
    getRemainingCapacityForCamps: vi.fn(),
    getRemainingCapacity: vi.fn(),
  };
});

const { executeGetCampDetail } = await import('@/lib/ai/tools/get-camp-detail');
const { executeCheckAvailability } = await import('@/lib/ai/tools/check-availability');
const { MAX_SHOWN_RESULTS } = await import('@/lib/validations/ai-chat');
const { SEARCH_CAMPSITES_MAX_RESULTS } = await import('@/lib/ai/tools/search-campsites');

/** A syntactically valid uuid a guest could forge into lastResults — this camp never existed / was never returned by any real search. */
const FORGED_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('guest-forged campId — the consuming tool re-gates it (composition proof, tech.md D2 point 1)', () => {
  it('[security] getCampDetail on a forged/unpublished/nonexistent campId returns { ok:false, code:"not_found" } — no data leaked merely because CAM-460 threaded an untrusted id', async () => {
    mockFindFirst.mockResolvedValueOnce(null); // the visibility-scoped findFirst finds nothing

    const result = await executeGetCampDetail({ campSiteId: FORGED_ID });

    expect(result).toEqual({ ok: false, code: 'not_found' });
    // the gate query itself is scoped exactly the way get-camp-detail.ts
    // documents (isPublished/isActive/deletedAt) — a single call, forged id
    // passed straight through as an opaque lookup key, never trusted as
    // "already validated" by CAM-460's own code.
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: FORGED_ID, isPublished: true, isActive: true, deletedAt: null }),
      })
    );
  });

  it('[security] checkAvailability on a forged/unpublished/nonexistent campId returns the exact NO_DATA_RESULT shape (ok:true, all null/zero/false) — same no-existence-oracle contract as CAM-469', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await executeCheckAvailability({
      campSiteId: FORGED_ID,
      startDate: '2026-08-01',
      endDate: '2026-08-03',
    });

    expect(result).toEqual({
      ok: true,
      capacity: null,
      bookedGuests: 0,
      heldGuests: 0,
      remaining: null,
      blockedByHost: false,
    });
  });
});

describe('MAX_SHOWN_RESULTS / SEARCH_CAMPSITES_MAX_RESULTS — single-source-of-truth drift guard', () => {
  it('[boundary] the guest wire cap and the tool result cap share the SAME number today (co-location risk flagged in conversation-store.ts — this test fails loudly the moment one changes without the other)', () => {
    expect(MAX_SHOWN_RESULTS).toBe(SEARCH_CAMPSITES_MAX_RESULTS);
  });
});
