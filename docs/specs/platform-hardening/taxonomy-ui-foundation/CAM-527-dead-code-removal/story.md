---
linear: CAM-527
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: platform
artifact: story
owner: product-owner
status: in-progress
version: v1
updated: 2026-07-26
---
# Remove dead code and reconcile the stale type vocabulary (CAM-527 / S11)

<!-- Deletion-heavy chore story. No schema/migration. Security re-check required on the route deletion (attack-surface shrink). -->

## Story
As the **platform** (maintainer-facing, no end-user-visible change), I want the orphaned legacy campgrounds API, three dead modules, and the stale `CampSiteTypeEnum` superset removed, so that the foundation stops carrying an unreachable HTTP write-path that silently drops 5 taxonomy groups and a vocabulary that offers 3 codes no camp can actually have.
Why: 3 read-only sweeps (2026-07-26, see the approved plan) found `app/api/campgrounds/*` still served over HTTP with no product caller, yet diverging dangerously from the live `/api/campsites` route (drops annotatedFeatures/camperStyle/stayConnected/markingMethod/driveway on write, pre-CAM-341 clearing bugs, skips the publish-completeness gate, never busts caches, weaker authz) — every day it stays live is attack surface with no offsetting value.
Scope: (1) delete `app/api/campgrounds/route.ts` + `[id]/route.ts` after proving zero product callers, retargeting every test that imported its handlers directly onto the equivalent live-route coverage; (2) delete 4 more dead files (`lib/validations/campground-legacy.ts`, `lib/filterOptions.ts`, `app/actions/getCampgroundCount.ts`, `components/DashboardBreadcrumb.tsx`) plus `components/CampgroundGrid.tsx` after moving its still-imported `CampSiteCardData` type to `lib/read-models/camp-card.ts`; (3) reconcile `CampSiteTypeEnum` down to the 4 codes with a real `Campground type` MasterData row; (4) prune 2 verified-dead members (`CampgroundDetailClient.tsx`'s `loadingAvailability` state, `lib/sort-utils.ts`'s `sortByRating` + its `WithReviewRatings` type) and their test debris. Does NOT touch `components/FilterModal.tsx`, `components/SearchModal.tsx`, `components/CategoryBar.tsx`, `components/ActiveFilters.tsx`, `lib/taxonomy-registry.ts`, `lib/campsite-filters.ts`, `lib/facility-icon-map.ts`, `prisma/**`, `lib/ai/**`, or `lib/email/*` (dead but a separate owner decision, out of scope).
Depends on: docs research — `.claude/plans/research-user-jolly-mochi.md` §"S11 · Dead-code removal + vocabulary reconcile"; CAM-523/525/533 (merged to `dev` first — this branch is cut from post-merge `dev`)

## AC
| # | Given | When | Then (dev-facing, plain language) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The repo before this story | A grep for every file/type slated for deletion, across `app/`, `components/`, `lib/`, `__tests__/` (excluding docs) | Each shows zero product-code importers/callers (test-only or doc-only references, or none) | `story.md` records the exact evidence per file (this table's evidence lives in the PR body, not the AC) | EC-1 |
| AC-2 | `app/api/campgrounds/*` deleted | `npx vitest run` (full suite) | All previously-passing behavior stays proven: rate-limit 429 (shared key), `take`/bounded-fetch cap, isVerified self-grant prevention, campCardSelect call-site shape — now asserted only against the LIVE `/api/campsites` route | No test count regression from real coverage loss; duplicate/dead-route-only tests are removed, not silently orphaned | EC-2 |
| AC-3 | `CampSiteTypeEnum` narrowed to 4 codes | A camp's `campSiteType` is validated on create/update | Only `CAGD`/`CACP`/`GLAMP`/`VIEW` are accepted; the 3 dropped codes are rejected as any other invalid string would be | `campSiteSchema` rejects a request carrying a dropped code with the existing validation-error shape (no new error path) | EC-3 |
| AC-4 | The full suite after every deletion + prune | `npm run lint && npm run typecheck && npm audit --omit=dev` | All three clean (0 lint errors, 0 type errors, 0 high/critical audit) | Attack surface shrinks (one fewer HTTP route, weaker-authz duplicate gone); no new dependency added | EC-4 |

