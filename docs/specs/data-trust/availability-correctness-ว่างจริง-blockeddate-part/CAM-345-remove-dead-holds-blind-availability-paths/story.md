---
linear: CAM-345
feature: data-trust
epic: availability-correctness-ว่างจริง-blockeddate-part (CAM-22)
persona: platform
artifact: story
class: full
owner: product-owner
status: Todo
version: v1
updated: 2026-07-04
---
# Remove two dead, holds-blind availability code paths (CAM-345)

## Story
As a **Platform** team member, I want the two dead availability code paths that compute fullness blind to `InternalHold` deleted, so that no future wiring can resurrect a holds-blind availability answer that disagrees with the single source (`lib/campsite-availability.ts`) and silently sells a spot already held.
Why: carded during CAM-303 as cleanup. Ground-truth on latest staging (post CAM-344) confirms exactly TWO dead holds-blind paths remain, and the third suspected one — `buildCampSiteWhere` step 7 in `lib/campsite-filters.ts` — is ALREADY GONE (removed by CAM-344 today), so this story is not obsolete but its scope is now exactly two paths.
Scope: DELETE-only cleanup of two proven-dead paths — (A) the non-transactional `checkDateAvailability` export in `lib/campsite-availability.ts` (0 production callers; only a cam-267 test oracle) and (B) the whole `app/api/campgrounds/[id]/availability` route (0 in-repo fetchers; a legacy-rename duplicate of the holds-aware `app/api/campsites/[id]/availability` sibling). No live availability surface changes behavior. No fix-in-place (both are dead, so routing them through the single source would only preserve dead duplicates — anti-lean).
Depends on: CAM-302 (folded InternalHold into the campsites route + `checkDateAvailabilityInTx`; the campgrounds route was NOT patched then — that is the drift being cleaned up) · CAM-303 (single-source availability math) · CAM-344 (removed the third suspected path — step 7) · ADR-009 (no forked data path).

