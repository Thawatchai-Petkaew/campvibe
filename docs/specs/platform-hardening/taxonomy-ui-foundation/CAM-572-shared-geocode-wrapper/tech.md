---
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-27
---
# Tech — One shared Google geocode call wrapper (CAM-572)

## Inventory — every Google-facing helper found, and how it was searched

**Search method:**
`grep -rn "callGoogleGeocode\|GOOGLE_GEOCODING_API_KEY\|maps.googleapis.com" --include="*.ts" --include="*.mjs" --include="*.js" . --exclude-dir=node_modules`
followed by `grep -rn "function extractComponent\|extractComponent(" --include="*.ts" --include="*.mjs" . --exclude-dir=node_modules` (to find the smaller, adjacent duplicate the dispatch asked to look for — "where one duplicate survived, others usually did") and `find . -path ./node_modules -prune -o -iname "*geocode*" -print` (any other geocode-named file at all). Every hit was opened and read in full (not assumed from the filename) to tell a real duplicate from a mere consumer/import.

The dispatch named one duplicate (`scripts/backfill-cam-562-subdistrict-geocode.mjs`'s own `callGoogleGeocode`). The real count is **two** independent duplicate implementations of the low-level Google-fetch wrapper, plus **one** duplicate of a small pure helper (`extractComponent`) riding alongside them — not one, not the four the search initially seemed to suggest (several later files turned out to be reuse via import, not new duplicates):

| # | File | What it has | Relationship to the wrapper | Action this story |
|---|---|---|---|---|
| 1 | `app/api/geocode/_shared.ts` (CAM-554) | Its own `callGoogleGeocode(params)` (generic query params, region unconditionally set to `'th'`, returns the full parsed response or `null` on any failure) + its own `extractComponent` | **The original** — the wrapper both TS routes (`reverse`/`forward`) already share | **NOT moved** — deliberate, documented exception (see below). `extractComponent` IS consolidated (re-exported from the shared module). |
| 2 | `scripts/backfill-cam-562-subdistrict-geocode.mjs` (CAM-562) | Its own `callGoogleGeocode(lat, lon)` — reverse-mode only, hardcodes `language=th`, discriminated `{ok, reason, zeroResults, components}` return shape — plus its own `extractComponent` (a byte-identical port of #1's) | **Real duplicate #1** of the fetch wrapper (a documented, necessary duplicate at the time — `_shared.ts` pulls `@/lib/prisma`, so this plain `.mjs` script could never import it directly) | **CONSOLIDATED** — now a thin translation of `callGoogleGeocodeCore` (`lib/geo/google-geocode.ts`); `extractComponent` now imported from the shared module, local copy deleted |
| 3 | `scripts/backfill-cam-571-coordinates-inside-thailand.mjs` (CAM-571) | Its own `callGoogleGeocodeForward(address)` — forward-mode only, hardcodes `language=th`, discriminated `{ok, reason, zeroResults, lat, lon}` return shape. Its REVERSE-mode calls already reuse #2's `callGoogleGeocode` via direct import (`callGoogleGeocode as callGoogleGeocodeReverse`) — not a third reverse-mode duplicate. | **Real duplicate #2** of the fetch wrapper (the forward-mode half; same runtime-boundary reason as #2 — CAM-554's forward route lives in `app/api/**`, TS, pulling `@/lib/prisma`) | **CONSOLIDATED** — now a thin translation of `callGoogleGeocodeCore` |
| 4 | `scripts/backfill-cam-575-reconcile-coordinates.mjs` (CAM-575) | Imports `callGoogleGeocode`/`extractComponent` **directly** from #2 (same-runtime `.mjs`→`.mjs` import) | **Consumer, not a duplicate** — reuse, not re-porting | **NOT touched** — off this dispatch's file surface anyway (not a `backfill-cam-5*.mjs` carrying its own copy); its own suite re-run unedited to confirm nothing broke |
| 5 | `scripts/backfill-cam-583-align-provinces.mjs` (CAM-583) | Imports `callGoogleGeocode as callGoogleGeocodeReverse` from #2 AND `callGoogleGeocodeForward` from #3 (both direct `.mjs`→`.mjs` imports) | **Consumer, not a duplicate** — reuses BOTH modes from their respective owners, zero new duplication | **NOT touched** — same reasoning as #4; its own suite re-run unedited |
| 6 | `lib/geo/admin-area-match.ts` (CAM-566) | A DIFFERENT Google-adjacent concern (the AdminArea name matcher, not the fetch wrapper) — already consolidated by CAM-566, the precedent this story follows for `lib/geo/` placement and the dependency-injection/no-`@/`-alias pattern | **Unrelated, already solved** | Referenced as the template, not touched |
| 7 | `e2e/regression/ac5-create-camp.spec.ts` | Mentions `GOOGLE_GEOCODING_API_KEY` only in a skip-condition comment (an e2e test that needs a real key to run in CI/local, so it self-skips without one) | **Not a code duplicate** — a test-infra reference to the env var name, no implementation | **NOT touched** — nothing to consolidate |

**No other Google-facing helper with a second copy was found.** The broader `find -iname "*geocode*"` turned up only the files already inventoried above (the two test files, the two scripts, `app/api/geocode/`) — no stray third implementation anywhere else in `app/`, `lib/`, or `scripts/`.

Net: **2 real fetch-wrapper duplicates → 1 shared module** (`lib/geo/google-geocode.ts`), consolidating scripts #2 and #3 onto ONE core. File #1 (`_shared.ts`) is a **documented exception**, not consolidated — see below. `extractComponent` (a small pure helper riding alongside #1 and #2) IS fully consolidated (no exception needed — see "Why `extractComponent` was safe to fully consolidate but `callGoogleGeocode` wasn't").

## Why `_shared.ts::callGoogleGeocode` stays a separate, documented exception

Two independent, compounding reasons — either alone would already block a full merge:

1. **Runtime-import boundary.** `app/api/geocode/_shared.ts` imports `@/lib/prisma` at module scope (needed by its own `resolveFromComponents`). A plain `.mjs` script run by `node` has no `@/*` path-alias resolution — only Node's native relative-import + TypeScript type-stripping (the mechanism CAM-566's `lib/geo/admin-area-match.ts` relies on, and this story's `lib/geo/google-geocode.ts` also relies on). So `scripts/backfill-cam-562-*.mjs`/`571-*.mjs` can **never** import `_shared.ts` directly, regardless of any refactor — the low-level fetch logic has to live somewhere with zero `@/`-aliased imports for scripts to reach it at all.

2. **A protected test source-inspects `_shared.ts`'s own file text, not just its exports.** `__tests__/cam-554-geocode-routes.test.ts` has two assertions that read `_shared.ts`'s raw source string directly (`fs.readFileSync`), not via import:
   - `expect(sharedSrc).toContain('process.env.GOOGLE_GEOCODING_API_KEY')` (line ~351)
   - a regex scan for `console.error(...)` calls, asserting at least one exists and none contain the outgoing URL (line ~362)

   If `callGoogleGeocode`'s implementation (the key read + the `console.error` calls) moved to `lib/geo/google-geocode.ts` and `_shared.ts` merely re-exported it — the exact pattern already used for `normalizeAdminName` (CAM-566) and now for `extractComponent` (this story) — these two assertions would read `_shared.ts`'s file content, find neither the literal `process.env.GOOGLE_GEOCODING_API_KEY` string nor any `console.error(...)` call in that file anymore, and go **red**. This was verified by attempting the move and running the suite before reverting to the current design (see "What was tried" below) — not just reasoned about.

   The dispatch's own instruction: *"the existing CAM-554 and CAM-562 suites pass UNEDITED — if you find yourself needing to change one, that means behaviour changed, so stop and explain."* Editing those two assertions to point at the new file would NOT be a behavior change (the security invariant — key server-only, never logged, never returned — is identical either way, and is independently re-proven at the new location by this story's own `__tests__/cam-572-google-geocode.test.ts`) — but it IS an edit to a file this dispatch was told to leave unedited, and doing it silently is exactly the "improvise a redesign" the STOP RULES forbid. So: **not done.** Flagged as a `needs_decision` in the handoff instead.

### What was tried (and reverted)

A first pass moved `callGoogleGeocode`'s full implementation into `lib/geo/google-geocode.ts` with `_shared.ts` re-exporting it (mirroring `normalizeAdminName`). Running `npx vitest run __tests__/cam-554-geocode-routes.test.ts` against that version failed exactly the two tests named above (`toContain('process.env.GOOGLE_GEOCODING_API_KEY')` → false; `consoleErrorArgs.length` → 0). This is empirical, not speculative — the failure was reproduced, then the change was reverted to the current design (scripts consolidated onto `lib/geo/`, `_shared.ts`'s own `callGoogleGeocode` left untouched) specifically BECAUSE the two tests turned red with no actual behavior change, which is exactly the signal this dispatch was told to stop and report rather than paper over.

