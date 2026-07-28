---
linear: CAM-615
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: host
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-28
---
# ให้โฮสต์ลบข้อมูลในฟิลด์ที่เคยกรอกได้จริง และป้องกันไม่ให้เกิดซ้ำ (CAM-615)

## Story
As a **Host**, I want clearing a field I previously filled in (a capacity limit, a price, a contact channel, a per-spot cap) and saving to actually remove it, so that my listing stops enforcing a limit I deleted, stops advertising a stale price, and stops pointing campers at a dead inbox.
Why: this exact defect class shipped twice already (CAM-341, CAM-360) as separate incidents, and a sweep of 2026-07-28 found 23 more instances — because each fix was hand-rolled per field instead of guarded structurally. `.claude/rules/api.md`'s own rule-12 note predicted a third occurrence.
Scope: `lib/validations/campsite.ts` + `lib/validations/spot.ts` (widen `.nullable()` on every clearable, user-editable nullable column) · `app/api/campsites/[id]/route.ts` + `app/api/campsites/[id]/spots/[spotId]/route.ts` (one shared `clearableWrite` mapping, replacing every hand-rolled `x || undefined`/`arrayToCsv(x)` variant) · `components/CampgroundForm.tsx` + `components/spot-form-dialog.tsx` (client sends an explicit `null` on blank, never `undefined`) · a new report-mode guard (`scripts/check-clearable-fields.mjs`) · the sibling `CampgroundDetailClient.tsx` `|| 50` free-camp display fix (CAM-351 family). No schema/migration change (every column touched was already nullable) — this story only widens the zod contract + fixes the write mapping.
Depends on: CAM-341 (extraFeeAmount/extraFeeLabel/cancellationPolicy clearing pattern) · CAM-360 (logo clearing pattern) · CAM-351 (WHOLE-CAMP capacity mode, whose >=1 save-guard this story does NOT change) — all MERGED.

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A spot has a per-spot guest cap (`maxCampers`) set | The host clears the field and saves | The save succeeds; the spot's guest cap no longer shows a number, and a subsequent reload still shows it empty | `Spot.maxCampers` is written to `NULL`, not left unchanged | EC-1 |
| AC-2 | A camp has `priceLow` set | The host clears the minimum price field and saves | The save succeeds; the price field is empty on reload, and the catalog/detail price badge no longer shows the old number | `CampSite.priceLow` is written to `NULL` | EC-1 |
| AC-3 | A camp has a LINE ID set | The host clears the LINE ID field and saves | The save succeeds; the LINE ID field is empty on reload | `CampSite.lineId` is written to `NULL` | EC-1 |
| AC-4 | A camp has any of: `phone` / `facebookUrl` / `facebookMessageUrl` / `tiktokUrl` / `videoUrl` / `partner` / `nationalPark` / `nameEn` / `description` / `address` / `directions` / `feeInfo` / `toiletInfo` / `maxTentsPerDay` / `minimumAge` set | The host clears the field and saves | The save succeeds; the field is empty on reload | The corresponding column is written to `NULL` | EC-1 |
| AC-5 | A camp has one or more tags set | The host removes every tag and saves | The save succeeds; no tags show on reload | `CampSite.tags` is written to `NULL` (not left unchanged) | EC-1 |
| AC-6 | A camp is genuinely free (`priceLow` null or 0) | A camper opens the camp detail page | The booking-widget headline shows `ฟรี`, never a fabricated `฿50` | No write; display-only | EC-2 |
| AC-7 | Any of the fields above is left untouched while the host edits a different field and saves | The host saves | The untouched field's value is completely unaffected | An omitted key in the PUT body never touches its column (REGRESSION-CRITICAL) | AC-1..AC-5 (the no-op twin) |

