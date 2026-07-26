/**
 * cam-555-spot-load-isolation.test.ts — CAM-555
 *
 * Root cause of the intermittent ac6-spot-lifecycle e2e flake ("element(s)
 * not found" on getByTestId(`row--spot-${id}`) toContainText, observed
 * twice on two unrelated PRs — #631 CAM-546, #645 CAM-558):
 *
 * components/spot-management-section.tsx's loadData() fetches 4 sources
 * (spots, camp, session, zones) inside ONE Promise.all with ONE shared
 * catch. The CAM-362 G3 fix already isolated zones (fetchZonesSafe never
 * throws), but camp and session were still plain `fetch()` calls sharing
 * the batch with spotsRes. A transient network-level hiccup on EITHER of
 * those two requests — unrelated to spot data, e.g. a dropped connection
 * under CI resource contention, nothing to do with the diff of whatever PR
 * happened to be running — rejects the WHOLE Promise.all before `setSpots`
 * ever runs, so the shared catch sets loadError=true and the entire spots
 * list is replaced by the error banner, even though spotsRes itself had
 * already succeeded and contained the spot the host just created.
 *
 * This was reproduced deterministically against the real app (not just
 * mirrored in a unit) by aborting one `/api/auth/session` request at the
 * network level on the post-create refetch while a direct API call proved
 * the spot really existed — see docs/specs/platform-hardening/
 * taxonomy-ui-foundation/CAM-555-ac6-flake/test.md for the full repro log
 * (100% reproduction rate under fault injection, both before and after the
 * fix, across a session-fetch hiccup and a camp-detail-fetch hiccup).
 *
 * Same node-env/no-jsdom constraint as the rest of this codebase's frontend
 * suites (vitest.config.ts environment: 'node') — real behavioral coverage
 * of the extracted fetchJsonSafe helper lives in
 * __tests__/cam-555-safe-fetch.test.ts; this file mirrors the EXACT
 * before/after shape of loadData's Promise.all with plain Promises whose
 * resolution we control directly (proving the algorithm, not a paraphrase
 * of it — same approach __tests__/cam-361-spot-management-section.test.ts
 * already uses for the CAM-359 requestId guard), plus a structural test
 * tying the mirror back to the real source.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

const root = path.resolve(__dirname, '..');
const sectionSrc = fs.readFileSync(path.join(root, 'components/spot-management-section.tsx'), 'utf-8');

type SafeResult<T> = { ok: true; data: T } | { ok: false };

async function safeFetchMirror<T>(fetcher: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    const data = await fetcher();
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

describe('CAM-555 — [Prove-It] a camp/session hiccup no longer blanks a spots list that loaded fine', () => {
  it('[unit] Prove-It: the PRE-FIX shape (plain fetch shared in one Promise.all) loses the spots list on an unrelated session hiccup', async () => {
    // Mirrors loadData() exactly as it was before CAM-555: spotsFetch
    // resolves fine (the spot really was created); sessionFetch rejects at
    // the network level (a transient hiccup with NOTHING to do with spot
    // data). Promise.all rejects on the FIRST rejection regardless of the
    // other entries' outcomes, so the whole batch throws.
    const spotsFetch = Promise.resolve(['spot-just-created']);
    const sessionFetchRejects = Promise.reject(new Error('session endpoint hiccup'));

    let committedSpots: string[] | null = null;
    let loadErrorSet = false;

    try {
      const [spots] = await Promise.all([spotsFetch, sessionFetchRejects]);
      committedSpots = spots; // never reached — this is the bug
    } catch {
      loadErrorSet = true; // the shared catch blanks the WHOLE section
    }

    expect(loadErrorSet).toBe(true);
    expect(committedSpots).toBeNull(); // the spot that really exists never renders
  });

  it('[unit] Prove-It: the POST-FIX shape (session fetch wrapped never-throw) keeps the spots list on the same hiccup', async () => {
    // Same scenario, but the session fetch is wrapped the way
    // lib/safe-fetch.ts's fetchJsonSafe wraps it — CAM-555's actual fix.
    const spotsFetch = Promise.resolve(['spot-just-created']);
    const sessionFetchRejects = () => Promise.reject(new Error('session endpoint hiccup'));

    let committedSpots: string[] | null = null;
    let loadErrorSet = false;

    try {
      const [spots, sessionResult] = await Promise.all([spotsFetch, safeFetchMirror(sessionFetchRejects)]);
      committedSpots = spots; // reached — spots commit regardless of the session hiccup
      expect(sessionResult).toEqual({ ok: false }); // canManage just fails closed, as designed
    } catch {
      loadErrorSet = true;
    }

    expect(loadErrorSet).toBe(false);
    expect(committedSpots).toEqual(['spot-just-created']); // the real spot renders
  });
});

describe('CAM-555 — [structural] loadData isolates camp/session fetches via fetchJsonSafe, mirroring the CAM-362 zones isolation', () => {
  it('imports fetchJsonSafe from the extracted lib/safe-fetch module', () => {
    expect(sectionSrc).toContain('import { fetchJsonSafe } from "@/lib/safe-fetch"');
  });

  it('the camp-detail fetch inside loadData goes through fetchJsonSafe, not a bare fetch()', () => {
    expect(sectionSrc).toContain('fetchJsonSafe<{ operatorId?: string }>(`/api/campsites/${campSiteId}`)');
  });

  it('the session fetch inside loadData goes through fetchJsonSafe, not a bare fetch()', () => {
    expect(sectionSrc).toContain('fetchJsonSafe<{ user?: { id?: string; role?: string } }>(`/api/auth/session`)');
  });

  it('spotsRes itself is still a hard-required plain fetch — a genuine spots-fetch failure must still surface (spots data really is required, unlike canManage)', () => {
    expect(sectionSrc).toContain('fetch(`/api/campsites/${campSiteId}/spots`, { cache: "no-store" })');
    expect(sectionSrc).toContain('if (!spotsRes.ok) throw new Error("Failed to load spots");');
  });

  it('canManage derivation reads from the safe-fetch result shape (campResult.ok / sessionResult.ok), not raw Response.ok', () => {
    expect(sectionSrc).toContain('if (campResult.ok && sessionResult.ok) {');
    expect(sectionSrc).toContain('sessionResult.data?.user?.id');
    expect(sectionSrc).toContain('campResult.data?.operatorId === userId');
  });
});