### Why `extractComponent` was safe to fully consolidate but `callGoogleGeocode` wasn't

`extractComponent` is a small, pure, side-effect-free function (no key, no fetch, no `console.error`) — nothing in `cam-554-geocode-routes.test.ts` source-inspects it or greps for its literal presence in `_shared.ts` (confirmed: `grep -n "extractComponent" __tests__/cam-554-geocode-routes.test.ts` → no hits). Moving it and re-exporting is therefore risk-free and was done. `callGoogleGeocode` carries the two source-inspected literals above, which `extractComponent` does not — the difference in treatment is not arbitrary, it is exactly what each function's OWN test coverage allows.

## The enumerated diff — every point the two consolidated copies disagreed on, and what was kept

| # | Dimension | CAM-562 (`callGoogleGeocode(lat,lon)`, reverse mode) | CAM-571 (`callGoogleGeocodeForward(address)`, forward mode) | Kept in `lib/geo/google-geocode.ts`'s `callGoogleGeocodeCore` | Why it's safe for both callers |
|---|---|---|---|---|---|
| 1 | Query param carrying the target | `latlng: "${lat},${lon}"` | `address` | **Neither hardcoded** — the core takes an arbitrary `params: Record<string,string>` (mirrors `_shared.ts`'s own generic design, the richer of all 3 original shapes) | Each script's thin wrapper builds its own params object before calling the core; the core itself is param-name-agnostic |
| 2 | `language` param | Hardcoded `'th'` inside the function | Hardcoded `'th'` inside the function | **Left to the caller** (each script's thin wrapper still passes `language: 'th'` explicitly, unchanged) | Identical real-world behavior (`language=th` on every actual call) preserved; the core itself doesn't need an opinion |
| 3 | `region` param | Hardcoded `'th'` inside the function | Hardcoded `'th'` inside the function | **Defaulted** — the core sets `region='th'` only if the caller's `params` doesn't already include one | A strict superset: neither script ever passed a different region, so the default produces the byte-identical outgoing request either now checked empirically (`[boundary] region defaults to "th"` test) |
| 4 | Success extraction | `data.results?.[0]?.address_components ?? []` | `data.results?.[0]?.geometry?.location`, then validates `lat`/`lng` are numbers, else `{ok:false, reason:'no_geometry'}` | **Neither** — the core returns the RAW `results` array (superset); each thin wrapper does its OWN extraction exactly as before | Zero behavior change for either caller — the extraction logic is untouched, just moved one call-frame outward |
| 5 | Return shape on success | `{ok:true, zeroResults:false, components}` | `{ok:true, zeroResults:false, lat, lon}` | **Neither** — these stay the SCRIPTS' own shapes; the core's own success shape is `{ok:true, zeroResults:false, results}` | Each script's thin wrapper translates the core's `results` into its own pre-existing shape — pinned unedited by both scripts' own test suites |
| 6 | Return shape on ZERO_RESULTS | `{ok:true, zeroResults:true, components:[]}` | `{ok:true, zeroResults:true}` (no `lat`/`lon` keys at all) | Core: `{ok:true, zeroResults:true, results:[]}`; each wrapper translates to its OWN shape (562 adds `components:[]`, 571 adds no extra keys) | This exact asymmetry (571 omits keys entirely rather than nulling them) was preserved on purpose — pinned directly in `__tests__/cam-571-*.test.ts`'s `toEqual({ok:true, zeroResults:true})` (no `lat`/`lon` keys) |
| 7 | Error `reason` vocabulary | `missing_key` / `http_<status>` / `google_<STATUS>` / caught `err.message` | Identical vocabulary | **Identical, single copy** in the core | No divergence existed here — both scripts already agreed |
| 8 | Logging | Neither script's `callGoogleGeocode`/`callGoogleGeocodeForward` itself calls `console.error` — the CALLER (`runBackfill`, `planMoves`) logs the `reason` it gets back | Same | **The core itself never logs either** — it only returns `reason`; logging stays the caller's job, unchanged | No behavior change; this was already consistent between the two |
| 9 | Retry / timeout / cache | Neither script's fetch wrapper has retry or timeout logic (confirmed: `grep -n "retry\|timeout\|AbortController\|setTimeout" ...` → no hits in any of the 5 geocode-adjacent files). Response CACHING (to a disk file, keyed by `Location.id`) exists in CAM-562's `runBackfill`, one call-frame OUTSIDE `callGoogleGeocode` itself | Same — no retry/timeout in the fetch wrapper; CAM-571 also caches at the `runBackfill`/`planMoves` level, outside the wrapper | **Not part of the core** — caching stays exactly where it was (the caller, not the wrapper); no retry/timeout existed to preserve or lose | Confirmed empirically by grep before writing this row — nothing was silently dropped because nothing was there |

No genuine bug was found while diffing. Every divergence above was a deliberate, safe superset choice (contrast with the ticket's "report + fix separately" instruction, which does not apply here).

## API contract

No new HTTP endpoint. `lib/geo/google-geocode.ts` exports:
- `callGoogleGeocodeCore(params: Record<string, string>): Promise<GoogleGeocodeCallResult>` — `GoogleGeocodeCallResult = {ok:true, zeroResults:false, results} | {ok:true, zeroResults:true, results:[]} | {ok:false, reason:string}`.
- `extractComponent(components: GoogleAddressComponent[], types: string[]): string | null`.
- Types: `GoogleAddressComponent`, `GoogleGeocodeResult`, `GoogleGeocodeCallResult`.

Callers (all pre-existing, unchanged contracts):
- `scripts/backfill-cam-562-subdistrict-geocode.mjs::callGoogleGeocode(lat, lon)` — thin translation, same name/signature/shape.
- `scripts/backfill-cam-571-coordinates-inside-thailand.mjs::callGoogleGeocodeForward(address)` — thin translation, same name/signature/shape.
- `app/api/geocode/_shared.ts` — re-exports `extractComponent` unchanged; keeps its own `callGoogleGeocode` (documented exception, BR-4).
- Unchanged, not touched: `scripts/backfill-cam-575-reconcile-coordinates.mjs`, `scripts/backfill-cam-583-align-provinces.mjs` (both import from #2/#3, whose export surface is unchanged).

## Coordination / merge-freshness check

`git fetch origin dev` + branched fresh off `origin/dev` (`ed9d479`, includes CAM-580/583/584/565/569 etc.) before starting — no stale-branch risk; CAM-562/571/575/583 were all already merged at branch time, so nothing here needed a mid-task `git merge origin/dev` the way CAM-566 did.

## Confirmation

- `__tests__/cam-572-google-geocode.test.ts` (new, 19 tests) — pins `callGoogleGeocodeCore`/`extractComponent` directly, the consolidation-count grep (exactly 2 `GOOGLE_GEOCODE_ENDPOINT` definitions repo-wide), both scripts' thin wrappers end-to-end, and the key-never-client-reachable invariant.
- `__tests__/cam-554-geocode-routes.test.ts` (39 tests), `__tests__/cam-562-geocode-backfill.test.ts` (31 tests), `__tests__/cam-571-coordinates-inside-thailand.test.ts` (36 tests) — all run **unedited**, all green (106/106).
- `__tests__/cam-575-reconcile-coordinates.test.ts`, `__tests__/cam-583-align-provinces.test.ts` — run unedited, both green (confirms the two consumer scripts kept working).
- `npm run typecheck` — 0 errors (after `npm run delivery:generate`, which clears the pre-existing, unrelated `lib/delivery/*` errors per this dispatch's own instructions).
- `npm run lint` — 0 errors (236 pre-existing warnings, none in any file this story touches).

## Links
`lib/geo/google-geocode.ts` · `app/api/geocode/_shared.ts` · `scripts/backfill-cam-562-subdistrict-geocode.mjs` · `scripts/backfill-cam-571-coordinates-inside-thailand.mjs` · CAM-566 tech.md (the `lib/geo/` precedent) · `story.md`

## Changelog
- v1 (2026-07-27) — created.
