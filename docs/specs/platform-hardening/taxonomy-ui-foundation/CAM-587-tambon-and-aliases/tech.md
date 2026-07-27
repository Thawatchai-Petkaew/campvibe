---
linear: CAM-587
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Camper
artifact: tech
owner: backend-engineer
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — The assistant can search by district, sub-district, and place alias (CAM-587)

## Data model
No new entity/field. Reuses `AdminArea` (`prisma/schema.prisma`, PROVINCE/DISTRICT/SUBDISTRICT, CAM-553/562) and `Location.adminAreaId` (already the deepest-resolved level for a camp, CAM-563/566 convention). Reuses `prisma/data/place-aliases.json` (PR #673, data-only until this story) exactly as authored — no entries added.

## API contract
`searchCampsites` tool (`lib/ai/tools/search-campsites.ts`) — no HTTP route change, this is the AI tool-call contract (`executeSearchCampsites(args): Promise<{ cards: SearchCampsiteCard[] }>`).

New optional args (zod, additive — existing callers unaffected):
- `district?: string` — Thai/English อำเภอ name or a `place-aliases.json` zone alias (e.g. "หัวหิน", "อ.หัวหิน").
- `subDistrict?: string` — Thai/English ตำบล name.

Resolution (see `resolveExactInsideAdminAreaIds`, invoked only when `near` is unset and at least one of `district`/`subDistrict` is set):
1. `province` (if also given) → `resolveProvinceForSearch` (existing, now alias-aware) → `matchAdminArea(prisma,'PROVINCE',…)` → a `provinceParentId` scoping hint. Unresolvable → whole lookup returns `null` (honest empty), never silently unscoped.
2. `subDistrict` (if set) → `district` (if also given) resolved first via step 3 for scoping → `matchAdminArea(prisma,'SUBDISTRICT', subDistrict, districtParentId)` → one id, or `null`.
3. `district` alone → `resolveZoneAliasToDistrict` (place-aliases.json zoneAliases) first, falling through to the raw name → `matchAdminArea(prisma,'DISTRICT', name, provinceParentId)` → `[districtId, ...listChildAdminAreaIds(SUBDISTRICT, districtId)]`, or `null`.

`null` at any step → `executeSearchCampsites` sets `cards = []` directly (no query runs). A resolved id-set is ANDed onto `buildCampSiteWhere`'s own output: `where.AND.push({ location: { adminAreaId: { in: ids } } })` — the exact same "extend, never fork" pattern the existing `near` geo-path already uses for its own bbox clause.

Alias wiring (`lib/ai/place-aliases.ts`, new module):
- `resolveProvinceAliasToCanonicalTh(value)` — consulted first inside `resolveProvinceForSearch`, ahead of the pre-existing `BANGKOK_ALIASES` map. Skips `canonicalCode "10"` (Bangkok) — see story.md BR-6.
- `resolveRegionAliasToCanonicalPhrase(value)` — consulted inside a new `resolveRegionForSearchWithAlias` wrapper, translating a `regionAliases` hit to one of the 6 formal `ภาค`-prefixed phrases `lib/thai-regions.ts`'s own `REGION_ALIASES` table already expands (no duplicated province-list data).
- `resolveZoneAliasToDistrict(value)` — consulted inside `resolveDistrictAdminAreaIds`, normalizing a zone alias to its canonical district name (+ province, for best-effort scoping) before the SAME `matchAdminArea('DISTRICT', …)` call a plain-named district takes.

Error/precedence set (proves BR-1/BR-2): `near` set → district/sub-district args ignored entirely. `subDistrict` set → wins over `district`/`province`/`region` (those only scope it). `district` set (no `subDistrict`) → wins over `province`/`region`. Neither set → falls through to the pre-existing `province`/`region` branches, unchanged. An unresolvable district/sub-district (or a province given only to scope one) → `{ cards: [] }`, no query.

## ADRs
None new. Extends CAM-566's shared-matcher ADR-equivalent decision (one AdminArea matcher, no forks) and CAM-463's honest-empty precedent (BR-4 there, BR-2 here).
Confirmation: `__tests__/cam-587-district-subdistrict-aliases.test.ts` — asserts (a) a sub-district-only search differs from province-only, (b) a district-only search differs from both sub-district-only and province-only (a strict subset of its province), (c) province/region/zone aliases resolve to their canonical place, (d) an unresolvable district/sub-district returns `{ cards: [] }` with zero Prisma `campSite.findMany` calls, (e) the precedence ladder (`near` > `subDistrict` > `district` > `province` > `region`) is pinned directly.

## Links
`../../feature.md` (## Architecture overview) · `prisma/schema.prisma` (`AdminArea`, `Location`) · `story.md` · `lib/geo/admin-area-match.ts` · `lib/ai/place-aliases.ts` · `lib/ai/tools/search-campsites.ts`

## Changelog
- v1 (2026-07-28) — created
