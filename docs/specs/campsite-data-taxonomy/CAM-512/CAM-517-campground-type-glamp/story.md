---
ticket: CAM-517
epic: CAM-512
title: Campground-type reconcile — add glamping + view (S5)
class: standard-story
version: 1
---

# CAM-517 — Campground-type reconcile: glamping + view (S5)

## Story

As a **camper**, I want to find glamping (กลามปิ้ง) and scenic-view (วิวสวย) camps, so that "ลานแกลมปิ้ง" or "ลานวิวสวย" returns the right places — and so glamping becomes an ingredient for the "มือใหม่/สะดวกสบาย" composite (glamping = ready-set-up comfort).

Scope: reconcile the `Campground type` MasterData group (only CAGD/CACP) with `CampSiteTypeEnum` (which ALREADY has GLAMP/VIEW) by adding GLAMP + VIEW as MasterData rows and seeding camps with those `campSiteType` values. Uses the EXISTING scalar `campSiteType` column + the existing `type` search filter — NOT a new m2m group. NO migration.
Depends on: —.

Why: `lib/validations/campsite.ts` `CampSiteTypeEnum` already accepts GLAMP/LAKE/FOREST/VIEW, but the `Campground type` MasterData group only has CAGD/CACP, so hosts can't pick them, campers don't see labels, and no camp is seeded as glamping. GLAMP is the strongest comfort signal (fully-set-up, no gear) — central to the beginner composite.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camps with campSiteType=GLAMP exist | search `type=GLAMP` (or VIEW) | Only glamping/view camps return | `buildCampSiteWhere` filters the `campSiteType` column | — |
| AC-2 | GLAMP/VIEW seeded into the group | host opens CampgroundForm's Campground-type select | GLAMP + VIEW appear as selectable types w/ Thai label | saved to `campSiteType` | EC-1 |
| AC-3 | A camp is GLAMP | camper opens detail | Its type shows "กลามปิ้ง" (Site Types section) + icon | rendered from MasterData/i18n | — |
| AC-4 | Asked "ลานแกลมปิ้ง" / "ลานวิวสวย" | assistant searches | Sets `type=GLAMP` / `type=VIEW` | real result | — |

## Rules

- BR-1: Add 2 MasterData rows to `group:'Campground type'`: `GLAMP` = กลามปิ้ง / Glamping (icon: `Sparkles` or `Tent`-variant, distinct from CAGD's Tent) · `VIEW` = วิวสวย / Scenic view (icon: `Eye` or `Mountain`-variant). Codes match `CampSiteTypeEnum` verbatim (GLAMP, VIEW).
- BR-2: **Reuse the existing scalar mechanic** — `campSiteType` column + the `type` search param (already `z.string`, accepts any value). Do NOT add a new options-m2m group or a new filter param. The host Campground-type select (`CampgroundForm.tsx:~1222`, reads `masterOptions['Campground type']`) auto-shows the new rows; the camper Site-Types display (`CampgroundDetailClient.tsx:~999-1014`) auto-renders. Confirm the exact `campSiteType` storage (single value vs CSV) against the current code and match it.
- BR-3: **AI search** — extend the `type` jsonSchema description in `search-campsites.ts` (+ bulk-availability.ts) to teach GLAMP/VIEW + Thai triggers (แกลมปิ้ง/กลามปิ้ง/glamping→GLAMP, วิวสวย/วิวดี→VIEW). No enum/const change needed (type is a free string), but if a `CAMP_TYPE`-style const/enum is referenced in the tool, keep it in sync.
- BR-4: **Seed** — gen-mock: add GLAMP to comfort themes' `type` pool (beach/lake/meadow) and VIEW to scenic themes (mist/mountain), replacing a share of CAGD/CACP so GLAMP/VIEW each get a discriminating count (~8-20%; glamping is rarer than plain campground). Add to the BR-3 guarantee floor for `campSiteType` if that generator tracks it. Keep CAGD/CACP still the majority.

## Edge cases

- EC-1: GLAMP/VIEW icons added to the icon maps that render `campSiteType`; real lucide exports.
- EC-2: existing camps keep their current campSiteType — this only adds new possible values, never rewrites.

## Data

2 MasterData rows (existing `Campground type` group) + seed some camps' `campSiteType`. No schema change (CampSiteTypeEnum already lists GLAMP/VIEW). gen-mock + reload fixture.

## Seams & refs

- `prisma/seed.ts` (`Campground type` block ~:46-47) — append GLAMP/VIEW.
- `lib/ai/tools/search-campsites.ts` (`type` jsonSchema description) + `bulk-availability.ts` (mirror).
- `scripts/gen-mock-data.mjs` (theme `type` pools :78-151) — add GLAMP/VIEW; regenerate + merge.
- `locales/translations.json` — `filter.GLAMP`/`filter.VIEW` (+ the `campground.siteTypes` labels if that's the detail-section source) en+th.
- Icon maps for campSiteType (grep where CAGD/CACP icons are rendered).
- Host: `CampgroundForm.tsx` Campground-type select auto-shows (verify). `lib/validations/campsite.ts` `CampSiteTypeEnum` already has GLAMP/VIEW — no change.
- Tests: a `__tests__/cam-517-*.test.ts` asserting `type=GLAMP` filters + jsonSchema teaches GLAMP/VIEW; extend cam-408 if it pins campground-type codes; prove teeth.

## Out of scope

- LAKE/FOREST from CampSiteTypeEnum — they overlap Terrain (LAKE/FORE terrain codes now exist from S1); leave the type-enum LAKE/FOREST unseeded to avoid a confusing duplicate axis (a follow-up can decide). This slice = GLAMP + VIEW only.
- The 3 metadata groups (Stay-connected/Marking/Driveway) — S8.

## Self-verify

- [ ] `npx tsc --noEmit` + `npm run lint` clean; `npx vitest run __tests__/cam-517-*.test.ts __tests__/cam-408-*.test.ts __tests__/cam-493-*.test.ts` green + teeth proven
- [ ] `type=GLAMP` filters end-to-end; host select shows GLAMP/VIEW; detail renders the Thai label + icon; jsonSchema teaches them
- [ ] seed GLAMP/VIEW counts discriminating (~8-20%), CAGD/CACP still majority; i18n en+th; icons present
