---
ticket: CAM-516
epic: CAM-512
title: Camper style group — chic/general/difficult/indomitable (S4)
class: standard-story
version: 1
---

# CAM-516 — Camper style group (S4)

## Story

As a **camper**, I want to find camps by their vibe/style — สบายสายคุณหนู (chic), ทั่วไป, ลำบาก, ทรหด — so that "ลานสบายๆ สายคุณหนู" or "ลานสายลุยทรหด" returns the right vibe, and the assistant has camper-style as an ingredient to compose an intent (CHIC feeds สะดวกสบาย/มือใหม่).

Scope: a NEW MasterData group `Camper style` (4 codes), full-stack — identical mechanics to CAM-515 (S3): seed + AI search filter (`camperStyle` arg) + host form + camper display (FilterModal URL-map + catalog pipeline + detail section) + i18n. NO migration.
Depends on: — (mirrors S3; the catalog-pipeline wiring pattern is now established from S3).

Why: v1 designed "Camper style" (host-declared vibe); never implemented. CHIC (สบาย) is a direct comfort signal for the "มือใหม่/สายสบาย" composite; DIFT/IDMT for สายลุย.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camps tagged CHIC exist | search `camperStyle=CHIC` | Only chic/comfy-style camps return | filters options m2m | AC-4 |
| AC-2 | Group seeded | host opens CampgroundForm | A "รูปแบบแคมป์" multiselect appears with 4 options + Thai labels | round-trips save/edit | EC-2 |
| AC-3 | A camp has a camper style | camper opens detail + filter | A "รูปแบบแคมป์" section + filter chip renders + filters | URL-param wired | EC-1 |
| AC-4 | Asked "ลานสบายสายคุณหนู" / "ลานสายลุยทรหด" | assistant searches | Sets `camperStyle=CHIC` / `IDMT` | real result | — |

## Rules

- BR-1: **Group + codes** (`group:'Camper style'`):
  | code | nameTh | nameEn | icon (real lucide, all maps) |
  |---|---|---|---|
  | CHIC | สบาย (สายคุณหนู) | Chic | Sparkles |
  | GENR | ทั่วไป | General | Users |
  | DIFT | ลำบาก | Difficult | TrendingUp |
  | IDMT | ทรหด | Indomitable | Flame (or Dumbbell if a distinct icon is wanted vs FIRE's Flame) |
  (Pick valid, visually-distinct lucide icons; IDMT/FIRE both suggesting Flame → give IDMT a different one e.g. `Dumbbell` or `Swords`.)
- BR-2: New codes global-PK unique (CHIC/GENR/DIFT/IDMT verified new).
- BR-3..BR-5: **Same full-stack wiring as CAM-515 (S3)** — a `camperStyle` search arg (`CAMPER_STYLE_CODES` const + zod + jsonSchema + passthrough in search-campsites.ts + bulk-availability.ts; `camperStyle` param + `addOptionFilter` in campsite-filters.ts); host form group touchpoints + validation field + POST/PUT option-connect (incl. PUT `replacesOptions` guard, EC-2); camper FilterModal URL-map (all spots) + catalog pipeline (page.tsx/CatalogResults/InfiniteScrollGrid/api GET/catalog-cursor — now an established pattern from S3) + detail section; i18n `filter.CHIC`…`filter.IDMT` + `filter["Camper style"]` en+th; icons in 3 maps.
- BR-6: **Seed diversity** — gen-mock: assign a camper style per camp correlated to theme (CHIC→beach/lake/meadow glamping-ish; DIFT/IDMT→mist/forest rustic; GENR the common default) so each code is discriminating (~15-40%), + BR-3 guarantee floor. A camp may have ONE dominant style (single-select-ish) or a small set — match how the group reads best (host picks; keep it a normal multiselect but seed ~1 per camp).

## Edge cases

- EC-1: icons in all 3 maps or generic fallback.
- EC-2: partial PUT omitting `camperStyle` must not wipe options (guard array includes the key).

## Data

4 MasterData rows (new group). No schema change. gen-mock + reload fixture.

## Seams & refs

Identical file set + anchors as CAM-515 (S3) — reuse that PR as the template. Add `camperStyle` everywhere S3 added `annotatedFeatures`. **Reuse the catalog-pipeline wiring S3 established** (page.tsx/CatalogResults/InfiniteScrollGrid/catalog-cursor/api GET) — it should now be near-mechanical to add a second dedicated param.

## Out of scope

- The DERIVED Camper *Type* (BEGN/INMD/PROF) — that is S6 (compute-on-read); Camper *style* here is host-declared, different.
- CategoryBar/SearchModal home pills.

## Self-verify

- [ ] `npx tsc --noEmit` + `npm run lint` clean; `npx vitest run __tests__/cam-408-*.test.ts __tests__/cam-461-*.test.ts __tests__/cam-465-bulk-availability*.test.ts __tests__/cam-493-*.test.ts` green
- [ ] A dedicated `__tests__/cam-516-camper-style.test.ts` (mirror cam-515's) — CAMPER_STYLE_CODES parity across tools, jsonSchema enum, buildCampSiteWhere shapes; extend cam-408/cam-461; EC-2 case in cam-365; prove teeth
- [ ] `camperStyle` filters end-to-end (search→where, host round-trip, FilterModal chip→URL param→grid, detail section); seed counts discriminating; i18n+icons complete