## AC
<!-- Then = user-visible (screen text = verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin (EC-n/AC-n); — needs a reason. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp whose remaining room for the viewed nights is taken by an ACTIVE non-expired hold, viewed through the live availability surfaces (the campsite detail calendar / remaining-count and the dated catalog badge) | Both dead paths (the non-tx `checkDateAvailability` function and the `/api/campgrounds/[id]/availability` route) are deleted | The camper/host still sees the hold reflected exactly as before — e.g. the held night still shows `เต็มแล้ว` and never a stale `เหลือ {n} ที่` | The live holds-aware surfaces (`getRemainingCapacity`, `getCampSiteDailyAvailability`, `getAvailabilityStatusForCamps`, the `/api/campsites/[id]/availability` route, the booking write path `checkDateAvailabilityInTx`) are untouched; only the two dead paths are removed | EC-1 |
| AC-2 | The cam-267 suite used the now-removed non-tx `checkDateAvailability` ONLY as a cross-check oracle for `getRemainingCapacity` | That function is deleted | (no user-facing change — internal test rewiring) | The oracle assertions are rewritten to assert `getRemainingCapacity` (and/or `checkDateAvailabilityInTx`) directly, so the behavior the oracle pinned stays guarded; suite stays green with no coverage dropped | EC-2 |
| AC-3 | `sec1-sub-routes-visibility` and `cam-190-avail1-blockeddate` each tested the dead campgrounds availability route in parallel with the live campsites route | The campgrounds availability route is deleted | (no user-facing change — internal test rewiring) | The campgrounds-route test blocks/assertions are removed; the equivalent visibility-gate + BlockedDate coverage on the LIVE campsites route remains and stays green | EC-3 |
| AC-4 | The single source `lib/campsite-availability.ts` is meant to be the only place camp availability fullness is computed | The cleanup is complete | (no user-facing change — regression guard) | A lightweight guard confirms the two removed symbols/files do not reappear (the non-tx `checkDateAvailability` export and the campgrounds availability route file) — best-effort per the CAM-221 caveat that a grep guard catches strings, not structure | EC-4 |

## Rules
- BR-1 Both target paths are DEAD, verified on latest staging: the non-tx `checkDateAvailability` export has ZERO non-test importers (its only references live in `__tests__/cam-267-prep1-availability.test.ts` as an oracle); the `/api/campgrounds/[id]/availability` route has ZERO in-repo fetchers (every live fetch goes to `/api/campsites/[id]/availability`). Because there are no real callers, deletion preserves behavior for every caller by construction. (proves AC-1)
- BR-2 Both paths are genuinely holds-BLIND — the reason they are hazardous, not merely unused: the non-tx `checkDateAvailability` reads the holds-aware daily map but its capacity check uses `bookedGuests + requestedGuests` and never adds the `heldGuests` field; the campgrounds route computes `isCapacityFull` from `bookedGuests >= maxGuestsPerDay` and `remainingGuests` from `maxGuestsPerDay - bookedGuests`, both ignoring `heldGuests`. Deleting them removes the footgun of a future re-wire reintroducing a holds-blind answer. (context for AC-1, AC-4)
- BR-3 Chesterton's Fence — why each exists: `checkDateAvailability` (non-tx) was the original public availability check, superseded by CAM-267's `getRemainingCapacity` and the booking write path's `checkDateAvailabilityInTx`; the campgrounds availability route is a leftover of the campground→campsite rename that fell out of sync at CAM-302 when only the campsites sibling had `heldGuests` folded in. Neither is load-bearing today. (context for AC-1)
- BR-4 The live availability surfaces MUST stay behavior-identical: `getCampSiteDailyAvailability`, `getRemainingCapacity`, `getActiveHoldsForRange`, `getBlockedDatesForRange`, `getAvailabilityStatusForCamps`, `checkDateAvailabilityInTx`, and the `/api/campsites/[id]/availability` route are NOT edited. No parallel/duplicate availability math is introduced (ADR-009). If any live availability test goes red for a behavior reason, the deletion is not pure and must be reverted/re-scoped. (proves AC-1)
- BR-5 Deletion must not drop coverage: removing `checkDateAvailability` requires rewiring the cam-267 oracle assertions to target `getRemainingCapacity`/`checkDateAvailabilityInTx` directly BEFORE deletion (never delete the assertion and the coverage together); removing the campgrounds route requires confirming the live campsites-route tests already assert the visibility gate and BlockedDate handling (they do) and removing only the duplicate campgrounds-route blocks. (proves AC-2, AC-3)
- BR-6 Scope guard — ONLY the two availability paths are removed. The sibling routes `app/api/campgrounds/route.ts` and `app/api/campgrounds/[id]/route.ts` also appear to be dead legacy-rename aliases, but they are NOT holds-blind availability computations, so they stay out of this story. (proves scope; see Out of scope)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF any live availability surface (the campsites route, `getRemainingCapacity`, `getAvailabilityStatusForCamps`, or the booking write path) changes its output for any input after the deletion THEN the deletion is not pure dead-code removal and must be reverted or re-scoped — a live test going red for a behavior reason (not a stale reference to a deleted symbol) is a stop condition (BR-4)
- EC-2 IF deleting `checkDateAvailability` would drop the `getRemainingCapacity` behavior the cam-267 oracle pinned THEN rewrite those assertions to target `getRemainingCapacity`/`checkDateAvailabilityInTx` directly first — deletion never removes the assertion and the coverage in one step (BR-5)
- EC-3 IF deleting the campgrounds route would drop visibility-gate or BlockedDate coverage THEN verify the campsites-route test equivalents already assert it (they do) and remove only the duplicate campgrounds-route describe blocks / source-inspection assertions (BR-5)
- EC-4 IF an external, non-repo client (mobile app / third party) actually calls `/api/campgrounds/[id]/availability` THEN removing the route would make that call 404 — assumption (🟡, owner/architect confirm at G1): no such consumer exists (single Next.js web monolith, 0 in-repo callers, legacy-rename alias); if a real external consumer is found, migrate it to the holds-aware `/api/campsites/[id]/availability` before removal instead (BR-1)

## Data
- Read-only cleanup. No schema change, no migration, no new field. Pure deletion of dead code + adjustment of the tests that referenced it. · migration: none

## Seams & refs
- Remove: `lib/campsite-availability.ts` — the non-transactional `checkDateAvailability` export (approx lines 495–561; do NOT touch the transactional `checkDateAvailabilityInTx` below it, which is the live write-path check). · `app/api/campgrounds/[id]/availability/route.ts` — the entire file (dead holds-blind duplicate route).
- Preserve untouched (the single source's live exports): `getCampSiteDailyAvailability` · `getRemainingCapacity` · `getActiveHoldsForRange` · `getBlockedDatesForRange` · `getAvailabilityStatusForCamps` · `checkDateAvailabilityInTx` · and the live route `app/api/campsites/[id]/availability/route.ts`.
- Tests to adjust (backend/QA at build): `__tests__/cam-267-prep1-availability.test.ts` (Group C oracle assertions → retarget to `getRemainingCapacity`/`checkDateAvailabilityInTx`) · `__tests__/sec1-sub-routes-visibility.test.ts` (remove the `GET /api/campgrounds/[id]/availability` import + describe block; the campsites-route describe block stays as the visibility-gate proof) · `__tests__/cam-190-avail1-blockeddate.test.ts` (remove the campgrounds-route source-inspection reads/assertions; the campsites-route and `lib/campsite-availability.ts` source-inspection assertions stay).
- Refs: ADR-009 (no forked/duplicated data path) · ADR-012 §4 (InternalHold, lazy expiry) · CAM-302 (holds folded into the campsites route + `checkDateAvailabilityInTx`; the campgrounds route was not patched → the drift cleaned up here) · CAM-303 (single-source math, block-always-wins) · CAM-344 (removed the third suspected path, step 7 in `lib/campsite-filters.ts` — confirmed already gone).

## Out of scope
- The sibling dead legacy-rename routes `app/api/campgrounds/route.ts` and `app/api/campgrounds/[id]/route.ts` (appear to be dead campground→campsite aliases, but are NOT holds-blind availability computations) → separate naming-cleanup follow-up (new CAM-id at owner discretion; not carded here to avoid over-carding internal tooling per discovery.md).
- `buildCampSiteWhere` step 7 in `lib/campsite-filters.ts` — already removed by CAM-344; nothing to do → CAM-344 (done).
- Any change to availability math, new endpoint, or new feature — this is deletion-only.

## Self-verify
- AC-1 → integration/source: assert the non-tx `checkDateAvailability` export and the `app/api/campgrounds/[id]/availability/route.ts` file no longer exist; run the full existing availability suite (cam-190, cam-267, cam-302, cam-303 parity, sec1, cam-344) and confirm every LIVE-surface test stays green with no behavior change.
- AC-2 → unit: cam-267 Group C rewritten to assert `getRemainingCapacity`/`checkDateAvailabilityInTx` directly against the same fixtures; suite green, coverage on the live functions not reduced.
- AC-3 → integration: sec1 campsites-route visibility-gate block + cam-190 campsites-route/`lib` BlockedDate source-inspection remain and stay green after the campgrounds-route blocks are removed.
- AC-4 → guard (best-effort per CAM-221): a lightweight check that `checkDateAvailability(` (the non-tx export) and the campgrounds availability route path do not reappear; optionally a co-occurrence check that any `>= …maxGuestsPerDay` fullness comparison in `app/api/**`/`lib/**` also references `heldGuests` — noted as advisory, not blocking, because a grep guard catches strings not structure.
- Story-specific: no schema/migration (grep the diff for `prisma/` — must be empty); the diff is deletions + test edits only; `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` all green.
- Gate = /quality-gate · Done = merge to `staging` + full suite green in CI. There is NO new user-visible AC to click on the Staging URL (dead-code deletion) — Done is the cleanup landing with every existing availability test still green and the two dead symbols/files gone.

## Changelog
- v1 (2026-07-04) — created after ground-truth on latest staging (post CAM-344). Confirmed the premise is real, not obsolete: two dead holds-blind availability paths remain (`checkDateAvailability` non-tx export · `/api/campgrounds/[id]/availability` route), and the third suspected path (step 7) is already removed by CAM-344. Classified **class: full** (NOT spec-lite): although the risk is low (pure deletion of proven-dead code), it fails the spec-lite "single file-surface" gate — the change spans two production files (a lib export + a route file), removes an endpoint, and touches three test files — so it takes the full separate-spec-PR + own-G1 path.
