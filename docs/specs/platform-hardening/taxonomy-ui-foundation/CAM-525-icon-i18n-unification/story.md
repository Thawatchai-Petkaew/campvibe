## Story
As a **Camper**, I want every facility/terrain/activity code to render its real icon and its real Thai/English label, so that I never see a raw code (`MTNS`, `POTA`) or a wrong/fallback icon on the camp detail page or in the AI-chat drawer.
Why: 3 read-only sweeps (2026-07-26, see the approved plan) found 4 competing code→icon systems that had drifted independently, plus phantom i18n keys (`MOUN`, `HIKG`) masking two real seeded codes (`MTNS`, `HIKI`) so they rendered as raw strings on the live detail page.
Scope: unify `lib/facility-icon-map.ts` as the single code→icon source of truth (consumed by both `CampgroundDetailClient.tsx` and `CampgroundForm.tsx`), add the missing icon entries, fix the phantom/missing i18n `filter.<CODE>` keys, and remove the wildcard lucide import in the host form. Does NOT touch `FilterModal.tsx`, `CatalogResults.tsx`, `InfiniteScrollGrid.tsx`, `app/page.tsx`, or any search/catalog wiring (a sibling story owns the `GROUP_REGISTRY` refactor there).
Depends on: docs research — `.claude/plans/research-user-jolly-mochi.md` §"S9 · Icon + i18n unification"

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper opens a camp's detail page for a camp whose Terrain includes `MTNS` (ภูเขา) | The Site Types section renders | The mountain icon + label `ภูเขา (ล้อมรอบด้วยภูเขา)` render (no raw `MTNS` text, no phantom-key fallback) | `getFacilityIcon('MTNS')` resolves a real lucide icon; `t.filter.MTNS` resolves a real label in both th/en | EC-1 |
| AC-2 | Camper opens a camp's detail page for a camp whose Internal facility includes `POTA` (ก๊อกน้ำ) | The "What this place offers" section renders | The water-tap icon + label `ก๊อกน้ำ` render (not the generic fallback shield icon) | `getFacilityIcon('POTA')` resolves a real (non-fallback) lucide icon | EC-1 |
| AC-3 | Camper opens the AI-chat detail drawer for a camp whose Campground type is `GLAMP`/`VIEW`/`CAGD`/`CACP` | The drawer renders the campground-type icon | The correct themed icon renders (Tent/Car/Sparkles/Eye), not the generic fallback | `getFacilityIcon(code)` for the 4 Campground-type codes resolves a real icon (same map the detail page now shares) | EC-2 |
| AC-4 | Host opens the camp listing form and a facility/terrain/activity option group is rendered | The option tiles render | Every seeded option shows its real themed icon (unchanged from before this story) | `getIconByName(opt.icon)` (name-keyed, reading `MasterData.icon`) resolves the same icon set the form rendered before, with no `import * as LucideIcons` wildcard shipped to the client bundle | EC-3 |
| AC-5 | Any developer runs the coverage test after adding a new seeded MasterData code with no icon/i18n entry | `npx vitest run __tests__/cam-525-icon-i18n-coverage.test.ts` | Test fails naming the missing code | Test suite is the enforced gate — a future drift is caught at CI, not in production | EC-4 |

## Rules
- BR-1 `lib/facility-icon-map.ts`'s `FACILITY_ICON_MAP` (code-keyed) is the ONLY code→icon source; `CampgroundDetailClient.tsx` and any other consumer call `getFacilityIcon(code)` — no per-component re-implementation (proves AC-1/AC-2/AC-3).
- BR-2 A code with no explicit `FACILITY_ICON_MAP` entry renders the generic fallback `ShieldCheck` via `getFacilityIcon`'s `?? ShieldCheck` — never throws (proves AC-2's negative path).
- BR-3 `locales/translations.json`'s `filter.<CODE>` key MUST exist in both `en` and `th` for every code seeded in `prisma/seed.ts`'s `masterData` array — no phantom key (a locale key with no matching seeded code) may mask a real seeded code (proves AC-1, BR-4).
- BR-4 `CampgroundForm.tsx` resolves an option's icon by NAME (`MasterData.icon`, e.g. `"ShowerHead"`) via the shared `getIconByName` (name-keyed `ICON_BY_NAME` export), never a wildcard `import * as X from "lucide-react"` (proves AC-4).

