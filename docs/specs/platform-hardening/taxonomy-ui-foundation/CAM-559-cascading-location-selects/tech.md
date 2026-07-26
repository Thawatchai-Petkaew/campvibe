---
feature: Platform hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: backend-engineer
status: done
version: v2
updated: 2026-07-26
---
# Tech — Cascading province/district/sub-district selects (CAM-559)

## Data model

No schema change. `Location.district`/`Location.subDistrict` already exist (CAM-553); `AdminArea` already holds the full 3-level hierarchy (77 `PROVINCE` / 930 `DISTRICT` / 7,452 `SUBDISTRICT`, verified in the dev DB by the coordinator before this story started). `prisma migrate status` is unaffected by this diff — no new migration folder.

## Data sourcing decision — why two tables, not one

The cascading picker deliberately reads from **two different tables**, split by level:

- **Province + district** keep reading the existing `/api/locations/search` (`ThailandLocation`), completely untouched.
- **Sub-district** reads the new `/api/admin-areas/subdistricts` (`AdminArea`) — the ONE level `ThailandLocation` cannot hold at all (no column).

Rationale (the blast-radius constraint the ticket named explicitly): `Location.province`'s stored value is depended on by three consumers this story must never regress — `lib/campsite-filters.ts`'s exact-equality province filter, CAM-531's province dropdown (also reads `Location.province`), and CAM-545's Thai-name lookup (`getProvinceThaiNameMap`, which matches `Location.province` against `ThailandLocation.provinceNameEn` BY NAME). `AdminArea`'s `PROVINCE`/`DISTRICT` rows are seeded from the exact same source JSON as `ThailandLocation` (verified in `prisma/seed.ts`: both `provinceCode`/`code` and `provinceNameEn`/`nameEn` come from the same `province.code`/`province.nameEn` loop variable) — so the two tables' province/district values are byte-identical today. Sourcing province/district from `AdminArea` instead would have been *safe* in principle, but reusing the EXISTING, already-shipped `/api/locations/search` endpoint (rather than adding a parallel read path for data that already has one) is the lower-risk, lower-blast-radius choice, and keeps the FK write (`Location.thaiLocationId`, resolved from a `ThailandLocation` row id) working exactly as it did before this story — no change to `POST /api/location`'s existing `thaiLocationId` → `adminAreaId` resolution logic (lines 30-42 of `app/api/location/route.ts`), which this story does not touch.

`districtCode` is the join key between the two tables at the district→sub-district boundary: `AdminArea` DISTRICT.`code` and `ThailandLocation.districtCode` are the identical string value for the same district (both `district.code` from the same source loop in `prisma/seed.ts`) — confirmed by reading the seed script and a sample row from `prisma/data/thailand-locations.json` (district `1001` "Khet Phra Nakhon" holds sub-district `100101` "Phra Borom Maha Ratchawang"). This lets the client scope a sub-district lookup using the district it already picked from the `ThailandLocation`-backed step, with no second ID namespace to reconcile.

## API contract

### `GET /api/admin-areas/subdistricts?districtCode=<code>&q=<search>` (NEW)
- Input (`lib/validations/location.ts` `adminAreaSubDistrictQuerySchema`): `districtCode: string` (required, 1-20 chars) · `q?: string` (optional, max 100 chars, trimmed).
- Output: `{ id, code, nameTh, nameEn, parentId }[]`, `orderBy: nameEn asc`, `take: 100` (bounded — see Scale below).
- Authz: none — matches the sibling `/api/locations/search` (public Thai administrative reference data, no PII, no ownership dimension).
- Error codes: `400` invalid/missing `districtCode` (zod boundary) · `500` internal (generic message; detail logged server-side only via `apiError`, never in the response).
- Confirmation: `__tests__/cam-559-cascading-location.test.ts` — asserts the Prisma `where` clause is `{ level: 'SUBDISTRICT', parent: { level: 'DISTRICT', code: districtCode } }` (never an unscoped query), a Thai `q` reaches the `OR` name-match clause, `take <= 100`, and a missing `districtCode` returns `400` with zero Prisma calls.

