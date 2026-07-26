## Story
As a **Camper**, I want the home category tabs to include ทะเล (sea), น้ำตก (waterfall), and แกลมปิ้ง (glamping), and I want tapping a tab to never erase an Access-type selection I already made in the filter, so that I can reach the new terrain/glamping camps from the home page and trust that switching a category never silently discards an unrelated selection.
Why: CAM-512 seeded 8 new Terrain codes + 2 new Campground-type codes, but the home `CategoryBar` still offers only the original 6; separately, `OWNED_PARAMS` clears `access` on every tab tap even though no tab ever sets it, so a camper's FilterModal Access-type pick is silently wiped by an unrelated tap (live bug, confirmed: `FilterModal.tsx` now hydrates `access` from and writes it to the URL as a CSV).
Scope: `components/CategoryBar.tsx` (tab data + the tab-tap URL-param logic) + `categories.<key>` i18n (en/th) in `locales/translations.json`. Does not touch FilterModal/SearchModal/ActiveFilters/CampgroundDetailClient/CatalogResults/`app/page.tsx`, or any zod/API/taxonomy-registry wiring (owned by sibling stories in the same epic).
Depends on: docs research — `.claude/plans/research-user-jolly-mochi.md` §"S2 · Filter home tabs — CategoryBar" (approved plan)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper is on Home with no category selected | Camper taps the `ทะเล` tab | The `ทะเล` tab shows selected (underline + bold icon); the grid narrows to camps with sea terrain | URL gets `terrain=SEA`; `type` is cleared if it was previously set | EC-1 |
| AC-2 | Camper is on Home with no category selected | Camper taps the `น้ำตก` tab | The `น้ำตก` tab shows selected; the grid narrows to camps with waterfall terrain | URL gets `terrain=WATF`; `type` is cleared if it was previously set | EC-1 |
| AC-3 | Camper is on Home with no category selected | Camper taps the `แกลมปิ้ง` tab | The `แกลมปิ้ง` tab shows selected; the grid narrows to glamping camps | URL gets `type=GLAMP`; `terrain` is cleared if it was previously set | EC-1 |
| AC-4 | Camper picked an Access type in the filter (URL already carries `access=DRIV`) | Camper taps any home category tab (e.g. `ชายหาด`) | The tapped tab narrows the grid by its own dimension; the camper's earlier Access-type pick is still applied, unchanged | `access` is preserved byte-for-byte; only `type`/`terrain` change | EC-2 |
| AC-5 | Camper has an existing multi-value terrain selection from the filter (`terrain=SEA,WATF`) | Camper taps a different home category tab (e.g. `ภูเขา`) | The tab bar replaces the terrain selection with the tapped tab's single value; the grid narrows to mountain camps only | `terrain` is overwritten to the tab's single value; the prior multi-value selection is replaced, not merged | EC-3 |
| AC-6 | Camper's language is set to Thai or English | Camper views the category bar | Every tab shows its real label (`ทะเล`/`Sea`, `น้ำตก`/`Waterfall`, `แกลมปิ้ง`/`Glamping`), never a raw key | `categories.sea` / `categories.waterfall` / `categories.glamping` resolve in both `en` and `th` | — (i18n coverage check, no user-facing failure path) |

## Rules
- BR-1 `OWNED_PARAMS` (the params a tab tap clears before setting its own) lists only `type` and `terrain` — the two params this bar actually sets. It never includes `access`, or any other dimension it doesn't own, so a value the FilterModal wrote for a param this bar doesn't own survives every tab tap (proves AC-4).
- BR-2 A tab tap is a single-value shortcut: it always **replaces** whatever value currently occupies its owned param (`type` or `terrain`), whether that value was a single code or a FilterModal multi-value CSV — it never merges or appends to an existing selection (proves AC-5). Rationale: the home tabs are a fast single-choice entry point; a camper who wants to combine multiple terrain values already has the FilterModal for that — the tab bar's job is "start over with this one dimension," not "add to."
- BR-3 Exactly 3 new tabs are added (`ทะเล` → `terrain=SEA`, `น้ำตก` → `terrain=WATF`, `แกลมปิ้ง` → `type=GLAMP`); the bar stays scannable at 9 real tabs + All (proves AC-1/AC-2/AC-3).
- BR-4 Every `categories.<key>` a tab uses has both an `en` and a `th` entry in `locales/translations.json` (proves AC-6).