## Edge cases
- EC-1 IF a code has no `FACILITY_ICON_MAP` entry THEN `getFacilityIcon` returns the `ShieldCheck` fallback (never throws) (BR-2)
- EC-2 IF a code has no `ICON_BY_NAME`/icon-name entry THEN `getIconByName` returns the `HelpCircle` fallback (never throws) (BR-4)
- EC-3 IF the host form renders an option whose `MasterData.icon` name is not in the closed `ICON_BY_NAME` set THEN the tile still renders (fallback icon), never a runtime crash (BR-4)
- EC-4 IF a new MasterData code is seeded with no icon-map entry or no locale key THEN `__tests__/cam-525-icon-i18n-coverage.test.ts` fails naming the exact missing code (BR-1/BR-3)

## Data
- No schema/migration change. Touches only the read-side lookup tables: `lib/facility-icon-map.ts` (code→icon `Record`, name→icon `Record`) and `locales/translations.json` (`filter.<CODE>` string keys, en+th). `prisma/seed.ts` is read-only ground truth for this story (not edited).

## Seams & refs
- Reuse: `lib/facility-icon-map.ts`'s `getFacilityIcon`/`FACILITY_ICON_MAP` (extended, CAM-450 origin) is the single code→icon owner; `getIconByName`/`ICON_BY_NAME` (new, same file) is the single icon-NAME owner for the host form. No parallel icon map remains in `components/CampgroundDetailClient.tsx` or `components/CampgroundForm.tsx`. Refs: `.claude/plans/research-user-jolly-mochi.md` §"S9 · Icon + i18n unification" (approved plan); `.claude/rules/performance.md` CAM-200 wildcard-import lesson.
- Out of bounds (owned by sibling stories in the same epic): `components/FilterModal.tsx`, `components/CatalogResults.tsx`, `components/InfiniteScrollGrid.tsx`, `app/page.tsx`, `lib/validations/**`, `lib/campsite-filters.ts`, `lib/taxonomy-registry.ts`, `prisma/**`, `lib/ai/**`.

## Out of scope
- Rendering the Activity section on the detail page at all (CAM-528 owns that; this story only ensures the icons/labels are READY the moment it ships).
- `components/AmenitiesModal.tsx`'s own separate icon/label rows (noted as a later follow-up in the approved plan, not this story).
- Reconciling `CampSiteTypeEnum`'s unbacked codes (FOREST/LAKE/BAOT with no MasterData row) — a dead-code/vocabulary-reconcile story (S11 in the plan) owns that.

## Self-verify
- AC-1..AC-3 → unit (`__tests__/cam-525-icon-i18n-coverage.test.ts`, source-inspection + coverage-matrix against the real seeded code list) + owner-verify (visual: MTNS/POTA/GLAMP render correctly on a real camp's detail page on localhost)
- AC-4 → unit (source-inspection: no wildcard import, `getIconByName` call present) + owner-verify (host form option tiles still render icons visually unchanged)
- AC-5 → unit (the coverage test itself; proven with a teeth case that removes a row and shows the assertion goes red)
- Story-specific: every seeded MasterData code (read from `prisma/seed.ts`, 81 codes) has both a `FACILITY_ICON_MAP` entry and `filter.<CODE>` in en+th; `MOUN`/`HIKG` phantom keys removed; `RV`/`MATT`/`STOV`/`711` dead keys pruned (none is a seeded code); `CampgroundDetailClient.tsx`'s and `CampgroundForm.tsx`'s icon-rendering behavior is unchanged for every already-correct code (refactor-only, no visual regression)
- Gate = `/quality-gate` (`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run check:ds` · `npm run check:palette`) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
