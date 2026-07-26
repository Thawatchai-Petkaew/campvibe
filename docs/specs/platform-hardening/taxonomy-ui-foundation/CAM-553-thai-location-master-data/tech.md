---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: backend-engineer
status: done
version: v1
updated: 2026-07-26
---
# Tech — Thai location master data (CAM-553)

## Data model

**Finding (repo-reality check before building):** the ticket assumes this story requires a schema migration ("this is the first migration in this whole batch"). Verified against the live `prisma/schema.prisma` and the dev DB — this is only half true:

- `Location.district String?` and `Location.subDistrict String?` **already exist**, present since the initial migration (`20260620112306_init`). They are atomic free-text fields (BR from architecture.md §1) that were correctly modeled from day one — the defect was that the write path never populated them, not that the schema lacked them.
- `AdminArea`'s `AdminLevel` enum already has `PROVINCE | DISTRICT | SUBDISTRICT` (added in `20260621130951_s5_multi_region`, the S5 ADR-004 multi-region model). It is explicitly commented in `schema.prisma` as "the conformant replacement for the flat ThailandLocation."
- `ThailandLocation` genuinely **cannot** hold a sub-district (no column) — this part of the ticket's premise is correct.

**Model decision:** grow **`AdminArea`** to the full 3-level hierarchy (province/district/sub-district), not `ThailandLocation`. Rationale:
1. `AdminArea` already supports all 3 levels with zero schema change (`AdminLevel.SUBDISTRICT` exists).
2. The schema's own comment already designates `AdminArea` as the successor to `ThailandLocation` ("legacy — pending migration to adminArea"). Extending `ThailandLocation` with new sub-district columns would deepen the exact legacy debt the codebase already decided to retire.
3. This avoids "two competing hierarchies growing in parallel" for the NEW ground (sub-district) — only `AdminArea` grows there. `ThailandLocation` is left schema-unchanged; it is still fully populated for province+district (see below), since it has active consumers today (`CampgroundForm`'s `LocationPicker`/`thaiLocationId`, `/api/locations/search`) that this story does not touch or regress.
4. `Location.district`/`subDistrict` stay free-text (no new FK) — CAM-554 (cascading selects) can choose to also record the resolved `AdminArea` node via the existing, already-generic `Location.adminAreaId` column (not level-restricted at the schema/DB level; today's seed/API code just always resolves it to a province node) without any further migration.

**Net result: no destructive/structural Prisma migration for this story.** Both `Location`'s atomic geo columns and `AdminArea`'s 3-level tree were already correctly designed; the gap was 100% data (rows not imported) + write-path wiring (a field silently dropped), not schema.

Confirmation of "no migration needed" (ground truth, not assumed):
```
$ prisma migrate status            # BEFORE any change in this story
23 migrations found in prisma/migrations
Database schema is up to date!

$ prisma migrate status            # AFTER all changes in this story
23 migrations found in prisma/migrations
Database schema is up to date!

$ prisma migrate dev --name cam-553-noop-check
Already in sync, no schema change or pending migration was found.
```
No new folder appeared under `prisma/migrations/` (`git status --short prisma/migrations/` is empty).

## API contract

`POST /api/location` (`app/api/location/route.ts`) — unchanged method/path/authz, one additive field:

- Input (`lib/validations/location.ts` `createLocationSchema`, extended):
  - `district?: string` — trimmed, max 100 chars (mirrors `province`'s existing contract). Optional, backward-compatible-by-addition (api.md §12) — no existing caller breaks.
- Output: unchanged (`Location` row, `201`).
- Error codes: unchanged set — `400` invalid input (now also fires on `district` > 100 chars) · `401` unauthenticated. No new error path.
- Authz: unchanged (`requireAuth()`, session-derived; no ownership dimension on `Location` itself — a `Location` is not owned until a `CampSite` references it).

Confirmation: `__tests__/cam-553-location-write-path.test.ts` — mocked-Prisma integration test asserts `district` reaches `prisma.location.create`'s `data` argument; verified RED (via `git stash` of the 3 fix files) before the fix, GREEN after.

## ADRs

No new ADR file — this is a data-model clarification (which existing hierarchy grows), not a new architectural pattern. The decision + rationale is captured above and in `story.md ## Data`; `docs/adr/` already carries the ADR-004 S5 multi-region decision this story extends.

Confirmation: `__tests__/cam-553-thailand-hierarchy-import.test.ts` asserts the imported data shape (77/~930/~7,452, code-prefix consistency, uniqueness) that this decision depends on.

## Links
`prisma/schema.prisma` · `story.md` · `docs/RUNBOOK-db-migrations.md` (the reversibility discipline this story's finding is checked against)

## Changelog
- v1 (2026-07-26) — created