## Edge cases
- EC-1 IF a tapped tab's dimension has zero matching published camps THEN the existing catalog empty state renders (`components/EmptyState.tsx`, unchanged, out of this story's file surface) (BR-3)
- EC-2 IF `access` (or any param this bar does not own, e.g. `keyword`/`province`/`min`/`max`/`facilities`) is present in the URL THEN a tab tap preserves it byte-for-byte (BR-1)
- EC-3 IF the existing `terrain` value is a FilterModal multi-value CSV (e.g. `SEA,WATF`) THEN tapping a terrain tab replaces it with the tab's single value, never appends or merges (BR-2)

## Data
- No schema/migration. Read-only consumer of already-seeded MasterData codes (`SEA`/`WATF`/`GLAMP` — CAM-512/CAM-513/CAM-521 epic). Touches only `components/CategoryBar.tsx` (tab data + URL-building logic) and `locales/translations.json` (`categories.sea`/`categories.waterfall`/`categories.glamping`, en+th).

## Seams & refs
- Reuse: `components/CategoryBar.tsx`'s `CATEGORIES`/`OWNED_PARAMS` are the single source for the tab set + owned-param list; `CATEGORIES` is now exported so CAM-532 (SearchModal pills, a sibling story per the approved plan) can import it directly instead of copying it (`EXPERIENCE_TYPES` in `SearchModal.tsx` is a documented verbatim copy the plan flags for that sibling story to retire — not touched here). Icon choices for SEA(Sailboat)/WATF(Droplets)/GLAMP(Sparkles) mirror `lib/facility-icon-map.ts`'s CAM-525 choices for cross-surface consistency (read-only reference; `CategoryBar` keeps its own lucide imports per the existing pattern, no new dependency between the two files). Refs: `.claude/plans/research-user-jolly-mochi.md` §"S2 · Filter home tabs — CategoryBar" (approved plan).
- Out of bounds (owned by sibling stories / other agents right now): `components/FilterModal.tsx`, `components/SearchModal.tsx`, `components/ActiveFilters.tsx`, `components/CampgroundDetailClient.tsx`, `components/CatalogResults.tsx`, `app/page.tsx`, `lib/taxonomy-registry.ts`, `lib/campsite-filters.ts`, `lib/validations/**`, `app/api/**`, `prisma/**`.

## Out of scope
- FilterModal/SearchModal/ActiveFilters changes → owned by sibling stories in the same epic (`docs/specs/platform-hardening/taxonomy-ui-foundation/`).
- Adding the remaining 6 new terrain/type codes (`COAS`/`LAKE`/`SWMH`/`FILD`/`CAVE`/`FARM`/`VIEW`) as home tabs → deliberately excluded to keep the bar scannable per dispatch; no follow-up ticket unless the owner asks for more tabs.
- The pre-existing Thai-spelling typo on `filter.GLAMP` (renders `กลามปิ้ง`, missing the leading แ — should be `แกลมปิ้ง`) in the unrelated `filter.*` i18n namespace → noted for follow-up, not fixed here (different namespace, owned by the CAM-525 icon/i18n story).

## Self-verify
- AC-1..AC-3 → unit (`__tests__/cam-529-category-tabs.test.ts`, behavioral: `buildCategoryUrl` exercised against a real `URLSearchParams`) + owner-verify (visual: tapping ทะเล/น้ำตก/แกลมปิ้ง narrows the grid on localhost, dev DB)
- AC-4 → unit, Prove-It (RED before the fix with `access=DRIV` wiped; GREEN after `OWNED_PARAMS` drops `access`)
- AC-5 → unit (a CSV `terrain=SEA,WATF` is replaced, not merged, by a single-value tab tap)
- AC-6 → unit (every `CATEGORIES[].labelKey` resolves under `categories.*` in `locales/translations.json`, both `en` and `th`)
- Story-specific: full suite green after the change (`npx vitest run`, last act); `check:ds`/`check:palette` green (no new token/hardcoded value)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
