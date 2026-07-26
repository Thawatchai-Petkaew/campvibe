## Story
As a **Camper**, I want the camp detail page to show every taxonomy fact a host actually entered (activities, pet policy, and a clearly labeled site type), so that I can tell what I can do there, whether I can bring a pet, and what kind of place it is, without guessing from an unlabeled icon.

Why: post-CAM-512 read-only sweep found `Activity` is never bucketed on detail (the ~10 `codesByGroup` calls omit it, though the AI-chat card already shows activities), `petFriendly` is saved + prefilled on the host form but rendered nowhere on detail, and `campSiteType` is an unlabeled tile mixed into "Site Types" alongside Terrain.

Scope: `components/CampgroundDetailClient.tsx` read-side rendering only (no schema/API/host-form change). Extract the copy-pasted icon+label tile block into a shared `OptionGroupSection` primitive as a pure, zero-visual-change refactor for the migrated sections, then add the 3 new surfacing items on top of the clean base.

Depends on: CAM-525 (S9, icon+i18n unification — `lib/facility-icon-map.ts` now carries the 5 Activity icons + the fixed Campground-type/POTA/MTNS entries this story needs; merged to `dev` first).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camp has ≥1 `Activity` MasterData code (e.g. `HIKI`, `WILD`) in `options` | Camper opens the camp detail page | A section headed `กิจกรรม` shows one tile per activity with its icon + Thai label (e.g. `เดินเล่น`, `ส่องสัตว์ป่า`) — never the raw code string | No write; read-only render off the existing `options` relation | EC-1 |
| AC-2 | Camp has `campSiteType` set (e.g. `GLAMP`) | Camper opens the camp detail page | A section headed `ประเภทแคมป์` shows one tile (icon + `กลามปิ้ง`), separate from the `ประเภทลานกางเต็นท์` (Terrain) section | No write; read-only render off the existing scalar column | EC-2 |
| AC-3 | Camp has `petFriendly = true` | Camper opens the camp detail page and looks at the "ข้อควรรู้" (good-to-know) card | A row shows `อนุญาตสัตว์เลี้ยง` | No write; read-only render off the existing scalar column | EC-3 |
| AC-4 | Camp has ≥1 Terrain code but no `campSiteType` | Camper opens the camp detail page | The `ประเภทลานกางเต็นท์` section shows only the terrain tiles; no `ประเภทแคมป์` section appears | No write | EC-2 |

## Rules
- BR-1 The 7 sections that already use the copy-pasted icon+label tile shape (Terrain, the new campSiteType section, Annotated features, Camper style, Stay connected, Marking method, Driveway) render through the shared `OptionGroupSection` primitive with byte-identical classes/markup to their pre-refactor form — this half of the story is a pure, zero-visual-change refactor (proves AC-4, and every pre-existing AC these sections originally shipped under, e.g. CAM-515/516/521).
- BR-2 `campSiteType` (a single scalar column, not part of the `options` relation) never renders inside the Terrain tile grid again — it gets its own heading, `t.filter["Campground type"]` (proves AC-2, AC-4).
- BR-3 `petFriendly` renders only when `true`; `false`/unset shows nothing (absence is the correct default state — it does not assert "pets not allowed") (proves AC-3, EC-3).
- BR-4 The Activity section uses the same icon+label tile primitive and the same empty-section gate pattern as every other taxonomy group on this page (`codes.length > 0`) (proves AC-1, EC-1).
- BR-5 The derived Camper-Type facet (`BEGN`/`INMD`/`PROF`, `lib/facet-scores.ts`) is out of scope for this story and must not be imported or rendered here — it stays AI/search-only (owner decision 2026-07-26).

## Edge cases
- EC-1 IF a camp has zero `Activity` codes THEN no Activity section renders (no heading, no empty grid) (BR-4)
- EC-2 IF a camp has no `campSiteType` set THEN no `ประเภทแคมป์` section renders (BR-2)
- EC-3 IF `petFriendly` is `false` or unset THEN no pet-friendly row renders in the good-to-know card (BR-3)

## Data
- No schema/migration change. Reads: `CampSite.options` (existing m2m, filtered by `group === 'Activity'`), `CampSite.campSiteType` (existing scalar column), `CampSite.petFriendly` (existing scalar boolean column). Migration: none.

## Seams & refs
- Reuse: `getFacilityIcon` (`lib/facility-icon-map.ts`, CAM-525 — read-only, not modified by this story) for every tile icon; `t.filter[code]` (`locales/translations.json`) for every tile label, both already seeded for Activity codes (CAM-525). New shared primitive: `components/ui/option-group-section.tsx` (extracted from `CampgroundDetailClient.tsx`'s repeated tile block — no existing `components/ui/*` primitive covers "heading + icon/label tile grid", confirmed against `DESIGN.md` §3.1 Component Index before creating it).
- Refs: research plan `research-user-jolly-mochi.md` §"S1 · Detail page"; CAM-525 (icon/i18n unification, dependency); CAM-517/520 (campSiteType is a single scalar, not a relation — do not re-introduce a multi-value bridge).

## Out of scope
- Filter/discovery-side taxonomy surfacing (home category tabs, ActiveFilters chips) → CAM-529/CAM-530 (S2/S3 of the same plan).
- `accommodationTypes` display → CAM-531 (S10, owner-approved "ทำให้จบ" slice).
- Camper-Type derived facet display → explicitly not carded; AI/search-only per owner decision.
- `AmenitiesModal.tsx`'s own `getIcon`+label rows → a separate, later consolidation (not this page).

## Self-verify
- AC-1..4 → unit/source-inspection (component test harness precedent for this exact file, see Seams & refs) — `components/CampgroundDetailClient.tsx` has no isolated render harness (>10 mocked module boundaries: `next-auth`, `next-themes`, 2× `next/dynamic`, `LanguageContext`, `sonner`, `date-fns` locale) per the established precedent in `cam-353-detail-spot-section.test.ts` / `cam-268-price-fee-cancellation-policy.test.ts` / `f3-detail-surface.test.ts` — this story follows the same source-inspection + pure-logic-gate-truth-table strategy, cross-checked against the real shipped conditional text.
- Story-specific: the BR-1 zero-visual-change refactor is proven by asserting the exact className strings the primitive renders match the pre-refactor literals for each migrated section.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-26) — created
