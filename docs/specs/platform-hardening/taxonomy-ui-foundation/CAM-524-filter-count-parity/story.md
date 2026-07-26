## Story
As a **Camper**, I want the "Show N Campgrounds" number in the filter modal to always equal the number of campgrounds the grid actually shows after I press it, so that I never get promised results and land on an empty (or wrong-count) grid.
Why: a read-only sweep (2026-07-26, `.claude/plans/research-user-jolly-mochi.md` "Live correctness bugs") found the match-count effect builds a fresh, narrower filter object (taxonomy/price only) while the apply handler builds its query from the full current URL (`keyword`/`province`/`district`/`startDate`/`endDate`/`guests` preserved) — the count is computed over a WIDER query than the one actually applied, and the apply button was also disabled on that wrong count.
Scope: `components/FilterModal.tsx` only — one shared query builder feeds both the debounced match-count effect and the apply handler, and the apply button's disabled state no longer trusts a possibly-stale/wrong 0. Does not touch `app/actions/getCampSiteCount.ts` (its `CampSiteFilterParams` contract already accepts every field needed), `lib/campsite-filters.ts`, or `lib/taxonomy-registry.ts`.
Depends on: `.claude/plans/research-user-jolly-mochi.md` §"S8 · FilterModal count-vs-apply parity"; CAM-523 (taxonomy registry, merged — this story builds on its `FILTERABLE_GROUPS` shape)

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper has `keyword`/`province`/`startDate`/`endDate`/`guests` already active in the URL (e.g. arrived via a search) and opens the filter modal, then selects a taxonomy filter (e.g. a Terrain option) | The debounced match-count fires (500ms after the last change) | The button reads `แสดง {{count}} แคมป์กราวด์` where `{{count}}` is the number the grid will actually show after applying | `getCampSiteCount` is called with a filter object that includes the SAME `keyword`/`province`/`district`/`startDate`/`endDate`/`guests` the apply handler will push to the URL, plus the pending taxonomy/price selections | EC-1 |
| AC-2 | The combined query (URL params the modal does not own + the camper's pending selections) truly matches 0 campgrounds | The debounced match-count fires | The button reads `ไม่พบแคมป์กราวด์` and stays pressable (not greyed out) | Apply still navigates to the filtered URL; the camper reaches the catalog's own empty-result state instead of being blocked in the modal | EC-2 |
| AC-3 | The camper changes a filter selection while the count request for the previous selection is still in flight | The 500ms debounce timer for the new selection starts | The button reads the loading label and is not pressable until a fresh count resolves | `isCountLoading` gates the disabled state independently of whatever `matchCount` was left over from the prior selection | EC-2 |

## Rules
- BR-1 The match-count query and the apply query are derived from ONE shared builder that starts from the current URL's `searchParams` (`keyword`/`province`/`district`/`startDate`/`endDate`/`guests`/`sort` preserved, exactly as the apply path already did) and layers the camper's pending taxonomy/type/price selections on top — never two independently hand-synced code paths (proves AC-1).
- BR-2 The apply button's `disabled` state depends ONLY on `isCountLoading` (a request genuinely in flight). `matchCount === 0` is a real, reachable result once BR-1 is true, and never disables the button — the camper can still apply and see the catalog's existing empty-result UI (proves AC-2, AC-3).

## Edge cases
- EC-1 IF the match-count query and the apply query would ever diverge (e.g. a future param added to only one path) THEN the shared builder (BR-1) makes that impossible by construction, not by convention (BR-1)
- EC-2 IF a count request is still in flight when the camper changes a selection THEN the button shows the loading label and stays disabled, regardless of the previous (now-stale) `matchCount` value (BR-2)

## Data
- No schema/migration. No new fields — `CampSiteFilterParams` (`lib/campsite-filters.ts`) already declares every field this story forwards (`keyword`/`province`/`district`/`startDate`/`endDate`/`guests`); this story only changes which fields `components/FilterModal.tsx` populates before calling `getCampSiteCount`.

## Seams & refs
- Reuse: `lib/taxonomy-registry.ts`'s `FILTERABLE_GROUPS` (group↔urlParam↔zodField, read-only, CAM-523) · `app/actions/getCampSiteCount.ts` → `lib/campsite-filters.ts`'s `buildCampSiteWhere` (unchanged, read-only). Refs: `.claude/plans/research-user-jolly-mochi.md` §S8.
- Out of bounds (owned elsewhere): `components/CampgroundDetailClient.tsx`, `components/SearchModal.tsx`, `components/CategoryBar.tsx`, `components/ActiveFilters.tsx`, `components/ui/calendar.tsx`, `lib/taxonomy-registry.ts`, `lib/campsite-filters.ts`, `lib/validations/**`, `prisma/**`, `lib/ai/**`.

## Out of scope
- The pre-existing hardcoded `"Calculating..."` loading label (i18n debt, not introduced by this story) → follow-up i18n-cleanup ticket.
- The pre-existing behavior where clearing the "Campground type" selection to empty does not delete the URL's `type` param on apply (unchanged by this story, preserved exactly per Chesterton's-fence) → follow-up ticket if the owner wants it fixed.

## Self-verify
- AC-1 → unit (`__tests__/cam-524-filter-count-parity.test.ts`, Prove-It: a failing repro proving the pre-fix count/apply divergence, then green after the shared-builder fix) + owner-verify (apply a keyword+dated search, open filters, select a taxonomy option, confirm the shown count matches the grid after Show)
- AC-2 → unit (button not disabled when the combined query's true count is 0) + owner-verify (visual: button pressable, no grey-out, at a real 0-match combination)
- AC-3 → unit (disabled tracks `isCountLoading` only, independent of a stale `matchCount`)
- Story-specific: `__tests__/cam-344-availability-badge.test.ts`'s `[finding]` assertion (pinned the OLD "never forwards startDate/endDate" behavior) updated to assert the NEW contract
- Gate = `/quality-gate` (`npm run lint` · `npm run typecheck` · `npm test` · `npm run check:ds` · `npm run check:palette`) · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
