---
ticket: CAM-515
epic: CAM-512
title: Annotated features group — alcohol/fire/firewood/accessible/reservable (S3)
class: standard-story
version: 1
---

# CAM-515 — Annotated features group (S3)

## Story

As a **camper**, I want to find camps by their rules/features — can I drink alcohol (ดื่มเบียร์), light a fire (ก่อไฟ), is there firewood, is it wheelchair-accessible, can I reserve ahead — so that "ลานจิบเบียร์ริมธาร" or "ลานก่อไฟได้" returns the right places, and the assistant has these as ingredients to compose an intent.

Scope: a NEW MasterData group `Annotated features` (5 codes) delivered full-stack — seed + AI search filter + host form + camper display + i18n. This is the FIRST new-group slice; it is the template S4 will mirror. NO migration (group is a String, options m2m exists).
Depends on: —.

Why: cycle-1 "ลานริมธาร ตั้งโต๊ะจิบเบียร์" got 0 — จิบเบียร์ has no data home. The v1 spec designed "Annotated features"; it was never implemented. Reconciled + localized: Free→`isFree` column, Pets→`petFriendly` column, Bigrig→`accommodationTypes=RECR`, Mobileservice→Stay-connected (later slice) — so this group carries only the 5 that have no existing home.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camps tagged ALCO exist | assistant/camper searches `annotatedFeatures=ALCO` | Only alcohol-allowed camps return | `buildCampSiteWhere` filters options m2m by code | AC-4 |
| AC-2 | The group is seeded | host opens `CampgroundForm` | A new "Annotated features / คุณลักษณะ" multiselect appears with the 5 options + Thai labels | selections round-trip on save/edit | EC-2 |
| AC-3 | A camp has annotated features | camper opens detail + filter modal | A new "คุณลักษณะ" section shows the features w/ label+icon; a filter chip filters by it | rendered + URL-param wired | EC-1 |
| AC-4 | Asked "ลานจิบเบียร์ได้" / "ลานก่อไฟได้" | assistant searches | Sets `annotatedFeatures=ALCO` / `FIRE` | real result, not a keyword miss | — |

## Rules

- BR-1: **Group + codes** (`group:'Annotated features'`):
  | code | nameTh | nameEn | icon (real lucide, add to all maps) |
  |---|---|---|---|
  | ALCO | ดื่มแอลกอฮอล์ได้ | Alcohol allowed | Wine |
  | FIRE | ก่อไฟได้ | Fires allowed | Flame |
  | FIWD | มีฟืนขาย/บริการ | Firewood | Logs (or Trees if Logs absent) |
  | ADAA | รองรับผู้พิการ | Accessible (ADA) | Accessibility |
  | RESV | จองล่วงหน้าได้ | Reservable | CalendarCheck |
- BR-2: New codes are a global PK — none collide (verified: ALCO/FIRE/FIWD/ADAA/RESV new).
- BR-3: **AI search** — new filter arg `annotatedFeatures`: add `ANNOTATED_CODES` const + a zod field + jsonSchema property w/ Thai-trigger description (จิบเบียร์/แอลกอฮอล์→ALCO, ก่อไฟ→FIRE, ผู้พิการ→ADAA…) in `search-campsites.ts`; add the param passthrough in the `buildCampSiteWhere({...})` call; add a `annotatedFeatures` field to `CampSiteFilterParams` + one `addOptionFilter(annotatedFeatures)` call in `lib/campsite-filters.ts`. Sync `bulk-availability.ts` the same way (new arg + code list) for consistency.
- BR-4: **Host form** — `campSiteSchema` gets `annotatedFeatures: z.array(z.string()).optional()`; `CampgroundForm.tsx` gets the group's ~6 touchpoints (state field, a `renderOptionGroup(...,'Annotated features','annotatedFeatures')` call, edit-prefill `_byGroup('Annotated features')`, payload line, label/section maps, publish-completeness set if it should count); POST route adds the field to its `resolveOptionConnect([...])` array; PUT route adds it to BOTH the `replacesOptions` guard array AND the `resolveOptionConnect([...])` array.
- BR-5: **Camper display** — FilterModal: wire the group into the 3 hardcoded URL-map spots (count effect, hydration effect, apply handler) + `sortOrder` + `activeFilterCount` arrayParams so its chips actually filter; add a bespoke "คุณลักษณะ" section to `CampgroundDetailClient.tsx` (`codesByGroup('Annotated features')`). i18n: `filter.ALCO`…`filter.RESV` AND `filter."Annotated features"` (group heading) in BOTH en+th; icons in all 3 maps.
- BR-6: **Seed diversity** — gen-mock theme pools (a new pool key per theme, e.g. `annotated`) + BR-3 guarantee list `{field:'annotatedFeatures', codes:[...]}` so each code >0, ~15-45% spread (ALCO/FIRE common; ADAA rarer). Realistic: FIRE common in rustic themes, ALCO common in chill/beach, ADAA in developed.

## Edge cases

- EC-1: icons missing from any of the 3 maps → generic fallback; add to all.
- EC-2: a partial PUT that doesn't carry `annotatedFeatures` must NOT wipe the relation — the `replacesOptions` guard (route `[id]:80`) must include the new key so it only replaces options when a taxonomy key is present.

## Data

5 `MasterData` rows (new group), no schema change. gen-mock + reload fixture.

## Seams & refs

- Seed: `prisma/seed.ts` (append a new group block).
- Search: `lib/ai/tools/search-campsites.ts` (ANNOTATED_CODES + zod + jsonSchema + passthrough) · `lib/ai/tools/bulk-availability.ts` (mirror) · `lib/campsite-filters.ts:3-50,159-190` (param + addOptionFilter).
- Host: `lib/validations/campsite.ts:51-148` · `components/CampgroundForm.tsx:228-235,313-326,536-601,1195-1201,114-165,184-185,748-755` · `app/api/campsites/route.ts:190-193` · `app/api/campsites/[id]/route.ts:80-85`.
- Camper: `components/FilterModal.tsx:64-232,108-116,334` · `components/CampgroundDetailClient.tsx` (new section + icon map :470-532) · `lib/facility-icon-map.ts` · i18n `locales/translations.json` (en+th).
- Seed: `scripts/gen-mock-data.mjs` (theme pools + BR-3 list) — regenerate + `merge-mock-data.mjs`.

## Out of scope

- Free/Pets (already columns) · Bigrig (RECR) · Mobileservice (→ Stay-connected in S5) · CategoryBar/SearchModal home pills.

## Self-verify

- [ ] `npx tsc --noEmit` + `npm run lint` clean; `npx vitest run __tests__/cam-408-*.test.ts __tests__/cam-465-bulk-availability*.test.ts __tests__/cam-493-*.test.ts` green
- [ ] `annotatedFeatures` filters end-to-end: search arg → where-clause; host form round-trips (create→edit); FilterModal chips produce a URL param; detail section renders
- [ ] seed counts per code discriminating (~15-45%, none 0); i18n code+group en+th; icons in 3 maps
- [ ] PUT partial without the key does not wipe options (EC-2)