## Rules
- BR-1 A file/type is deleted only after a grep proves zero real importers/callers (dynamic imports and string-literal fetch targets included) — Chesterton's Fence; if any file turns out reachable, it is NOT deleted and is reported instead (proves AC-1).
- BR-2 Every test that imported a deleted handler directly is retargeted onto the equivalent behavior on the live route, never silently dropped; a security/abuse-hardening assertion with no live equivalent is flagged, not deleted quietly (proves AC-2).
- BR-3 `CampSiteTypeEnum` = exactly `{CAGD, CACP, GLAMP, VIEW}` — the 4 `Campground type` MasterData rows in `prisma/seed.ts`; `LAKE`/`BAOT` remain valid members of their OWN groups (Terrain, Access type) unaffected by this change (proves AC-3).
- BR-4 `CampSiteCardData` (moved from the deleted `CampgroundGrid.tsx`) lives in `lib/read-models/camp-card.ts` next to the `CampCardPayload` it derives from; all 3 importers updated to the new path, no re-export shim left behind as a permanent fixture (proves AC-1/AC-2 for that file).

## Edge cases
- EC-1 IF any deletion candidate turns out to have a real importer/caller THEN it is NOT deleted; the finding is reported in the PR/handoff instead of silently kept or force-deleted (BR-1).
- EC-2 IF a retargeted test's original assertion has no live-route equivalent (confirmed by reading the live route's source) THEN the gap is named explicitly (not silently dropped) — see the IP-rate-limit-on-list-GET finding in the PR body (BR-2).
- EC-3 IF any existing `CampSite` row currently stores `campSiteType` as one of the 3 dropped codes THEN the enum narrowing is NOT safe to ship as-is and must be stopped/reported — this story could not query the dev DB directly (isolated worktree, no `DATABASE_URL`) and instead verified every write path in-repo (`prisma/seed.ts`, `seed-prod.ts`, `scripts/gen-mock-data.mjs`, `app/api/seed`, `app/api/bulk-seed`, `app/api/scrape-seed`) only ever writes the 4 real codes; the one other historical write path (the now-deleted legacy route) validated through this SAME enum, so it could not have written a value the enum didn't already accept. A pre-merge DB check is still recommended (BR-3).
- EC-4 IF `npm audit --omit:dev` or lint/typecheck regress after any deletion THEN fix only the mechanical breakage from the deletion itself; anything behavioral is reported, not patched over (BR-1..4).

## Data
- No schema/DB migration. `CampSiteTypeEnum` is a zod schema narrowing only — `CampSite.campSiteType` was always a plain `String` column (no DB-level enum/check constraint), so this is a validation-boundary change, not a data-shape change. `prisma/seed.ts` read-only (confirmed the 4-row `Campground type` group; not edited).

## Seams & refs
- Reuse: `lib/read-models/camp-card.ts` (existing `CampCardPayload`/`campCardSelect`) is now also the single owner of `CampSiteCardData` — no parallel card-type definition remains. Refs: `.claude/plans/research-user-jolly-mochi.md` §S11 (approved plan); `.claude/rules/code.md` Chesterton's Fence + test-debris lessons; `.claude/rules/security.md` (route-deletion re-check, seed/scrape guard note — unaffected, this story doesn't touch seed routes' guards).
- Out of bounds (owned by sibling stories / separate decisions): `components/FilterModal.tsx`, `components/SearchModal.tsx`, `components/CategoryBar.tsx`, `components/ActiveFilters.tsx`, `components/ui/**`, `app/globals.css`, `DESIGN.md`, `lib/taxonomy-registry.ts`, `lib/campsite-filters.ts`, `lib/facility-icon-map.ts`, `prisma/**`, `lib/ai/**`, `lib/email/*` (dead, separate owner decision per the plan).

## Out of scope
- Wiring or deleting `lib/email/*` (dead, no production caller) — a separate owner decision per the approved plan, not this story.
- Adding IP-based rate-limiting to the live `/api/campsites` GET list route — a genuine pre-existing gap surfaced by this deletion (the legacy route had it, the live route never did); fixing it is a new API-surface change out of this story's file-allow-list → follow-up ticket if the owner wants it closed.
- `components/CampgroundCard.tsx:21`'s doc-comment still naming `CampgroundGrid.tsx`'s `CampSiteCardData` (now moved) — that file is outside this story's allowed surface; cosmetic-only, noted for a future touch-up.

## Self-verify
- AC-1 → grep evidence table in the PR body (per-file: command + result); every deletion candidate re-confirmed zero-importer before `git rm`.
- AC-2 → `npx vitest run` full suite, before/after test count stated in the PR; retargeted tests listed with what they now assert.
- AC-3 → unit (`lib/validations/campsite.ts` zod parse tests already covering GLAMP/VIEW in `cam-517`/`cam-520` suites; dropped-code rejection is implicit zod-enum behavior, same error path as any invalid string).
- AC-4 → `npm run lint` · `npm run typecheck` · `npm audit --omit=dev` (counts pasted in the PR).
- Story-specific: no seed/scrape/bulk-seed route touched (nothing to re-guard); migration = none (schema unchanged); `git log` shows the retargeted tests landed in the SAME PR as the deletions.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created.
