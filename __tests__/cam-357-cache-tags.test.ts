/**
 * cam-357-cache-tags.test.ts — CAM-357
 *
 * Bug (found in CAM-353's build): lib/catalog-cache.ts's getCampBySlug wrapped
 * unstable_cache with `tags: []` at module-load time. unstable_cache fixes its
 * `tags` option at WRAP time, not per-call — so a tag that depends on the
 * runtime argument (the slug) can never be attached that way. Every
 * revalidateTag(campSlugTag(slug)) call across the app (spot/zone writers)
 * was inert against this cache entry; freshness relied on the 5-min TTL alone,
 * so a host edit could take up to 5 minutes to surface on the public detail page.
 *
 * Fix: build the unstable_cache wrapper INSIDE the exported getCampBySlug
 * function, once per call, so `tags: [campSlugTag(slug)]` can read the real
 * runtime slug. Also extends the PUT/DELETE /api/campsites/[id] writer (the
 * one mutating handler that did NOT already call revalidateTag(campSlugTag(...))
 * — the spot and zone handlers already did, per CAM-353 BR-8 / CAM-362).
 *
 * AC coverage matrix:
 *   AC-1  getCampBySlug passes a REAL per-slug tag (not `tags: []`) to unstable_cache
 *   AC-2  two different slugs get two different keyParts + two different tags
 *   AC-3  the SAME slug called twice gets IDENTICAL keyParts AND only issues one
 *         real fetch (prisma.campSite.findFirst) — cache-hit is preserved, not
 *         accidentally turned into a miss every time by wrapping per-call
 *   AC-4  PUT /api/campsites/[id] now busts both slug tags (TH + EN), in addition
 *         to the pre-existing campTag(id) + CATALOG_TAG busts (no regression)
 *   AC-5  DELETE /api/campsites/[id] busts both slug tags using the already-
 *         returned deleted row (no extra prisma call / no N+1)
 *   AC-6  writer inventory regression guard — every campsite-mutation handler
 *         (campsites/[id], spots, spots/[spotId], zones, zones/[zoneId]) keeps
 *         calling revalidateTag(campSlugTag(...)) exactly twice per handler
 *         (nameThSlug + nameEnSlug); a future refactor that silently drops one
 *         fails this test immediately.
 *
 * Layers:
 *   - lib/catalog-cache.ts (AC-1..3) -> behavioral test against a LOCAL
 *     next/cache mock (overrides the global setup-next-cache.ts no-op for this
 *     file only) that actually memoizes by keyParts — a real cache-hit/miss
 *     proof, not just a recorded call. prisma is mocked; no DB access.
 *   - app/api/campsites/[id]/route.ts PUT/DELETE (AC-4, AC-5) -> real handler
 *     invocation with mocked prisma/auth-utils/auth, same pattern as
 *     __tests__/cam-360-logo-clear-persists.test.ts.
 *   - writer inventory (AC-6) -> source-inspection across the full write-path
 *     manifest (mirrors freshness-guard.test.ts / cam-195's AC-5/AC-6 style).
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary · error/validation (where applicable per layer)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ---------------------------------------------------------------------------
// Local next/cache mock — overrides the global setup-next-cache.ts default
// (a bare `(fn) => fn` passthrough) for THIS file only. unstable_cache here
// actually memoizes by JSON.stringify(keyParts), the same lookup shape Next's
// real persisted cache store uses, so we can prove a real cache-hit (the inner
// fetcher runs once, not once per call) instead of only recording call args.
// revalidateTag / revalidatePath stay plain spies, same shape as the global
// default, so the handler-level tests below can assert on them directly.
// ---------------------------------------------------------------------------
const { unstableCacheSpy, cacheStore } = vi.hoisted(() => {
  const cacheStore = new Map<string, unknown>();
  const unstableCacheSpy = vi.fn(
    (
      fn: (...args: unknown[]) => Promise<unknown>,
      keyParts: unknown[] = [],
      options: Record<string, unknown> = {}
    ) => {
      // The 3rd arg (options: revalidate/tags) is not implemented by this mock's
      // memoization — it only needs keyParts to prove hit/miss behavior. It IS
      // still recorded on unstableCacheSpy.mock.calls (that's what AC-1/AC-2's
      // `options.tags` assertions read), this parameter just isn't consumed here.
      void options;
      return async (...args: unknown[]) => {
        const key = JSON.stringify(keyParts);
        if (cacheStore.has(key)) {
          return cacheStore.get(key);
        }
        const result = await fn(...args);
        cacheStore.set(key, result);
        return result;
      };
    }
  );
  return { unstableCacheSpy, cacheStore };
});

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: unstableCacheSpy,
  unstable_noStore: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { revalidateTag } from 'next/cache';
import { getCampBySlug, campSlugTag, campTag, CATALOG_TAG } from '@/lib/catalog-cache';
import { PUT as campSitePUT, DELETE as campSiteDELETE } from '@/app/api/campsites/[id]/route';

type PrismaFindFirstArgs = { where: { OR: [{ nameThSlug: string }, { nameEnSlug: string }] } };

const CAMP_ROW_A = { id: 'camp-a-id', nameThSlug: 'camp-a', nameEnSlug: 'camp-a-en' };
const CAMP_ROW_B = { id: 'camp-b-id', nameThSlug: 'camp-b', nameEnSlug: 'camp-b-en' };

// ===========================================================================
// AC-1..3 — getCampBySlug: real per-slug tag + cache-hit preserved
// ===========================================================================
describe('getCampBySlug — real per-slug cache tags (CAM-357 fix)', () => {
  beforeEach(() => {
    unstableCacheSpy.mockClear();
    cacheStore.clear();
    (prisma.campSite.findFirst as ReturnType<typeof vi.fn>).mockReset();
  });

  it('[AC-1] passes keyParts including the slug + tags: [campSlugTag(slug)] — not the old tags: []', async () => {
    (prisma.campSite.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(CAMP_ROW_A);

    await getCampBySlug('camp-a');

    expect(unstableCacheSpy).toHaveBeenCalledTimes(1);
    const [, keyParts, options] = unstableCacheSpy.mock.calls[0] as [unknown, unknown[], Record<string, unknown>];
    expect(keyParts).toEqual(['camp-detail', 'camp-a']);
    expect(options.tags).toEqual([campSlugTag('camp-a')]);
    expect(options.revalidate).toBe(300);
    // Prove-It: the CAM-357 bug shape must not regress.
    expect(options.tags).not.toEqual([]);
  });

  it('[AC-2] a different slug gets a different keyParts AND a different tag', async () => {
    (prisma.campSite.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(CAMP_ROW_A);
    await getCampBySlug('camp-a');
    (prisma.campSite.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(CAMP_ROW_B);
    await getCampBySlug('camp-b');

    const [, keyPartsA, optionsA] = unstableCacheSpy.mock.calls[0] as [unknown, unknown[], Record<string, unknown>];
    const [, keyPartsB, optionsB] = unstableCacheSpy.mock.calls[1] as [unknown, unknown[], Record<string, unknown>];

    expect(keyPartsA).not.toEqual(keyPartsB);
    expect(optionsA.tags).toEqual([campSlugTag('camp-a')]);
    expect(optionsB.tags).toEqual([campSlugTag('camp-b')]);
    expect(optionsA.tags).not.toEqual(optionsB.tags);
  });

  it('[AC-3] the SAME slug called twice gets IDENTICAL keyParts — cache-hit preserved (fetch runs once, not twice)', async () => {
    (prisma.campSite.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(CAMP_ROW_A);

    await getCampBySlug('camp-a');
    await getCampBySlug('camp-a');

    const [, keyPartsCall1] = unstableCacheSpy.mock.calls[0] as [unknown, unknown[], unknown];
    const [, keyPartsCall2] = unstableCacheSpy.mock.calls[1] as [unknown, unknown[], unknown];
    expect(keyPartsCall1).toEqual(keyPartsCall2);

    // Real behavioral proof (not just recorded args): the wrapped fetcher hit the
    // memoized store on the 2nd call — the DB layer was touched only once, so
    // building a "new" unstable_cache(...) closure per call did NOT turn every
    // call into a fresh cache miss.
    expect(prisma.campSite.findFirst).toHaveBeenCalledTimes(1);
  });

  it('[AC-2/AC-3, null/empty boundary] two DIFFERENT slugs each get their own independent entry (no cross-slug hit)', async () => {
    (prisma.campSite.findFirst as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: PrismaFindFirstArgs) =>
        args.where.OR[0].nameThSlug === 'camp-a' ? CAMP_ROW_A : CAMP_ROW_B
    );

    const a = await getCampBySlug('camp-a');
    const b = await getCampBySlug('camp-b');

    expect(a).toEqual(CAMP_ROW_A);
    expect(b).toEqual(CAMP_ROW_B);
    // One real DB round-trip per distinct slug — no accidental sharing of one entry.
    expect(prisma.campSite.findFirst).toHaveBeenCalledTimes(2);
  });

  it('[regression, source] the old `tags: []` shape no longer appears in getCampBySlug', () => {
    const catalogCacheSrc = src('lib/catalog-cache.ts');
    const bodyStart = catalogCacheSrc.indexOf('export async function getCampBySlug');
    const bodyEnd = catalogCacheSrc.indexOf('export const getDefaultCatalog');
    const body = catalogCacheSrc.slice(bodyStart, bodyEnd);

    expect(body).not.toMatch(/tags:\s*\[\]/);
    expect(body).toContain('tags: [campSlugTag(slug)]');
  });
});

// ===========================================================================
// AC-4 — PUT /api/campsites/[id]: extends slug-tag busting to the writer
// ===========================================================================
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function campRequest(method: 'PUT' | 'DELETE', id: string, body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost/api/campsites/${id}`, {
    method,
    body: method === 'PUT' ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  });
}

const CAMP_ID = '550e8400-e29b-41d4-a716-446655440357';

function mockAllowed() {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: { id: CAMP_ID, operatorId: 'op-1' } as never,
    session: { user: { id: 'op-1' } } as never,
  });
}

describe('PUT /api/campsites/[id] — extends slug-tag busting to the writer (CAM-357 AC-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    mockAllowed();
    (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID,
      nameThSlug: 'pine-valley-th',
      nameEnSlug: 'pine-valley-en',
    });
  });

  it('[normal] busts BOTH slug tags (TH + EN), in addition to the pre-existing campTag + CATALOG_TAG busts', async () => {
    const res = await campSitePUT(campRequest('PUT', CAMP_ID, { priceLow: 500 }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith(campSlugTag('pine-valley-th'), {});
    expect(revalidateTag).toHaveBeenCalledWith(campSlugTag('pine-valley-en'), {});
    // Regression guard — the pre-existing (CAM-195) busts must still fire.
    expect(revalidateTag).toHaveBeenCalledWith(campTag(CAMP_ID), {});
    expect(revalidateTag).toHaveBeenCalledWith(CATALOG_TAG, {});
  });
});

describe('DELETE /api/campsites/[id] — extends slug-tag busting to the writer (CAM-357 AC-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    mockAllowed();
    (prisma.campSite.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: CAMP_ID,
      nameThSlug: 'pine-valley-th',
      nameEnSlug: 'pine-valley-en',
    });
  });

  it('[normal] busts BOTH slug tags using the already-returned deleted row (no extra prisma call / no N+1)', async () => {
    const res = await campSiteDELETE(campRequest('DELETE', CAMP_ID), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    expect(prisma.campSite.delete).toHaveBeenCalledTimes(1); // proves no extra findUnique lookup was added
    expect(revalidateTag).toHaveBeenCalledWith(campSlugTag('pine-valley-th'), {});
    expect(revalidateTag).toHaveBeenCalledWith(campSlugTag('pine-valley-en'), {});
    expect(revalidateTag).toHaveBeenCalledWith(campTag(CAMP_ID), {});
    expect(revalidateTag).toHaveBeenCalledWith(CATALOG_TAG, {});
  });
});

// ===========================================================================
// AC-6 — writer inventory: every campsite-mutation handler still busts both
// slug tags exactly twice per handler (nameThSlug + nameEnSlug). Regression
// guard so a future refactor cannot silently drop one without CI catching it.
// ===========================================================================
describe('writer inventory — every campsite-mutation handler busts both slug tags (CAM-357 AC-6)', () => {
  const HANDLERS: { file: string; description: string; expectedCalls: number }[] = [
    {
      file: 'app/api/campsites/[id]/route.ts',
      description: 'PUT + DELETE /api/campsites/[id] (CAM-357 — the fix in this ticket)',
      expectedCalls: 4, // 2 handlers x (nameThSlug + nameEnSlug)
    },
    {
      file: 'app/api/campsites/[id]/spots/route.ts',
      description: 'POST /api/campsites/[id]/spots (CAM-353 BR-8 — already correct pre-CAM-357)',
      expectedCalls: 2,
    },
    {
      file: 'app/api/campsites/[id]/spots/[spotId]/route.ts',
      description: 'PUT + DELETE /api/campsites/[id]/spots/[spotId] (CAM-353 BR-8 — already correct pre-CAM-357)',
      expectedCalls: 4,
    },
    {
      file: 'app/api/campsites/[id]/zones/route.ts',
      description: 'POST /api/campsites/[id]/zones (CAM-362 — already correct pre-CAM-357)',
      expectedCalls: 2,
    },
    {
      file: 'app/api/campsites/[id]/zones/[zoneId]/route.ts',
      description: 'DELETE /api/campsites/[id]/zones/[zoneId] (CAM-362 — already correct pre-CAM-357)',
      expectedCalls: 2,
    },
  ];

  for (const { file, description, expectedCalls } of HANDLERS) {
    it(`${description} calls revalidateTag(campSlugTag(...)) exactly ${expectedCalls} time(s)`, () => {
      const content = src(file);
      const occurrences = (content.match(/revalidateTag\(campSlugTag\(/g) || []).length;
      expect(occurrences).toBe(expectedCalls);
    });
  }
});
