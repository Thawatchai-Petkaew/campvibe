---
linear: CAM-349
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: story
class: spec-lite
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-04
---
# My Camp Sites list shows placeholders: dashboard API never ships images (CAM-349)

## Story
As a **Host**, I want my camp photos to show as thumbnails on the My Camp Sites list, so that I can tell my listings apart at a glance instead of seeing identical placeholder icons.
Why: owner-reported after the M1 batch went live. The list page (`app/dashboard/campsites/page.tsx`) correctly reads `camp.images[0].url` (S4b relation shape), but its data source `/api/operator/dashboard` includes only `location` + `_count` on the listing query — `images` never leaves the server, so every row falls to the placeholder.
Scope: add the `images` relation (first image only) to the listing query in `app/api/operator/dashboard/route.ts`. No UI change (the page code is already correct). Single surface → spec-lite; this story.md rides the fix PR.
Depends on: —

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A host owns camps that have photos | The host opens the My Camp Sites list | Each row shows its camp's first photo as the thumbnail (no placeholder icon) | The dashboard payload's `campSites[]` carries `images[0].url` (first by sortOrder, one per camp) | EC-1 |
| AC-2 | A camp has no photos | The host opens the list | That row shows the existing placeholder icon (unchanged behavior) | `images` is an empty array for that camp | EC-1 |

## Rules
- BR-1 The listing query ships exactly ONE image per camp (`orderBy sortOrder asc, take 1, select url+sortOrder`) — the list needs only a thumbnail; no over-fetch of full galleries. (proves AC-1)

## Edge cases
- EC-1 IF a camp has zero images THEN `images` = `[]` and the page's existing `camp.images?.length` guard renders the placeholder — no crash, no change (BR-1)

## Data
- Read-only include change. No schema change, no migration, no new endpoint, no UI change.

## Seams & refs
- `app/api/operator/dashboard/route.ts` — the `teamCampSites` findMany (the query that becomes `campSites` in the payload; the `ownedSites` query is ids-only usage and stays untouched).
- `app/dashboard/campsites/page.tsx:213` — the consumer (already correct, untouched).
- Ref: CAM-348 (same family: S4b images-relation payload vs stale consumer assumptions).

## Out of scope
- Shipping full galleries or more list imagery · any UI change.

## Self-verify
- AC-1/AC-2/EC-1 → route-level integration test (mocked prisma + auth, real GET handler): payload `campSites[].images[0].url` present when the mock has images; `[]` when not; `take: 1` + `sortOrder asc` asserted on the query shape.
- Gate = /quality-gate · Done = owner sees real thumbnails on the list on the real Staging URL.

## Changelog
- v1 (2026-07-04) — created as spec-lite with the fix PR (owner-reported defect).
