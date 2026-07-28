---
linear: CAM-622
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — Regenerate the province centroids (CAM-622)

## Data model
No new entity/field, no migration. `prisma/data/province-centroids.json` regenerated in place, same shape CAM-502 defined: `{ [province: string]: { lat: number; lng: number; campCount: number } }`. 77 → 77 province keys, 0 added/removed.

## What actually ran (no new mechanism — reused verbatim)
1. `node -r dotenv/config scripts/check-province-centroid-drift.mjs dotenv_config_path=<main tree>/.env` (before regenerating) → `SHIFTED — 38 province(s)`, distances 5.1km-20.2km, `added`/`removed` both empty. Matches the ticket's measured numbers exactly (`--require dotenv/config` + `dotenv_config_path` is the only deviation from the documented `source .env` usage — this worktree-isolated agent's sandbox refuses a bare `source` of a path outside the worktree; `dotenv/config` is an existing devDependency, achieves the identical `process.env.DATABASE_URL` result, and touches neither script — same substitution CAM-606 used).
2. `node -r dotenv/config scripts/build-province-centroids.mjs dotenv_config_path=<main tree>/.env` → wrote 77 provinces from 795 live camp rows, `minCampsForCentroid: 2`.
3. `node -r dotenv/config scripts/check-province-centroid-drift.mjs dotenv_config_path=<main tree>/.env` (after regenerating) → `OK — 0 drift. The committed centroids (77 provinces, MIN_CAMPS_FOR_CENTROID=2) still match the live fact within 5km.`
4. `git diff --stat prisma/data/province-centroids.json` → 207 insertions, 207 deletions (no line added/removed — same 77-entry shape, only `lat`/`lng`/`campCount` values changed).

## No province silently lost its centroid (AC-4/BR-3)
Independent of the drift check's own `added`/`removed` report (both empty), the exact key sets were diffed programmatically: `Object.keys(oldFile).sort()` vs `Object.keys(newFile).sort()` — both are the same 77 provinces, byte-identical arrays. Zero lost, zero gained. This is committed as a regression test (`__tests__/cam-622-regenerated-centroids.test.ts`), pinning the 77-province list captured before this story's regeneration so a FUTURE regeneration that silently drops one goes red instead of unnoticed (the ticket's own named "invisible" failure mode).

## Behavioral verification — the actual point of this story (AC-3, BR-4)

`lib/ai/tools/search-campsites.ts`'s near-path (read-only reference, never touched by this story) does: bbox pre-filter (250km, `MAX_NEAR_KM`) on `isActive && isPublished && deletedAt: null` camps → candidate cap 500 (`NEAR_CANDIDATE_CAP`) → exact haversine distance computed per candidate → filter to `<= 250km` → ascending sort → `take` (10 by default, `SEARCH_CAMPSITES_MAX_RESULTS`). This algorithm was mirrored (not executed, not edited) in an uncommitted scratch script against the real dev DB, for the three provinces CAM-620 measured as most-shifted, comparing the OLD (pre-regeneration) centroid point against the NEW (regenerated) one — same convention CAM-606 used for its own manual, non-committed DB-backed proof.

| Province | Shift (CAM-620 measurement) | Old centroid → top-ranked camp (distance) | New centroid → top-ranked camp (distance) | Changed for a camper? |
|---|---|---|---|---|
| Nakhon Phanom | 20.2km | "เนินหญ้าชายทุ่งนครพนม" (4.8km) | "ต้นน้ำชานเมืองนครพนม" (5.1km) | **Yes** — the old #1 ("เนินหญ้าชายทุ่งนครพนม") drops to LAST (#10, 15.4km) under the corrected centre; a camp that was mid-pack (previously tied 4th/5th at 25.3km) is now first. |
| Prachin Buri | 19.5km | "ริมแม่น้ำสายหลักปราจีนบุรี" (3.6km) | "แหลมหาดทรายปราจีนบุรี" (7.6km) | **Yes** — the old #1 drops to #7 (20.2km); the new #1 was previously ranked #4 (13.5km). |
| Phang Nga | 19.1km | "ชายป่าอนุรักษ์พังงา" (3.6km) | "ริมทะเลนอกเมืองพังงา" (7.2km) | **Yes** — the old #1 drops to #5 (19.2km); the new #1 was previously ranked #5 (18.9km). |

All three of the most-shifted provinces show a real reordering of the top result — a camper who asked "ใกล้นครพนม"/"ใกล้ปราจีนบุรี"/"ใกล้พังงา" would previously have been shown a DIFFERENT nearest camp than the corrected centroid now surfaces. Per BR-4/EC-3, this is reported as measured, not assumed: no province checked showed an identical top-ranked camp before and after (had one, it would have been named honestly here as a finding — CAM-620's own tech.md notes the same distance-vs-campCount nuance, e.g. a province whose count didn't change but still moved a real 16km, so a shift is not simply "more camps got added nearby").

## No golden case moved (AC-5, BR-5)
`npx vitest run __tests__/cam-502-geo-proximity.test.ts __tests__/cam-503-landmark.test.ts __tests__/cam-504-geo2.test.ts` → 72/72 pass, unmodified, against the regenerated file. The one test in that suite that reads the real committed file (`the committed prisma/data/province-centroids.json has no sparse (<2-camp) province`, plus the Bangkok/Nakhon Nayok presence sanity check) passes because the sparse guard and both named provinces are unaffected by this regeneration — no golden case needed editing. `scripts/ai-eval/golden-cases.json`'s `GEO-1..4` cases assert only which TOOL/PARAMS the model emits (`near`/`province` values), never a coordinate or a ranked result — structurally unaffected by a centroid value changing, confirmed by inspection, not by running `ai:eval` (out of scope per the ticket's cost note; this story never touched `lib/ai/**`).

## Self-verify commands run
`npx vitest run __tests__/cam-622-*` (6/6 pass) · `node -r dotenv/config scripts/check-province-centroid-drift.mjs` (0 drift) · `npm run typecheck` (clean) · `npm run lint` (0 errors, 244 pre-existing warnings unrelated to this diff) · full `npx vitest run` (last act, per dispatch: 406 test files / 10981 tests passed, 3 files / 16 tests skipped — the known pre-existing `__tests__/delivery-client.test.ts` env-dependent skip, unrelated to this story).

## Links
`scripts/build-province-centroids.mjs` (unmodified) · `scripts/check-province-centroid-drift.mjs` (unmodified, CAM-620) · `lib/ai/tools/search-campsites.ts` (read-only reference, `executeSearchCampsites` near-path) · `prisma/data/province-centroids.json` · `../CAM-620-derived-drift-guards/tech.md` (item 2, the drift check this story's regeneration responds to) · `../CAM-606-regenerate-shortlist/tech.md` (the precedent this story's shape follows) · `scripts/backfill-cam-571-coordinates-inside-thailand.mjs:25` (the comment naming the root cause) · `story.md`.

## Changelog
- v1 (2026-07-28) — created; documents the regeneration run (before/after drift, key-set diff), the behavioral proximity comparison for the 3 most-shifted provinces, and confirmation that no CAM-502/503 golden case moved.