## Rules
- BR-1 Null-vs-omitted convention (the one shared pattern, never hand-rolled per field) — for every scalar, user-editable, nullable column: an **omitted key** (`undefined`) means "skip, leave unchanged" (protects a partial PUT from wiping a field it never sent); an **explicit `null` or `''`** means "clear the column"; any other value passes through unchanged. Server-side this is `clearableWrite()` (`lib/api-utils.ts`); client-side the equivalent is `clearableText()` (`components/CampgroundForm.tsx`) or an inline `=== "" ? null : ...`. (proves AC-1..AC-5, AC-7)
- BR-2 Array-backed CSV fields (`tags`, `nearFacilities`) don't gain `.nullable()` — an array has no "null" state distinct from empty; the fix is at the write site: `arrayToCsv(data.x) ?? null` instead of `arrayToCsv(data.x)` (which returns `undefined` on an empty array, previously read as "skip"). (proves AC-5)
- BR-3 Fields deliberately NOT made clearable, because no product action reaches a "clear" state (documented in the guard's `ALLOWLIST`, not silently left bare): `CampSite.ownershipType` (two-way toggle, no "not specified" option) · `CampSite.groundType` (a per-key counter; 0 already writes as 0) · `Spot.zone`/`Spot.zoneId` (zone detachment is an explicit round-1 scope boundary, unrelated to this story).
- BR-4 `maxGuestsPerDay`/`maxTentsPerDay` clearing to `null` means "unbounded" (`lib/campsite-filters.ts`'s existing `OR: [{gte: N}, {maxGuestsPerDay: null}]` semantics, unchanged by this story). The WHOLE-CAMP form still requires a stated value >= 1 to save (CAM-351 BR-2/AC-11) — this story does not change that guard; `null` is reachable via a PER-SPOT save or a direct API caller. (proves AC-4)
- BR-5 The guard (`scripts/check-clearable-fields.mjs`) runs in **report mode only** in this story (per `.claude/rules/ops.md`'s report-mode -> backlog 0 -> blocking rollout) — it always exits 0, prints any finding loudly, and its measured backlog is 0 as of this story. Flipping it to blocking is a follow-up once that has held across a few runs.
- BR-6 The `CampgroundDetailClient.tsx` booking-widget headline price uses the SAME `isFree` rule `CampgroundCard.tsx` already uses for the catalog card (`priceLow == null || priceLow <= 0`), not a second divergent check. (proves AC-6)

## Edge cases
- EC-1 IF a PUT request omits a clearable field's key entirely (e.g. a price-only save) THEN that field's existing value is left completely untouched (BR-1, REGRESSION-CRITICAL)
- EC-2 IF `priceLow` is a genuine positive number THEN the booking-widget headline still shows the real price + `ต่อคืน`, never `ฟรี` (BR-6 regression guard)
- EC-3 IF `maxGuestsPerDay`/`maxCampers`/etc. is sent as exactly `0` THEN the request is rejected with `400` (the field's `.min(1)` bound is unchanged — `0` is not a valid stated value, `null` is the only way to clear)

## Data
No schema/migration change. Every column touched (`CampSite.nameEn/description/address/directions/videoUrl/phone/lineId/facebookUrl/facebookMessageUrl/tiktokUrl/feeInfo/toiletInfo/minimumAge/priceLow/priceHigh/partner/nationalPark/maxGuestsPerDay/maxTentsPerDay/tags` · `Spot.viewType/maxCampers/maxTents/environment/pricePerSite/nearFacilities`) is already a nullable column in `prisma/schema.prisma` — this story only widens the zod contract (`.nullable()`) and fixes the write mapping so an explicit `null`/`''` actually reaches Prisma. · migration: none

## Seams & refs
- Reuse: `lib/api-utils.ts` `clearableWrite()` (new, shared) replaces the hand-rolled `data.x || undefined` in `app/api/campsites/[id]/route.ts` for `videoUrl/phone/lineId/facebookUrl/facebookMessageUrl/tiktokUrl/partner/nationalPark/nameEn/description/address/directions/feeInfo/toiletInfo/minimumAge/priceLow/priceHigh/logo/extraFeeAmount/extraFeeLabel/cancellationPolicy` (the last four ALSO refactored onto the shared helper, consolidating the three near-duplicate hand-rolled versions CAM-341/CAM-360 left behind). `components/CampgroundForm.tsx` `clearableText()` (new, shared) replaces `formData.partner || undefined` / `formData.nationalPark || undefined`; `priceLow`/`priceHigh`/`minimumAge`/`maxGuestsPerDay`/`maxTentsPerDay` swap `? undefined` for `? null`. `components/spot-form-dialog.tsx` swaps `? undefined` for `? null` on `viewType`/`maxCampers`/`maxTents`/`pricePerSite`.
- New: `scripts/check-clearable-fields.mjs` (report-mode) — parses `prisma/schema.prisma` for nullable scalar columns on `CampSite`/`Spot`, cross-checks each against `lib/validations/campsite.ts`/`spot.ts` for a `.nullable()` counterpart, and reports (never blocks yet) any gap not covered by its documented `ALLOWLIST`. `npm run check:clearable-fields`.
- Refs: CAM-341/CAM-360 (the two prior incidents of this same defect) · `.claude/rules/api.md` rule-12 (the rationalization row that predicted this recurrence) · `.claude/rules/ops.md` (guard rollout: report-mode -> backlog 0 -> blocking) · CAM-351 BR-2/AC-11 (the WHOLE-CAMP `maxGuestsPerDay >= 1` save-guard, unchanged) · `lib/campsite-filters.ts` (the `maxGuestsPerDay: null` = unbounded semantics this story's clearing now correctly reaches) · CAM-526 (the `arrayToCsv([]) ?? ''` precedent this story's `tags`/`nearFacilities` fix mirrors, using `?? null` since those two columns are nullable).

## Out of scope
- `CampSite.ownershipType` / `groundType` / `Spot.zone` / `Spot.zoneId` clearing → deliberately not made clearable this story (BR-3); flag to product before adding a clear path.
- The WHOLE-CAMP `maxGuestsPerDay >= 1` save-guard (CAM-351 BR-2/AC-11) → an intentional, already-shipped, already-tested product rule; not touched.
- `app/api/campsites/route.ts` POST (create) and `app/api/campsites/[id]/spots/route.ts` POST (create) → a create has no clear-intent to lose; both already forward `null`/omitted safely through the widened schema with zero code change, verified by inspection, not touched.
- Flipping `check-clearable-fields.mjs` to blocking → follow-up once the report-mode backlog (0) has held across a few runs.

## Self-verify
- AC-1 → integration (mocked-Prisma `PUT /api/campsites/[id]/spots/[spotId]`: `maxCampers: null` clears; a subsequent GET reflects it) + unit (`spotSchema` accepts null) + source-inspection (`spot-form-dialog.tsx` sends null)
- AC-2/AC-3 → integration (mocked-Prisma `PUT /api/campsites/[id]`: `priceLow`/`lineId` null clears; a subsequent GET reflects it) + unit (`campSiteSchema` accepts null) + source-inspection (`CampgroundForm.tsx` sends null)
- AC-4/AC-5 → integration (each field: `''`/`[]` clears to `null`, table-driven) + unit (zod)
- AC-6 → source-inspection (`isHeadlinePriceFree` present, old `|| 50` gone, reuses `CampgroundCard.tsx`'s `isFree` rule)
- AC-7/EC-1 → integration (REGRESSION-CRITICAL: omitting a field's key never touches it, asserted per round-trip test)
- EC-2 → source-inspection (the non-free branch still renders the real price + `ต่อคืน`)
- EC-3 → integration (`0` rejected with `400`, no write)
- Guard-specific: the guard's own unit tests prove it has teeth (a fixture missing `.nullable()` is flagged; adding `.nullable()` turns it green; an allowlisted field is excluded, not silently missing) BEFORE trusting its 0-backlog claim against the real files.
- Gate = `/quality-gate`. Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created. Root-cause fix for the third occurrence of the null-vs-omitted clearing defect (CAM-341, CAM-360, CAM-615); adds the report-mode structural guard so a 24th instance is caught, not shipped.
