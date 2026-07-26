---
ticket: CAM-521
epic: CAM-512
title: Metadata groups — stay-connected, marking-method, driveway (S8)
class: standard-story
version: 1
---

# CAM-521 — Metadata groups (S8, final taxonomy slice)

## Story

As a **host**, I want to record my camp's phone signal, spot-marking method, and driveway type, and have campers see them on the camp page, so that the taxonomy from the v1 spec is complete — even though these aren't search dimensions.

Scope: 3 NEW MasterData groups delivered **host-input + camper-detail-display only** — seed + CampgroundForm + CampgroundDetailClient section + i18n. Deliberately **NOT searchable** (excluded from FilterModal, no `searchCampsites` filter param, no catalog-pipeline wiring) — these are metadata, not search dimensions (nobody filters camps by "driveway = pull-through"). NO migration.
Depends on: — . Final slice of CAM-512.

Why: v1 designed these 3 groups; they complete the host data-entry taxonomy. Making them searchable would add inert FilterModal chips + full pipeline wiring for zero real search demand — if signal-filtering demand ever appears, the `/ai-chat-improve` loop surfaces it as a future slice.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The 3 groups seeded | host opens CampgroundForm | 3 new multiselects appear (สัญญาณ / วิธีจองพื้นที่ / ทางเข้ารถ) with Thai labels | selections round-trip on save/edit | EC-2 |
| AC-2 | A camp has these set | camper opens the detail page | The values render (label + icon) in a camp-info section | from MasterData/i18n | EC-1 |
| AC-3 | A camper opens the filter modal | — | These 3 groups do NOT appear as filter sections (no inert chips) | excluded from FilterModal | — |

## Rules

- BR-1: **Groups + codes** (global-PK-unique; verify none collide):
  - `Stay connected` (สัญญาณโทรศัพท์): `SAIS` AIS / `SDTC` DTAC / `STRU` TRUE — icon `Signal` (or per-brand valid lucide).
  - `Marking method` (วิธีจองพื้นที่): `YUSF` เลือกเอง / `OWNE` เจ้าของจัดให้ — icons e.g. `Hand` / `UserCheck`.
  - `Driveway` (ทางเข้ารถ): `BACK` ถอยเข้า(หลังลาน) / `PARA` ขนานลาน / `PTHG` ขับผ่าน(pull-through) — icons e.g. `CornerDownLeft` / `AlignHorizontalJustifyCenter` / `MoveRight`.
- BR-2: **Host input** — mirror the S3/S4 host wiring for each group: `lib/validations/campsite.ts` gets `stayConnected`/`markingMethod`/`driveway` as `z.array(z.string()).optional()`; `CampgroundForm.tsx` gets each group's ~6 touchpoints (state, renderOptionGroup call, edit-prefill `_byGroup`, payload, label/section maps, completeness if applicable); POST + PUT routes add the 3 fields to their `resolveOptionConnect([...])` arrays (PUT incl. the `replacesOptions` guard for each).
- BR-3: **Camper display** — a camp-info section in `CampgroundDetailClient.tsx` rendering these groups (a small "ข้อมูลเพิ่มเติม" block via `codesByGroup(...)`); icons in the detail icon map. i18n: `filter.<CODE>` + `filter.<GroupName>` (en+th) for all 3 groups.
- BR-4: **NOT searchable — the key differentiator** — do NOT add a `searchCampsites`/bulk-availability filter param, do NOT wire `campsite-filters.ts`, do NOT touch the catalog pipeline. **EXCLUDE the 3 group names from the FilterModal** so they don't render as inert sections (find how FilterModal lists sections from `getFilterOptions` — add these 3 to its exclude/skip list, or a filterable-group allowlist). Verify the FilterModal does NOT show them.
- BR-5: **Seed** — gen-mock assigns these per camp (a signal or two, a marking method, a driveway for car-camps) so detail pages have data; BR-3 guarantee floor so none is 0. (Realism: driveway mainly on CACP car-camps.)

## Edge cases

- EC-1: icons in the detail icon map or generic fallback; real lucide exports.
- EC-2: partial PUT omitting a group must not wipe its options (the `replacesOptions` guard includes each new key).

## Data

8 MasterData rows (3 new groups). No schema change. gen-mock + reload fixture.

## Seams & refs

- Seed: `prisma/seed.ts` (3 new group blocks).
- Host: `lib/validations/campsite.ts` (3 optional fields) · `components/CampgroundForm.tsx` (per-group touchpoints) · `app/api/campsites/route.ts` + `[id]/route.ts` (connect arrays + PUT guard).
- Camper: `components/CampgroundDetailClient.tsx` (info section + icon map) · `locales/translations.json` (codes+groups en+th).
- **FilterModal exclude:** `components/FilterModal.tsx` — the section list source (`getFilterOptions`) + wherever `sortOrder`/known-groups are enumerated; add the 3 groups to an exclude so no inert chips.
- Seed: `scripts/gen-mock-data.mjs` (pools + BR-3 floor) → regenerate + merge.
- Tests: `__tests__/cam-521-*.test.ts` — host round-trip (create→edit) for the 3 groups, EC-2 partial-PUT guard, and a FilterModal assertion that the 3 groups are NOT rendered as filter sections. Prove teeth.

## Out of scope

- Making any of these searchable (future, demand-driven via `/ai-chat-improve`).
- Reconciling the parallel `app/api/campgrounds/*` legacy route dead-code (separate follow-up).

## Self-verify

- [ ] `npx tsc --noEmit` + `npm run lint` clean; `npx vitest run __tests__/cam-521-*.test.ts __tests__/cam-356-*.test.ts __tests__/cam-365-*.test.ts __tests__/cam-408-*.test.ts` green + teeth
- [ ] 3 groups: host form round-trips, detail renders, i18n en+th, icons; FilterModal does NOT show them (BR-4); NO searchCampsites/campsite-filters/catalog change
- [ ] seed counts >0 per code; no migration
