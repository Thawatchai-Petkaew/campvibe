<!--
ticket: CAM-362
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold)
feature: Data & Trust
status: Done (authored retroactively — the build shipped against tech.md as the G2
  SoT; this story.md backfills the spec record so the folder carries the full
  Feature→Epic→Story content per CLAUDE.md docs/specs convention. AC below match
  the SHIPPED behavior verbatim, verified on localhost+staging DB.)
version: v1
spec-class: M (schema + migration + new API contract — full path; G1/G2 decisions
  taken under the owner's delegated epic autonomy of 2026-07-05, recorded in
  tech.md §0.3 A–D with the chosen defaults noted below)
persona: Host
-->

## Story
As a **Host**, I want the zones of my camp to be real reusable records — created once, picked from a list for every spot, and removable when a layout changes — so that my spots stay consistently grouped without me re-typing (and mis-typing) the same zone name on every spot.
Why: before this story `Spot.zone` was a per-spot free-text string — `"โซน A"` and `"โซน a "` were silently different zones, and there was no way to see or manage the camp's zones as a set. CAM-361 shipped grouping/filtering on that string; this story gives the grouping a real entity underneath.
Scope: a per-camp `Zone` entity (soft-deletable, name unique among live rows per camp) + `Spot.zoneId` link · a reversible migration that backfills every existing live free-text zone string into a real Zone row (owner-approved exception to the pre-launch clean-reset convention — the staging zone names are real host data worth keeping) · `/api/campsites/[id]/zones` GET/POST/DELETE · a zone-manager block (add/delete) inside the spot-management section · the spot form's zone field becomes a Select over the camp's live zones with inline create.
Decisions taken (tech.md §0.3, under delegated autonomy): **A** backfill exception confirmed · **B = T1** denormalize-on-write (`Spot.zone` mirrors `Zone.name`; rename follow-up must fan-out or switch readers first) · **C** duplicate detection case-insensitive + trim + whitespace-collapse · **D** name bounds 1..50 after trim.
Depends on: CAM-352 (spot CRUD), CAM-361 (spot section + zone grouping UI this entity plugs into).

