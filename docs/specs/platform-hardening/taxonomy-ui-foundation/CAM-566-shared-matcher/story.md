---
linear: CAM-566
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: story
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-26
---
# One shared AdminArea matcher instead of two (then four) copies (CAM-566)

## Story
As the **platform** (maintainer-facing, no end-user-visible change), I want the bilingual, hierarchical AdminArea matcher consolidated into ONE module instead of independently-drifting ports, so that an edge case learned by fixing one caller is automatically visible to every other caller instead of silently missing.
Why: CAM-554's reverse-geocode resolver and CAM-563's backfill/write-path each ported the SAME matching algorithm standalone because CAM-554's PR was unmerged when CAM-563 needed it (a sequencing gap, not carelessness — both flagged the duplication at the time). By the time this ticket was picked up, CAM-562 (same-day, needed to go one level deeper) had reused CAM-563's export directly rather than re-porting, but its own tech.md still counted **four** near-identical matcher-adjacent files and flagged the same consolidation need a second time — the count growing from two to four in a single day is itself the finding: duplication left alone keeps growing, because each new story reaches for whichever copy is nearest.
Scope: consolidate `normalizeAdminName`/`matchAdminArea` (bilingual, hierarchical, exact-match-only AdminArea lookup) into ONE new module, `lib/geo/admin-area-match.ts`. Three real prior ports move onto it: `app/api/geocode/_shared.ts` (CAM-554), `app/api/location/route.ts` (CAM-563 write path), `scripts/backfill-cam-563-location-admin-area.mjs` (CAM-563 backfill). The backfill script keeps re-exporting `normalizeAdminAreaName`/`matchAdminAreaByName` under their **original names and 4-arg signature** so `scripts/backfill-cam-562-subdistrict-geocode.mjs` (PR #646, merged to `dev` mid-task — see `## Changelog`) and this story's own unedited tests keep working with no rebase needed. Does NOT touch `lib/campsite-filters.ts`'s `resolveProvinceAdminAreaIds` or `lib/ai/tools/search-campsites.ts`'s `resolveProvinceForSearch` — both found during the inventory sweep, both a genuinely different mechanism against a different table for a different purpose (see `## Seams & refs`), both outside this dispatch's allowed file surface. Does NOT touch `scripts/backfill-cam-562-subdistrict-geocode.mjs` itself (off-limits regardless of merge status) even though its own duplicate `callGoogleGeocode` helper is a genuine, separate, out-of-scope finding (see `## Out of scope`).
Depends on: CAM-554 (PR #640, merged to `dev`), CAM-563 (PR #642, merged to `dev`), CAM-562 (PR #646, merged to `dev` mid-task — this branch merged `origin/dev` to pick it up and re-verified its test suite unedited).

## AC
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The 3 real duplicate ports of the matcher exist on `dev` | Consolidated into `lib/geo/admin-area-match.ts` | All 3 callers import the shared module; each former local copy of `normalizeAdminName`/`matchAdminArea` is deleted, not left as dead code alongside the import | A grep for the `THAI_PREFIXES` constant literal shows exactly 1 definition in the whole repo (`lib/geo/admin-area-match.ts`) | EC-1 |
| AC-2 | CAM-554's and CAM-563's existing test suites (3 files, 86 tests) | Run **unedited** after the consolidation | All 86 pass green — no behavior regression visible to any existing caller | Confirmed by an actual `npx vitest run` against the 3 files, pasted in the PR body | EC-2 |
| AC-3 | A stored/typed admin-area name in either Thai or English | Matched at any of the 3 call sites | The SAME AdminArea node resolves regardless of which language the input happens to be in | `matchAdminArea`'s query always checks `nameTh` OR `nameEn` (never one language only) | EC-3 |
| AC-4 | `scripts/backfill-cam-562-subdistrict-geocode.mjs` (PR #646, merged to `dev` mid-task) imports `matchAdminAreaByName` directly from `scripts/backfill-cam-563-location-admin-area.mjs` | This branch merges `origin/dev` (picking up #646) and this story's consolidation | That import's module path AND 4-arg call signature are unchanged; its own test suite (`__tests__/cam-562-geocode-backfill.test.ts`) still passes unedited | 31/31 confirmed by an actual `npx vitest run`, not just a source read | EC-4 |
| AC-5 | The 3 prior ports diverged on ~5 concrete points (full-node vs id-only return, empty-name short-circuit, null-safety, level restriction, `parentId` optionality) | Consolidated into one module | The UNION of every behavior is kept — nothing any existing caller relied on is silently dropped | A new pinning suite (`__tests__/cam-566-admin-area-match.test.ts`) exercises each preserved edge case directly against the shared module | EC-5 |

## Rules
- BR-1 `matchAdminArea(prisma, level, rawName, parentId?)` normalizes the raw name **internally** and short-circuits to `null` before any DB call when the normalized name is empty — CAM-563's two ports already did this defensively; CAM-554's original normalized externally with no short-circuit, but its callers never actually hit the empty-string case, so moving normalization inside changes zero observed behavior while adding the efficiency for every caller (proves AC-1/AC-5).
- BR-2 `matchAdminArea` always returns the **full** `AdminAreaNode` (`id`, `code`, `nameTh`, `nameEn`, `parentId`) — the superset CAM-554's resolver needs (`.code` to derive the matching `ThailandLocation` row); CAM-563's two ports only ever read `.id` off the result, so returning more fields never regresses them (proves AC-5).
- BR-3 `normalizeAdminName` accepts `string | null | undefined` — CAM-563's backfill script's stricter guard (its real input is a stored `Location.district`/`subDistrict` column that can genuinely be `null`); CAM-554's and CAM-563 route's callers only ever passed a guaranteed-truthy string at their own call sites, so the widened accepted type is backward-compatible for them (proves AC-5).
- BR-4 `scripts/backfill-cam-563-location-admin-area.mjs` keeps exporting `normalizeAdminAreaName`/`matchAdminAreaByName` under their exact prior names, at the exact prior module path, with the exact prior 4-arg signature `(prisma, level, rawName, parentId)` — now thin re-exports of the shared module's `normalizeAdminName`/`matchAdminArea` (proves AC-4).
- BR-5 `app/api/location/route.ts` still never calls the matcher with level `'PROVINCE'` after the consolidation (its province is resolved via `thaiLocationId` → `ThailandLocation.provinceCode` → `AdminArea`, never by name) — the shared module accepting a wider `AdminAreaLevel` union than this one caller uses does not change this route's actual call pattern (proves AC-1).

## Edge cases
- EC-1 IF a caller's former local copy is deleted but its import isn't updated to the shared module THEN `npm run typecheck` fails immediately (unresolved reference) — no silent partial migration (BR-1).
- EC-2 IF the consolidation changed any prior return shape or matching behavior THEN CAM-554's or CAM-563's existing (unedited) test suites would go red — they do not; 86/86 green, confirmed by an actual run, not an assertion (BR-2/BR-3).
- EC-3 IF a raw name normalizes to an empty string (e.g. a component that is only the stripped prefix, `"จังหวัด"` alone with nothing after it) THEN `matchAdminArea` returns `null` with **zero** DB round-trips — pinned directly (BR-1).
- EC-4 IF PR #646 (now merged to `dev`) is present in this branch (via `git merge origin/dev`) THEN its `import { matchAdminAreaByName } from './backfill-cam-563-location-admin-area.mjs'` resolves unchanged — same path, same signature, same `.id`-bearing return shape it already reads, confirmed by running its own test suite unedited (31/31 pass) (BR-4).
- EC-5 IF a component/free-text value fails to match at any level — including a province name outside Thailand entirely (CAM-562's real backfill run: 16 of 650 camps' coordinates geocoded to a Lao/Myanmar/Malaysian admin region) — THEN the walk stops at the deepest level that DID match (or returns `null` if even PROVINCE didn't match) and never throws or guesses deeper; this is the existing, unchanged contract of all 3 prior ports, re-verified against the shared module directly (BR-1).

## Data
No schema/DB migration. This is a code-only consolidation of an already-existing algorithm across module boundaries — no new Prisma model or field.

## Seams & refs
- Reuse: `lib/geo/admin-area-match.ts` (new) is the ONE owner of `normalizeAdminName`/`matchAdminArea`. `app/api/geocode/_shared.ts`, `app/api/location/route.ts`, and `scripts/backfill-cam-563-location-admin-area.mjs` all import it — the last one via a re-export that preserves its old export names/signature for its own live consumer (`scripts/backfill-cam-562-subdistrict-geocode.mjs`, PR #646, merged to `dev` mid-task). Full inventory of every matcher-adjacent location (why each is/isn't touched) is in `tech.md`.
- Refs: CAM-563 tech.md's "Seams — CAM-554 coordination" section (the original consolidation recommendation, written when there were 2 copies); CAM-562 tech.md's "Seams — reuse, not a third implementation" section (the "four near-identical matcher copies" flag this story answers).
- Related but explicitly NOT touched (different mechanism, different table, out of this dispatch's file surface): `lib/campsite-filters.ts`'s `resolveProvinceAdminAreaIds` (single PROVINCE-level only, no prefix/suffix normalization — expands a name to a subtree of ids for an OR-filter, a different job) and `lib/ai/tools/search-campsites.ts`'s `resolveProvinceForSearch` (CAM-404, matches `ThailandLocation.provinceName` by `contains`, not `AdminArea` by exact-equals — a pre-existing, separate bridge).

## Out of scope
- `scripts/backfill-cam-562-subdistrict-geocode.mjs`'s own duplicate of `callGoogleGeocode` (CAM-554's Google-fetch wrapper — a different concern from the AdminArea matcher this story consolidates). CAM-562's own tech.md flags this too. That file is off-limits for this dispatch's file surface (now merged to `dev` as PR #646, but still not part of this story's allowed files) → a real follow-up ticket.
- `lib/campsite-filters.ts`'s `resolveProvinceAdminAreaIds` and `lib/ai/tools/search-campsites.ts`'s `resolveProvinceForSearch` — related but distinct mechanisms (see `## Seams & refs`), both outside this dispatch's allowed file surface.

## Self-verify
- AC-1..5 → unit (`__tests__/cam-566-admin-area-match.test.ts`, new) + integration (existing `cam-554-geocode-routes.test.ts` / `cam-563-location-admin-area-backfill.test.ts` / `cam-563-location-route-admin-area.test.ts` / `cam-562-geocode-backfill.test.ts` (merged mid-task), run **unedited**).
- Story-specific: no migration; `scripts/backfill-cam-562-*` never touched (confirmed by the PR's file list, even after merging `origin/dev` into this branch); full suite run as the LAST act before handoff.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created.
- v2 (2026-07-26) — CAM-562 (PR #646) merged to `dev` mid-task; merged `origin/dev` into this branch and re-verified every CAM-562-related claim against the real merged file + its real, unedited 31-test suite (previously reasoned about from the still-open PR branch). No design change; AC-4/EC-4 and the CAM-562 coordination section in `tech.md` updated to state the empirical (not source-read) confirmation.
