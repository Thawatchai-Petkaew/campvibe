## Story
As a **Host**, I want editing my own camp to only ever touch my own camp's data, so that another host can never silently rewrite or blank the location of a camp I own.
Why: the codebase-wide authz sweep (2026-07-28) found and verified by reading the code directly that `PUT /api/campsites/[id]` authorises the camp named in the URL path, then writes a `Location` row keyed by a `locationId` taken from the request body — never compared to the authorised camp's own `locationId`. A host who owns one camp can send `{ locationId: "<any other camp's location uuid>", province: "", district: "", subDistrict: "" }` on their OWN camp's PUT and blank a different camp's province/district/sub-district, with no special role, no race, and no unusual input. Staging is publicly reachable today; production is hidden behind `COMING_SOON` (confirmed by read-only probe, not assumed) but the defect ships to production the day that gate lifts.
Scope: make the location write target the location of the camp that was actually authorised — `existing.locationId`, the value `requireCampSitePermission` already returned and proved belongs to the camp in the path — instead of a body-supplied id. Sweep `app/api/**` for the same authorise-A/write-B shape and report findings even if this route is the only instance.
Depends on: none (isolated fix, single file surface).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Host A owns camp A; camp B (owned by Host B) has a different `locationId` | Host A sends `PUT /api/campsites/{A}` with `locationId` set to camp B's `locationId` plus `province`/`district`/`subDistrict` edits | No visible difference to Host A (save succeeds, 200) — Thai copy unchanged, this is a server-side authz fix with no new user-facing message | Camp B's `Location` row is **never touched**; only camp A's own `Location` row (`existing.locationId`) is updated with the submitted province/district/subDistrict | EC-1 |
| AC-2 | Host A owns camp A, editing camp A's own location fields, and sends camp A's own real `locationId` in the body (the normal client behavior) | Host A submits the edit | Save succeeds as today, 200, no behavior change for the legitimate path | Camp A's own `Location` row is updated exactly as before | EC-2 |
| AC-3 | Host A owns camp A and sends NO `locationId` at all, only `province`/`district`/`subDistrict` | Host A submits the edit | Save succeeds, 200 | Camp A's own `Location` row (`existing.locationId`) is still updated — the write no longer depends on the body carrying a `locationId` at all | EC-3 |

## Rules
- BR-1 The `Location` row written by `PUT /api/campsites/[id]` is always `existing.locationId` — the linked Location of the camp record `requireCampSitePermission` already fetched and authorised for the path's `id` — never a client-supplied id (proves AC-1/AC-2/AC-3).
- BR-2 A body-supplied `locationId` on this route is **silently ignored** for the purpose of choosing which Location row to write (see tech.md for the ignore-vs-reject decision and why). It remains a valid field on `campSiteSchema` for `POST /api/campsites` (create), which is unaffected — that route assigns a `locationId` to a brand-new camp, a different operation with no existing authorised camp to disagree with.
- BR-3 The location write still fires only when the request actually edits a location field (`hasLocationFieldEdit`, unchanged) — a partial PUT that never mentions province/district/subDistrict performs zero location writes (proves AC-3 alongside the existing no-op guarantee).

## Edge cases
- EC-1 IF the request body's `locationId` disagrees with the authorised camp's own `locationId` THEN the mismatched id is ignored and the authorised camp's own Location row is written instead (BR-1/BR-2)
- EC-2 IF the request body's `locationId` happens to equal the authorised camp's own `locationId` (the legitimate/normal case) THEN behavior is unchanged from today (BR-1)
- EC-3 IF the request body omits `locationId` entirely but still edits province/district/subDistrict THEN the write still targets the authorised camp's own Location row (BR-1/BR-3)

## Data
- No schema/migration change. `CampSite.locationId` (existing, non-null `String`, FK to `Location.id`) is already returned by `requireCampSitePermission`'s `prisma.campSite.findUnique` call — no new query needed.

## Seams & refs
- Reuse: `requireCampSitePermission` (`lib/auth-utils.ts`, untouched — out of bounds for this story) already returns the authorised `campSite` record including its scalar `locationId` column; the fix is to read that field instead of the request body's.
- Refs: no new ADR — this is a one-line authorization-source correction, not a new architectural decision.

## Out of scope
- Any change to `lib/auth-utils.ts` — flagged to the orchestrator per the dispatch's explicit STOP rule; not needed for this fix (the helper already returns what's needed).
- Any other route found by the `app/api/**` sweep — see tech.md's sweep findings; none found beyond this route, so nothing else is touched.
- Letting a host retarget a DIFFERENT Location row on purpose (e.g. re-linking a camp to a different Location entity) — this route never supported that safely and still does not; out of scope for this security fix.

## Self-verify
- AC-1 → `__tests__/cam-613-location-write-authz.test.ts`: failing-first cross-tenant test (host A's PUT with a foreign `locationId` must NOT write to that foreign id) — red against the pre-fix code, green after.
- AC-2 → same file: the legitimate own-camp edit path, pinned so a regression here is never silent.
- AC-3 → same file: no-`locationId`-in-body case still writes the authorised camp's own Location row.
- Sweep → tech.md documents the `app/api/**` grep for the same authorise-path-A/write-body-B shape and its result.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created; fixes CAM-613 cross-tenant location-write authz defect.
