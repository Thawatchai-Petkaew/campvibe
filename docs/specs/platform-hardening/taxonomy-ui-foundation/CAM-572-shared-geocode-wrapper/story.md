---
linear: CAM-572
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-27
---
# One shared Google geocode call wrapper instead of independently-drifting script copies (CAM-572)

## Story
As the **platform** (maintainer-facing, no end-user-visible change), I want the low-level Google Geocoding API fetch wrapper consolidated into one module for the backfill scripts that each hand-rolled it, so that an edge case learned by fixing one script (a retry, a timeout, an error shape, a quota response) is automatically visible to the other instead of silently missing.
Why: `scripts/backfill-cam-562-subdistrict-geocode.mjs` carried its own reverse-mode `callGoogleGeocode(lat, lon)` and `scripts/backfill-cam-571-coordinates-inside-thailand.mjs` carried its own forward-mode `callGoogleGeocodeForward(address)` — the same failure mode CAM-566 just closed for the AdminArea matcher, one level down (the Google-fetch wrapper each matcher-port's script also needed).
Scope: consolidate the low-level Google Geocoding fetch primitive (URL build, key injection, region default, fetch, status/ZERO_RESULTS handling, never-log-the-key-bearing-URL discipline) into ONE new module, `lib/geo/google-geocode.ts`, alongside CAM-566's `lib/geo/admin-area-match.ts`. Both scripts' own duplicate `callGoogleGeocode`/`callGoogleGeocodeForward` functions become thin, behavior-preserving translations of the shared core's discriminated result into their own pre-existing return shapes (unchanged — pinned by their own existing, unedited test suites). `extractComponent` (pure address-component extraction, also duplicated between `app/api/geocode/_shared.ts` and the CAM-562 script) is consolidated the same way. `app/api/geocode/_shared.ts::callGoogleGeocode` — the TS-route-facing implementation (CAM-554) — is a **deliberate, documented exception**, NOT consolidated onto the shared module: see `## Seams & refs` and `tech.md` for the two independent reasons (a runtime-import boundary, and a source-inspection test this dispatch was told to leave unedited). No other Google-facing helper with a second copy was found beyond the ones named here — see `tech.md`'s inventory + search method.
Depends on: CAM-554 (PR #640, merged to `dev`), CAM-562 (PR #646, merged to `dev`), CAM-566 (shared-matcher precedent this story follows), CAM-571 (PR merged to `dev`).

## AC
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The 2 real duplicate Google-fetch wrappers exist on `dev` (562's reverse mode, 571's forward mode) | Consolidated into `lib/geo/google-geocode.ts` | Both scripts import the shared core; each former local endpoint-building/fetch/status-handling block is deleted, not left as dead code alongside the import | A grep for the endpoint literal `GOOGLE_GEOCODE_ENDPOINT = 'https://maps.googleapis.com` shows exactly 2 definitions repo-wide: the shared module + the documented `_shared.ts` exception (0 in `scripts/**`) | EC-1 |
| AC-2 | CAM-554's (39 tests), CAM-562's (31 tests) and CAM-571's (36 tests) existing test suites (3 files) | Run **unedited** after the consolidation | All 106 pass green — no behavior regression visible to any existing caller | Confirmed by an actual `npx vitest run` against the 3 files | EC-2 |
| AC-3 | `extractComponent` (pure extraction) duplicated between `_shared.ts` and the CAM-562 script | Consolidated into `lib/geo/google-geocode.ts` | `_shared.ts` re-exports it (same pattern as `normalizeAdminName`, CAM-566); the CAM-562 script imports the shared copy directly | A grep for `function extractComponent` shows exactly 1 real definition (`lib/geo/google-geocode.ts`) | EC-3 |
| AC-4 | The 2 prior fetch-wrapper copies diverged on what they extract from a successful response (address_components vs geometry.location) and on their own return shape | Consolidated into one core | The core returns the raw `results` array; each script's thin wrapper extracts what IT needs and keeps its OWN pre-existing shape — nothing either caller relied on is silently dropped | A new pinning suite (`__tests__/cam-572-google-geocode.test.ts`) exercises the core directly plus both scripts' wrapped functions end-to-end | EC-4 |
| AC-5 | `GOOGLE_GEOCODING_API_KEY` must stay server-only, never client-reachable (CAM-554's original invariant) | The wrapper is consolidated | The key is read only inside `lib/geo/google-geocode.ts` and the (unmoved) `_shared.ts`; it is never returned, logged, or present in any client component's source | A test asserts the key literal is absent from every `components/*` file this story's callers touch, and that a missing key never reaches `fetch` for either script wrapper | EC-5 |

## Rules
- BR-1 `callGoogleGeocodeCore(params)` builds the request from an arbitrary `Record<string,string>` (mirrors `_shared.ts`'s own generic-params design, the richer of the two originals) and defaults `region` to `'th'` only when the caller doesn't set one — a strict superset of both scripts' unconditional `region=th`, safe because neither ever passed a different value (proves AC-1/AC-4).
- BR-2 The core returns a discriminated union — `{ok:true, zeroResults:false, results}` / `{ok:true, zeroResults:true, results:[]}` / `{ok:false, reason}` — never throws, and `reason` is one of `missing_key` / `http_<status>` / `google_<STATUS>` / a caught error's `message`, matching both scripts' existing `reason` vocabulary exactly (proves AC-2/AC-4).
- BR-3 Each script's own wrapper (`callGoogleGeocode(lat,lon)`, `callGoogleGeocodeForward(address)`) keeps its EXACT prior name, signature, and return shape — now a thin translation of the core's result — so every existing caller (`scripts/backfill-cam-575-reconcile-coordinates.mjs`, `scripts/backfill-cam-583-align-provinces.mjs`, both scripts' own test suites) keeps working with zero rebase (proves AC-2).
- BR-4 `app/api/geocode/_shared.ts::callGoogleGeocode` is NOT moved or refactored — it keeps its own complete implementation, unedited — because (a) `_shared.ts` imports `@/lib/prisma`, so a plain `.mjs` script can never import it directly (the same runtime-boundary reason CAM-566's `admin-area-match.ts` takes its Prisma client as an injected parameter instead of a module import), and (b) `__tests__/cam-554-geocode-routes.test.ts` source-inspects `_shared.ts`'s own file text for the key-safety invariant (`toContain('process.env.GOOGLE_GEOCODING_API_KEY')` and a `console.error` presence check) — moving the implementation out would fail those two tests with zero actual behavior change, and this dispatch was told to leave that suite unedited rather than silently redesign around it (proves AC-1's documented-exception carve-out; see `tech.md` for the full reasoning and the `needs_decision` raised on this point).
- BR-5 `extractComponent` IS fully consolidated (no test-coupling risk, confirmed by grep) — `_shared.ts` re-exports it from the shared module exactly as it already does `normalizeAdminName` (CAM-566) (proves AC-3).

## Edge cases
- EC-1 IF a script's former local endpoint const or fetch/status-handling block is deleted but its import isn't updated THEN `npm run typecheck`/`npx vitest run` fail immediately (unresolved reference or wrong shape) — no silent partial migration (BR-1/BR-3).
- EC-2 IF the consolidation changed any prior return shape or matching behavior THEN CAM-554's, CAM-562's, or CAM-571's existing (unedited) test suites would go red — they do not; 69/69 green (this story's own suite) plus the 2 downstream consumer suites (CAM-575, CAM-583) also unedited and green, confirmed by an actual run (BR-2/BR-3).
- EC-3 IF a caller of `extractComponent` passes a component list with no matching type at any priority level THEN it returns `null`, never throws or guesses a fallback — pinned directly against the shared copy (BR-5).
- EC-4 IF the Google API returns `ZERO_RESULTS` THEN both the reverse-mode and forward-mode wrappers report `zeroResults:true` with their OWN prior empty-payload shape (`components:[]` for reverse, no `lat`/`lon` keys at all for forward) — never guessed, never a partial write (BR-2).
- EC-5 IF `GOOGLE_GEOCODING_API_KEY` is unset THEN both script wrappers refuse with `{ok:false, reason:'missing_key'}` WITHOUT ever calling `fetch` — pinned directly, and the key never appears in any returned `reason` on any failure path (BR-2/AC-5).

## Data
No schema/DB migration. This is a code-only consolidation of an already-existing fetch wrapper across module boundaries — no new Prisma model or field.

## Seams & refs
- Reuse: `lib/geo/google-geocode.ts` (new) is the shared owner of `callGoogleGeocodeCore`/`extractComponent`. `scripts/backfill-cam-562-subdistrict-geocode.mjs` and `scripts/backfill-cam-571-coordinates-inside-thailand.mjs` both import it (no `@/`-aliased import in the shared module, same reason as `lib/geo/admin-area-match.ts`, CAM-566, so a plain `.mjs` can import it directly via Node's native TS type-stripping). `app/api/geocode/_shared.ts` re-exports `extractComponent` from it, same pattern as its existing `normalizeAdminName` re-export (CAM-566), but its own `callGoogleGeocode` stays a separate, documented exception (BR-4) — full inventory + search method + the enumerated diff in `tech.md`.
- Refs: CAM-566 tech.md (the `lib/geo/` precedent, `admin-area-match.ts`'s dependency-injection reasoning this story mirrors for the runtime-boundary argument) · CAM-562 tech.md / CAM-566 tech.md's file #4 entry (both already flagged this exact `callGoogleGeocode` duplicate as a genuine, separate, out-of-scope finding — this story is that follow-up).

## Out of scope
- Moving `app/api/geocode/_shared.ts::callGoogleGeocode` onto the shared module — a real, deliberate exception (BR-4), not an oversight. A follow-up ticket could do this IF the owner approves updating `__tests__/cam-554-geocode-routes.test.ts`'s two source-inspection assertions to check the new location instead of `_shared.ts` (the security invariant itself would be unchanged, re-proven at the new location) — flagged as a `needs_decision` in this story's handoff, not decided unilaterally here.
- `scripts/backfill-cam-575-reconcile-coordinates.mjs` and `scripts/backfill-cam-583-align-provinces.mjs` — both already reuse 562's/571's exported functions directly (no own duplicate found on inventory), so neither needed a code change; both suites re-run unedited to confirm.

## Self-verify
- AC-1..5 → unit (`__tests__/cam-572-google-geocode.test.ts`, new) + integration (existing `cam-554-geocode-routes.test.ts` / `cam-562-geocode-backfill.test.ts` / `cam-571-coordinates-inside-thailand.test.ts`, run **unedited**) + regression (`cam-575-reconcile-coordinates.test.ts` / `cam-583-align-provinces.test.ts`, run unedited).
- Story-specific: no migration; no real Google API calls anywhere in any test (global `fetch` always mocked); full suite run as the LAST act before handoff.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-27) — created.
