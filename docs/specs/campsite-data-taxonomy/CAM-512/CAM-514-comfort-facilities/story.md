---
ticket: CAM-514
epic: CAM-512
title: Comfort facilities — add hot water + night lighting (S2)
class: spec-lite
version: 1
---

# CAM-514 — Comfort facilities (S2)

## Story

As a **camper**, I want to find camps that have hot water (น้ำอุ่น) and night lighting (ไฟส่องสว่างตลอดคืน), so that a comfort-seeking or beginner request can filter on them — and so the assistant has these ingredients to compose the "มือใหม่/สะดวกสบาย" intent.

Scope: add 2 codes to the existing `Internal facility` MasterData group. Data-driven — identical mechanics to CAM-513 (S1). NO migration, NO new group.
Depends on: — (mirrors S1's pattern).

Why: cycle-1 flagged hot-water as a comfort discriminator with NO existing-data home; it's a facility, so it extends the Facility group (not a new cluster). Night lighting = safety, another beginner-comfort ingredient.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camps tagged HOTW/LIGT exist | search `facilities=HOTW` (or LIGT) | Only camps with that facility return | `buildCampSiteWhere` filters options m2m | — |
| AC-2 | HOTW/LIGT seeded | host opens `CampgroundForm` | The 2 options appear in the Internal-facility multiselect (auto) + Thai label | round-trips on save/edit | — |
| AC-3 | A camp has HOTW/LIGT | camper opens detail + filter modal | Rendered with Thai label + icon; chip filters | from MasterData/i18n + icon map | EC-1 |

## Rules

- BR-1: Codes (group `Internal facility`): `HOTW` = น้ำอุ่น / Hot water (icon: a real lucide name for heat/water, e.g. `Flame` or `ThermometerSun` — pick a valid one distinct from SHOW's `ShowerHead`); `LIGT` = ไฟส่องสว่างตลอดคืน / Night lighting (icon: `Lamp` or `LampCeiling`).
- BR-2: Global-PK — HOTW/LIGT don't collide with existing codes (verified).
- BR-3: Seed diversity — add HOTW/LIGT to comfort-leaning theme pools (beach/meadow/lake/river more than mist/forest) so presence is discriminating, and to the BR-3 guarantee list (`gen-mock-data.mjs` MASTERDATA_GROUPS `facilities` entry) so each is > 0. Aim for a ~15-40% spread (NOT ~49% like the S1 WATF note, NOT 0/all).
- BR-4: `facilities` write-validation stays `z.array(z.string())` — no `campsite.ts` change.

## Edge cases

- EC-1: icon names must be added to all 3 icon maps (`lib/facility-icon-map.ts`, `CampgroundDetailClient.tsx`, `FilterModal.tsx`) and be real lucide-react exports.

## Data

2 `MasterData` rows in `prisma/seed.ts` under `group:'Internal facility'`. No schema change. Regenerate mock data.

## Seams & refs

Same file set as CAM-513 (S1) but for the Facility group:
- `prisma/seed.ts` (Internal facility block ~:8-24) — append 2 rows.
- `lib/ai/tools/search-campsites.ts` `FACILITY_CODES` (:159-162) — add HOTW/LIGT; extend the facilities jsonSchema description with Thai triggers (น้ำอุ่น→HOTW, ไฟกลางคืน/สว่าง→LIGT). Also sync `bulk-availability.ts` FACILITY_CODES if it pins them (grep — S1 found bulk-availability duplicates code lists).
- `scripts/gen-mock-data.mjs` — theme pools (`facBase`/`facExtra`) + BR-3 floor.
- `locales/translations.json` — `filter.HOTW`, `filter.LIGT` en+th.
- 3 icon maps.
- Update `__tests__/cam-408-*.test.ts` facility-code expectation if it pins the count.

## Out of scope

- New groups (later slices). The full "มือใหม่" composite is S7.

## Self-verify

- [ ] `npx tsc --noEmit` + `npm run lint` clean; `npx vitest run __tests__/cam-408-*.test.ts __tests__/cam-465-bulk-availability*.test.ts` green
- [ ] FACILITY_CODES synced across search + bulk-availability; i18n en+th; icons in 3 maps
- [ ] Regenerated mock: HOTW/LIGT counts discriminating (~15-40%, not 0/all)