### `POST /api/location` (`app/api/location/route.ts`) — unchanged method/path/authz, one additive field
- `subDistrict?: string` — trimmed, max 100 chars (mirrors `district`'s CAM-553 contract). Optional, backward-compatible-by-addition (api.md §12).
- Confirmation: `__tests__/cam-559-cascading-location.test.ts` asserts `subDistrict` reaches `prisma.location.create`'s `data` argument.

### `PUT /api/campsites/[id]` (`app/api/campsites/[id]/route.ts`) — CAM-556 fix, same method/path/authz
- Previously: `province`/`district`/`subDistrict` are NOT part of `campSiteSchema` (they live on the related `Location` row) — the route read `(body as any).province` directly, unvalidated, and wrote ONLY `province` to `Location.update`. `district`/`subDistrict` never reached the database on an edit, regardless of what the form sent.
- Now: a dedicated boundary schema, `updateCampSiteLocationSchema` (`lib/validations/location.ts`) — `{ province?, district?, subDistrict? }`, each trimmed/max-100/optional — validates the three location fields off the raw body BEFORE any write. All three are written with the CAM-341/CAM-360 clearing pattern: a key present with `""` maps to `null` (explicit clear); a key entirely absent is a true no-op skip (never touches the column). Error codes: `400` invalid input (any field over 100 chars, or the wrong type) · unchanged `401`/`403`/`404` from `requireCampSitePermission` above it in the handler.
- Confirmation: `__tests__/cam-559-cascading-location.test.ts` — **Prove-It, RED-first**: reverting the fix (the `province`-only truthy-gated block) makes every "district/subDistrict reach `prisma.location.update`" assertion fail (confirmed by hand before writing the fix, same shape as CAM-553's `__tests__/cam-553-location-write-path.test.ts`); the suite is GREEN after. A regression test also proves `province` still writes correctly alongside the two new fields (never weakened).

## Scale (7,452 sub-districts — never one payload)

Every level loads on demand, server-side, scoped:

| Level | Source | Scope | Typical/worst-case row count returned | Payload size (rough) |
|---|---|---|---|---|
| Province | `ThailandLocation` (existing) | none (nationwide, but capped `take: 20` by the existing endpoint) | ≤ 20 rows | ~2 KB |
| District | `ThailandLocation` (existing) | `provinceCode` | a province holds ~12 districts on average, ~50 max (Bangkok) | well under 5 KB |
| Sub-district | `AdminArea` (new) | `districtCode` | a district holds ~8 sub-districts on average, low dozens max | well under 5 KB |

No level ever returns the full 77/930/7,452-row table in one response — the client only ever asks for a slice scoped to the parent already picked, and each level's own search box additionally narrows within that slice server-side (never a client-side fuzzy-filter over an unbounded list). Each level's fetch is lazy (only fires once that level's popover opens) and debounced 300ms (matches the pre-existing search-box precedent in the old `LocationPicker`).

## ADRs

No new ADR — this is an additive UI + write-path fix on an already-decided data model (CAM-553's AdminArea-vs-ThailandLocation split, unchanged here). The two-table sourcing rationale above documents the decision inline since it directly answers the ticket's explicit blast-radius constraint (BR-4 in `story.md`).

## Sibling test drift — flagged, then fixed (file surface expanded by the coordinator)

Two suites pinned the OLD flat single-search `LocationPicker` implementation detail-for-detail. Both were initially outside this story's allowed file surface (`__tests__/cam-559-*.test.ts` only) and were flagged rather than silently edited; the coordinator then expanded the surface to exactly these two files (leaving CI red was not an option, and the exact fix was already known) with one instruction: **update the assertions to describe the new UI — do not delete or loosen them.**

- `__tests__/menu-hover-contrast.test.ts` (`AC-loc-subtitle`) — asserted a `text-xs text-foreground/70` "subtitle" span existed under a combined province+district row (the old design showed a district row's parent province as a secondary line). That two-line row genuinely no longer exists (each cascading level is already scoped by its parent, so no secondary-context line is needed). Fixed by restating the assertion as the INVARIANT it always protected: no `CommandItem` pairs the `hover:bg-accent/15` tint with the lower-contrast `text-muted-foreground` (the exact bug class this guard exists to catch), plus a positive check that every row's label renders at full-strength `text-foreground` — stronger than the retired `/70` subtitle tone, not weaker.
- `e2e/regression/ac5-create-camp.spec.ts` — located the province trigger via `page.getByText("พิมพ์ชื่อจังหวัดหรืออำเภอ...")` (the old trigger button's own placeholder-as-label text, gone in the new design — the unselected trigger now shows the level name `จังหวัด`, and the search placeholder only appears inside the open popover). Fixed by switching the locator to `page.getByTestId("btn--location-picker-province")` (added by this story specifically as a stable e2e/QA hook) to open, then `page.getByTestId("row--location-picker-province-option").first()` to pick.

Confirmation: `npx vitest run __tests__/menu-hover-contrast.test.ts` green (23/23) after the fix; the e2e spec's new testids were confirmed present in `components/LocationPicker.tsx` by grep (not run — no Playwright browser/dev-server/DB session available in this environment, consistent with this story's self-verify scope). Full suite re-run as the last act, post-rebase onto `dev` (picked up CAM-548/549/550/552): 9757/9758 pass — `__tests__/delivery-client.test.ts` (env-dependent, pre-existing) is the ONLY remaining failure.

## Forward-looking — CAM-562 (reverse-geocode backfill) canonical-format risk

`province`/`district`/`subDistrict` are written in whatever UI language was active at save time (the pre-existing, deliberately-preserved quirk — see BR-4/story.md) — so existing and newly-created rows can be a mix of Thai/English text for the same conceptual place. A future backfill (CAM-562) matching against this same `AdminArea`/`ThailandLocation` master data should not assume a single canonical language across existing rows; it will need the same bilingual name-based lookup CAM-545 already built for `province` (`getProvinceThaiNameMap`/`withProvinceThaiNames`), not a fresh consistency assumption, if it wants exact-equality matching (e.g. `lib/campsite-filters.ts`'s district filter) to work uniformly. No code change made here — flagged for that story's own Discovery.

## Links
`prisma/schema.prisma` · `story.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-553-thai-location-master-data/tech.md` (the AdminArea-vs-ThailandLocation model decision this story builds on, unchanged)

## Changelog
- v1 (2026-07-26) — created
- v2 (2026-07-26) — coordinator expanded the file surface to the two flagged sibling suites; both fixed (updated to describe the new UI, not weakened) instead of left flagged. Rebased onto `dev` (CAM-548/549/550/552); confirmed CAM-548's `CampgroundDetailClient.tsx` unaffected. Added the edit-prefill-gap finding and the `Location.province` byte-identical confirmation method; added the CAM-562 canonical-storage-format forward-looking note.