## AC
<!-- Then = user-visible (verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Host is on the spot-management section of their camp | Host types a zone name in the `จัดการโซน` block (placeholder `เช่น โซน A`) and taps `เพิ่มโซน` | `เพิ่มโซนแล้ว` and the new zone appears in the manager list and as a filter chip | A live Zone row is created for this camp, appended after existing zones | AC-2, EC-1 |
| AC-2 | A live zone named `โซน A` already exists on this camp | Host adds `โซน a ` (case/extra-whitespace variant) | `มีโซนชื่อนี้อยู่แล้ว` shown inline at the add field | No new row; the existing zone is untouched | — (this IS the failure twin of AC-1) |
| AC-3 | A zone has {N} spots attached | Host taps delete on that zone | Confirm dialog `ลบโซนนี้ใช่หรือไม่ จุดกางเต็นท์ในโซนนี้จะกลายเป็นไม่ระบุโซน`; after confirming: `ลบโซนแล้ว ย้าย {N} จุดกางเต็นท์ในโซนนี้เป็นไม่ระบุโซน` and those spots now list under `ไม่ระบุโซน` | Zone soft-deleted AND all {N} live spots detached to no-zone in one all-or-nothing transaction; spots and their bookings survive untouched | EC-2 |
| AC-4 | Host is creating/editing a spot | Host opens the zone field | A Select listing the camp's live zones plus `สร้างโซนใหม่` (inline create that saves the zone, then selects it) | Spot saved with the picked zone's link; the zone label shown on booking/detail surfaces stays correct (mirrored name) | EC-4 |
| AC-5 | A camp had spots with free-text zone strings from before this story | Host opens the spot section after the release | The same zone names appear as real rows in `จัดการโซน` and as filter chips — nothing lost, no re-typing | Migration backfilled one Zone row per distinct live zone string per camp (378 zones on staging) and linked every live spot to its zone | EC-5 |
| AC-6 | Host deleted zone `โซน A` earlier | Host adds a zone named `โซน A` again | `เพิ่มโซนแล้ว` — the name is re-creatable, not blocked | A NEW live Zone row; the old soft-deleted row stays as history and never collides | — (release-the-name path, not a failure) |

## Rules
- BR-1 **Per-camp scope.** A zone belongs to exactly one camp; there is no global zone list. Cross-camp reuse means creating the same name on the other camp. (proves AC-1)
- BR-2 **Name normalization + bounds.** Names are trimmed with internal whitespace collapsed before validating and comparing; 1..50 chars after normalization. Empty/whitespace-only → `กรุณากรอกชื่อโซน`; over 50 → `ชื่อโซนต้องไม่เกิน 50 ตัวอักษร`. Duplicate detection is case-insensitive on the normalized form. (proves AC-2)
- BR-3 **Uniqueness among LIVE rows only.** The database enforces name-per-camp uniqueness with a partial expression unique index scoped to non-deleted rows, so a soft-deleted name is immediately re-creatable and a concurrent duplicate insert is rejected even if two requests race past the friendly check. (proves AC-2, AC-6, EC-1)
- BR-4 **Delete = soft-delete + detach, atomically.** Deleting a zone never deletes spots or booking history: the zone is soft-deleted and every live attached spot is detached to no-zone inside one transaction; the response carries `detachedSpotCount` which drives the success message's {N}. A zone under another camp, already deleted, or missing → `ไม่พบโซนนี้` with zero changes. (proves AC-3, EC-2)
- BR-5 **T1 display mirror.** Saving a spot with a zone also mirrors the zone's name into the legacy `Spot.zone` string so the four booking/detail read surfaces keep showing the label with zero changes. Constraint recorded loudly: zone RENAME must not ship until it either fans the new name out to attached spots in the same transaction or those readers switch to the Zone relation (tech.md §4.3). (proves AC-4)
- BR-6 **Entity link wins.** When a spot save carries both the legacy free-text string and a zone link, the link is resolved and wins; a link that isn't a live zone of THIS camp is rejected — no cross-camp attachment. Legacy string-only callers keep working unchanged. (proves AC-4, EC-3)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF two requests create the same normalized name concurrently THEN exactly one succeeds and the other gets the same `มีโซนชื่อนี้อยู่แล้ว` duplicate answer (the database index is the backstop behind the friendly check) (BR-3)
- EC-2 IF two delete requests race on the same zone THEN exactly one performs the detach and reports the count; the other sees `ไม่พบโซนนี้` and changes nothing (BR-4)
- EC-3 IF a spot save carries a zone link belonging to another camp or a deleted zone THEN the save is rejected and no attachment happens (BR-6)
- EC-4 IF the zones list fails to load THEN the spot list still renders normally and only the zone-manager block shows `โหลดรายการโซนไม่สำเร็จ ลองใหม่อีกครั้ง` with a retry — a zones-only hiccup never blanks the spots (G3 fix on the UI slice)
- EC-5 IF a pre-existing spot was soft-deleted THEN its zone string contributes no backfilled Zone row; and IF two spots on one camp carried case/whitespace variants of one name THEN the backfill collapses them into ONE zone both spots point at
- EC-6 IF a host edits a spot that already has a zone THEN `ไม่ระบุโซน` is shown disabled with the hint `หากต้องการยกเลิกโซนของจุดนี้ ให้ลบโซนออกจากรายการโซนด้านบน` — round 1 has no un-assign on the spot form (the API rejects clearing the link there); detaching happens via zone delete (BR-4)

## Data
- New `Zone` table (per-camp, soft-deletable, `sortOrder`, optimistic `version`) + `Spot.zoneId` nullable FK; legacy `Spot.zone` string kept as the deprecated display mirror (retirement per api.md rule 12 once all readers use the relation).
- Migration `20260705040333_cam362_zone_entity` — reversible (paired down.sql, proven up→down→up): adds the table/column/indexes, backfills distinct live zone strings per camp into Zone rows (deterministic representative, soft-deleted spots excluded, case/whitespace variants collapsed), links live spots, then creates the partial unique index LAST so a dedup bug fails loudly. Rollback loses only the extracted entity — every original string survives.
- Ran on staging via the Vercel pipeline: 378 zones backfilled.

## Seams & refs
- Reuse: spot CRUD routes + `requireCampSitePermission` + the sibling CAS `updateMany` delete pattern (holds) · `ConfirmDialog` primitive · `FilterChip` (CAM-361's chips now list entity zones) · `apiSuccess`/`apiError` + camp cache-tag revalidation.
- New seams this story added: `lib/validations/zone.ts` (shared zod + the three Thai messages as exported constants) · `lib/zone-client.ts` (`createZone`/`deleteZone`/`fetchZonesSafe` — the safe fetch never rejects, isolating zone failures from the spot list) · `/api/campsites/[id]/zones` + `/zones/[zoneId]`.
- Refs: tech.md in this folder (the full G2 contract — schema, migration SQL, API error sets, blast-radius table, MADR test list) · ADR-000 §Cross-cutting (the clean-reset convention this story's backfill deliberately excepts) · CAM-361 story.md (the grouping UI this entity feeds).

## Out of scope
- Zone RENAME (PATCH) and client-side reordering of `sortOrder` → follow-up story; rename carries the BR-5 fan-out constraint.
- Un-assigning a zone from the spot form (`zoneId: null` round-trip) → round 1 rejects it; detach happens via zone delete (EC-6). Revisit with the rename follow-up.
- Switching the four booking/detail readers off the `Spot.zone` string onto the relation → later story; T1 keeps them correct meanwhile.
- Freezing the booked zone label into the Booking snapshot → separate snapshot-pixel decision, flagged in tech.md §5.

## Self-verify
- Migration correctness + reversibility + the partial-index presence → `__tests__/cam-362-zone-migration.test.ts` (fixture mirrors the real staging strings across 2 camps incl. an intra-camp case/whitespace dup and a soft-deleted spot).
- Delete atomicity + double-delete race + detach count → `__tests__/cam-362-zone-delete.test.ts`.
- API contract (dup 409 + Thai copy, bounds 400s, authz 401/403, cross-camp 404, deleted-name re-create 201) → `__tests__/cam-362-zone-api.test.ts`.
- Never-reject client fetch isolation → `__tests__/cam-362-zone-client.test.ts`.
- UI slice (manager add/delete, Select + inline create, EC-4 isolation) → component tests + owner-verified live on localhost against the staging DB (real backfilled zones visible and manageable).
- Gate = /quality-gate · Done = verified on the real staging data (378 backfilled zones render and are manageable).

## Changelog
- v1 (2026-07-05) — authored retroactively after Done: records the shipped Zone entity (per-camp soft-deletable set + backfill + zones API + manager UI + spot-form Select) with AC matching shipped Thai copy verbatim; decisions A–D from tech.md §0.3 recorded as taken (T1 mirror, case-insensitive normalization, 1..50 bounds, backfill exception).
