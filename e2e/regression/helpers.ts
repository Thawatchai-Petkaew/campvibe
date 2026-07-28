/**
 * CAM-359 — shared helpers for the 6 regression specs.
 */
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { test } from "@playwright/test";

/**
 * CAM-603 — narrow, capped retry for the ONE class of transient network
 * error this harness's Node-side `request.*` calls (this shared
 * APIRequestContext, reused by every regression spec) can hit against the
 * `next dev` webServer.
 *
 * Mechanism (verified, not a guess — see docs/specs/platform-hardening/
 * taxonomy-ui-foundation/CAM-603-e2e-midrun-abort/tech.md for the full
 * repro): `next dev` (unlike `next start`) never passes `keepAliveTimeout`
 * to Node's http server, so Node's own default (5000ms) governs; Playwright
 * bundles its APIRequestContext client with `keepAlive: true` and no
 * matching idle cap of its own. A request reused on this shared context
 * right as the server's idle timer destroys the socket can lose the race —
 * server logs `Error: aborted {code:'ECONNRESET'}` (already a known,
 * already-survived class in THIS codebase: `lib/observability/abort-guard.ts`,
 * CAM-406, confirms Next's own default handler does not crash the process
 * on it), client sees "socket hang up". Browsers silently retry an
 * idempotent GET that hits a stale reused connection; Node's `http.Agent`
 * does not — which is exactly why only these Node-side `request.*` calls
 * (never a `page.goto()`) are exposed.
 *
 * This is NOT a blanket retry: `isTransientKeepAliveRace` matches ONLY the
 * exact narrow error shapes this one mechanism produces — "ECONNRESET",
 * "socket hang up", "aborted" — and NEVER "ECONNREFUSED"; a dead webServer
 * process fails every connection with ECONNREFUSED, which this predicate
 * deliberately excludes, so a real crash still fails immediately and loudly
 * (here, and on every subsequent request in every subsequent spec —
 * nothing masks that). Matched on the ERROR MESSAGE TEXT, not a `.code`
 * property: verified directly (this predicate's first draft checked
 * `err.code`, and MISSED a real, freshly-reproduced local failure —
 * `apiRequestContext.get: read ECONNRESET` — because Playwright relays a
 * request-context error to the test process as a plain `Error` with the
 * failure folded into `message`, with no `.code` set at all). Capped at
 * exactly one retry; a second failure of any kind propagates unchanged. A
 * successful retry is never silent — it is recorded as a test annotation
 * so the report/BR-6 ledger can still see it happened.
 */
export function isTransientKeepAliveRace(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("ECONNREFUSED")) return false; // the server is actually down — never retry this
  return message.includes("ECONNRESET") || message.includes("socket hang up") || message.includes("aborted");
}

/**
 * Wraps ONE `request.*` call with the narrow, capped retry above. `label`
 * is only for the annotation text (never asserted on) so a retried run is
 * still visible, not hidden.
 */
export async function withKeepAliveRaceRetry(
  label: string,
  attempt: () => Promise<APIResponse>
): Promise<APIResponse> {
  try {
    return await attempt();
  } catch (err) {
    if (!isTransientKeepAliveRace(err)) throw err;
    test.info().annotations.push({
      type: "cam-603-transient-retry",
      description: `${label}: retried once after a keep-alive race (${(err as Error).message}) — see e2e/regression/README.md.`,
    });
    return attempt(); // exactly one retry — a second failure propagates as-is
  }
}

export interface SeededCampSite {
  id: string;
  nameTh: string;
  nameEn: string;
  nameThSlug: string;
  priceLow: string | number;
  maxGuestsPerDay: number | null;
}

/**
 * Looks up a seeded camp by its stable `nameThSlug` (prisma/seed.ts) via the
 * real operator-dashboard API — deterministic regardless of list sort order,
 * so each spec can target its OWN seeded camp (no cross-spec DB races).
 */
export async function findCampBySlug(
  request: APIRequestContext,
  nameThSlug: string
): Promise<SeededCampSite> {
  const res = await withKeepAliveRaceRetry("GET /api/operator/dashboard", () =>
    request.get("/api/operator/dashboard")
  );
  if (!res.ok()) {
    throw new Error(`GET /api/operator/dashboard failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const campSites: SeededCampSite[] = body.campSites ?? body.data?.campSites ?? [];
  const camp = campSites.find((c) => c.nameThSlug === nameThSlug);
  if (!camp) {
    throw new Error(
      `Seeded camp with nameThSlug="${nameThSlug}" not found under the signed-in host's ` +
        `camps — run "DATABASE_URL=... npx prisma migrate reset --force" against the local ` +
        `DB first (prisma/seed.ts).`
    );
  }
  return camp;
}

/** The subset of GET /api/campsites/[id]'s DTO the specs assert against. */
export interface CampSiteDTO {
  id: string;
  nameTh: string;
  priceLow: string | number | null;
  logo: string | null;
  images: Array<{ url: string }>;
}

/** Fetches the full camp-site DTO (the same shape GET /api/campsites/[id] returns to the edit form). */
export async function getCampSite(request: APIRequestContext, id: string): Promise<CampSiteDTO> {
  const res = await withKeepAliveRaceRetry(`GET /api/campsites/${id}`, () => request.get(`/api/campsites/${id}`));
  if (!res.ok()) {
    throw new Error(`GET /api/campsites/${id} failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}
