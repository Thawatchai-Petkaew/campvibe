---
ticket: CAM-518
epic: CAM-512
title: Derived Camper-Type facet — beginner/intermediate/pro from the shop's own data (S6)
class: standard-story
version: 1
---

# CAM-518 — Derived Camper-Type facet (S6)

## Story

As a **camper** asking "ลานนี้เหมาะกับมือใหม่ไหม", I want the assistant to answer from the camp's OWN attributes (not a stored tag), so that it can say "เหมาะกับมือใหม่ เพราะมีน้ำอุ่น เช่าอุปกรณ์ได้ ขับรถถึง เป็นแกลมปิ้ง" — a composed, evidence-backed judgment.

Scope: compute-on-read logic in `lib/facet-scores.ts` only — (1) enrich the existing `beginner` facet to compose the NEW comfort signals added by S1-S5, and (2) add a `camper_type` facet that derives which camper type (BEGN มือใหม่ / INMD มือเก่า / PROF มืออาชีพ) a camp best suits, with evidence + confidence. Owner rule: **Camper Type is DERIVED, never stored** — no schema, no column, no migration.
Depends on: S1-S5 (the comfort/style/type codes it composes now exist).

Why: owner — "Camper Type... เราจะวิเคราะห์จากข้อมูลของร้านนั้นๆ". The existing `beginner` facet predates the taxonomy completion and ignores HOTW/GLAMP/CHIC/LIGT; enriching it + adding the pro/intermediate end is the composition that makes an intent-answer correct.

## AC

| # | Given | When | Then | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp with gear-rental + HOTW + GLAMP + drive-up | `computeFacetScores` runs (getCampDetail/compareCamps) | The `beginner` facet scores high with evidence naming the new comfort codes; the `camper_type` facet resolves to BEGN | derived on read, no DB write | AC-3 |
| AC-2 | A rustic camp: DIFT/IDMT style, hike/walk access, minimal facilities, no gear | facets run | `camper_type` resolves toward PROF (or INMD) with evidence; `beginner` scores low/omitted | derived on read | — |
| AC-3 | A camp with too little signal | facets run | `camper_type` is OMITTED (confidence < ANSWERABLE_CONFIDENCE) — no guess | honesty gate, per existing BR | EC-1 |

## Rules

- BR-1: **Enrich `beginner`** — add weights for the new comfort signals to `BEGINNER_WEIGHTS` + scoring: HOTW (hot water), GLAMP (campSiteType — pre-set comfort), CHIC (camper-style สบาย), LIGT (night lighting), RESV (reservable). Keep the existing driveUp/toilet/shower/power/water/food/gearRental weights. Evidence strings name the codes that fired (existing evidence pattern).
- BR-2: **New `camper_type` facet** — add `'camper_type'` to `FacetId`, a `computeCamperTypeFacet(input)` (template = `computeBeginnerFacet`/`computeRoadAccessFacet`), register in `FACET_COMPUTERS` (satisfies-Record enforces it) + `FACET_ORDER`. It weighs COMFORT signals (gear-rental, HOTW, TOIL/SHOW, DRIV, GLAMP, CHIC, LIGT, ELEC/WATE) toward BEGN and HARDSHIP signals (camper-style DIFT/IDMT, access HIKE/WALK, no gear, rustic terrain FORE/MTNS/CAVE, minimal facilities) toward PROF; the middle = INMD. Output the resolved label in the facet's result (reuse the `FacetScore` shape — put the label in the facet's evidence/summary field per the existing shape; if the shape can't carry a categorical label, extend it minimally + keep existing consumers compiling).
- BR-3: **Honesty gate unchanged** — `confidence = firedSlots / SLOT_COUNT`; omit the facet when `confidence < ANSWERABLE_CONFIDENCE`; mandatory non-empty `evidence[]` or omit (existing BR).
- BR-4: **Input shape unchanged** — reads `FacetScoreInput { options:{code,group}[], minimumAge }` (+ campSiteType if needed — thread it into the input if GLAMP must be read; the caller `get-camp-detail.ts` already has campSiteType in scope, add it to the input type + the mapping). No new query.
- BR-5: Compute-on-read, DETAIL/compare-side only (not `buildCampSiteWhere`) — same as the existing facets. (Search-side composition is S7.)

## Edge cases

- EC-1: a camp with < SLOT_COUNT×ANSWERABLE_CONFIDENCE fired signals → `camper_type` omitted (no low-confidence guess).
- EC-2: adding `'camper_type'` to `FacetId` WITHOUT a `FACET_COMPUTERS` entry = a compile error (the `satisfies Record<FacetId,…>`) — register it.

## Data

None — pure derivation. If GLAMP (campSiteType) must be read, thread `campSiteType` into `FacetScoreInput` + the caller mapping (`lib/ai/tools/get-camp-detail.ts`, `compare-camps.ts`) — no schema change.

## Seams & refs

- `lib/facet-scores.ts` — `FacetId:30`, `BEGINNER_WEIGHTS:87`, `computeBeginnerFacet` (~:190-256, the template), `computeRoadAccessFacet:270-299` (single-dimension example), `FACET_COMPUTERS:306`, `FACET_ORDER:313`, `computeFacetScores:321`, `ANSWERABLE_CONFIDENCE:70`, `GEAR_RENTAL_GROUP:106`, `FacetScoreInput:60`.
- Callers to keep compiling + optionally thread campSiteType: `lib/ai/tools/get-camp-detail.ts`, `lib/ai/tools/compare-camps.ts:~335`.
- Tests: existing facet tests (grep `__tests__` for facet-scores) — extend + add a `__tests__/cam-518-camper-type-facet.test.ts`: a comfort-loaded camp → BEGN + evidence; a rustic camp → PROF/INMD; a sparse camp → omitted (EC-1); the enriched beginner facet fires on HOTW/GLAMP/CHIC. Prove teeth.

## Out of scope

- Search-side ranking by the facet — S7.
- Storing Camper Type (explicitly forbidden by owner).

## Self-verify

- [ ] `npx tsc --noEmit` + `npm run lint` clean; facet tests + `cam-518` green + teeth
- [ ] `camper_type` registered (compiles) + omitted on low confidence; beginner facet now composes HOTW/GLAMP/CHIC/LIGT with evidence
- [ ] callers still compile; no schema/column/migration
