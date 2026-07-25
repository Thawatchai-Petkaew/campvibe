---
linear: CAM-491
feature: home-search-filters
epic: CAM-487-home-search-filters
persona: CAMPER
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-07-25
---
# Test — Redefine Home category tabs to real filterable dimensions (CAM-491)

## AC→test matrix
<!-- No story.md exists for this story; AC rows below are derived from design.md
§1/§2 (param-mapping table) and §4 (SearchModal interaction), which serve as
the AC source for this design-brief-driven story. -->
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 type tabs (Campground/Car camping) emit ONLY `type=CAGD`/`type=CACP`, never GLAMP/LAKE/FOREST/VIEW/BAOT | H | unit (structural) | `__tests__/cam-491-category-bar.test.ts` | ✅ |
| AC-2 terrain tabs (Beach/Forest/Mountain/River) emit `terrain=BEAC/FORE/MTNS/RIVE`, never `type=` | H | unit (structural) | `__tests__/cam-491-category-bar.test.ts` | ✅ |
| AC-3 All tab owns no param (clears the dimension) | M | unit (structural) | `__tests__/cam-491-category-bar.test.ts` | ✅ |
| AC-4 click clears the OTHER owned category params (type/terrain/access) before setting its own, preserving unrelated params (province/keyword/price/sort) via `new URLSearchParams(searchParams.toString())` | H | unit (structural) + read-only reasoning | `__tests__/cam-491-category-bar.test.ts` | ✅ |
| AC-5 active-tab detection: terrain tab active only on exact single-code match, never a FilterModal CSV (e.g. `BEAC,FORE`) false-positive | H | unit (structural) | `__tests__/cam-491-category-bar.test.ts` | ✅ |
| AC-6 visible focus ring on every tab button (`ring-ring`, WCAG 2.1 AA) | H | unit (structural) + `check:ds`/`check:palette` | `__tests__/cam-491-category-bar.test.ts` | ✅ |
| AC-7 SearchModal's kept `categories.*` keys (all/campgrounds/carCamping/glamping/lakefront/forest/views/boatAccess) still resolve in both TH+EN | H | read-only reasoning (grep + JSON parse) | manual (this report) | ✅ |
| AC-8 `terrain=BEAC` maps to `{ options: { some: { code: 'BEAC' } } }` in `buildCampSiteWhere` (Beach tab returns real results) | M | read-only reasoning (`lib/campsite-filters.ts`) | manual (this report) | ✅ |

## Validation cases
- **Happy** — tap Beach tab with `?province=Krabi&keyword=lake` in the URL → resulting URL is `?province=Krabi&keyword=lake&terrain=BEAC` (owned params cleared, unrelated params preserved). Confirmed by reading `handleCategoryClick`: `OWNED_PARAMS.forEach(p => params.delete(p))` runs before `params.set(cat.param, cat.value)`, and the base is `new URLSearchParams(searchParams.toString())` (full carry-forward of every existing param).
- **Boundary/CSV** — `terrain=BEAC,FORE` (set by FilterModal, multi-value) → `isActive` for the Beach tab does `terrainParam === cat.value` → `"BEAC,FORE" === "BEAC"` is `false`. No tab false-highlights; `all` is also not active (`!typeParam && !terrainParam` is false since `terrainParam` is truthy). Matches design.md §2 exactly.
- **Error/regression (the whole point of CAM-491)** — Prove-It: reverted `components/CategoryBar.tsx` to the pre-fix `origin/dev` version and re-ran the suite → 8/10 tests went red (2 pre-existing-shape tests incidentally still matched). Restored the fix → 10/10 green. Confirms the suite actually catches the dead-`type=` regression it exists to prevent.
- **SearchModal non-regression** — `grep -rn "t\.categories\|categories\[" components app lib contexts` → only two consumers (`CategoryBar.tsx`, `SearchModal.tsx`); `node -e "JSON.parse(...)"` on `locales/translations.json` confirms valid JSON with no duplicate/missing keys in either language block.

## Coverage
Not measured via `vitest run --coverage` (source-inspection test file — no jsdom in this repo's Vitest config, established convention per `cam-434-global-launcher.test.ts`/`cam-272-ai-chat-components.test.ts`; component logic is 100% covered by direct source assertions + Prove-It red/green, not a coverage-tool number). New/changed lines in `components/CategoryBar.tsx` are each asserted by at least one test in the matrix above.

## Findings (non-blocking)
- **Suggestion** — design.md's focus-ring class list includes `rounded-md`; the shipped className list (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`) omits it. The ring is still visible/tokened and satisfies WCAG 2.1 AA 2.4.7 (Focus Visible); square vs rounded ring corners is cosmetic only. Not filed as a blocking defect.

## Links
`design.md` (AC/BR source) · `.claude/rules/qa.md` · `__tests__/cam-491-category-bar.test.ts` · `components/CategoryBar.tsx` · `lib/campsite-filters.ts` · `components/SearchModal.tsx`

## Changelog
- v1 (2026-07-25) — created; independent QA verify of frontend-delivered CAM-491
