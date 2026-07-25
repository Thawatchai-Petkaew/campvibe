---
linear: CAM-494
feature: home-search-filters
epic: CAM-487-home-search-filters
persona: CAMPER
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-07-25
---
# Test — Redefine SearchModal experience pills to real filterable dimensions (CAM-494)

## AC→test matrix
<!-- No story.md exists for this story; AC rows below are derived from
CAM-491's design.md §1/§2 (param-mapping table), which CAM-494 explicitly
mirrors 1:1 for SearchModal ("same fix as CAM-491" per component comment). -->
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 type pills (Campground/Car camping) emit ONLY `type=CAGD`/`type=CACP`, never GLAMP/LAKE/FOREST/VIEW/BAOT | H | unit (structural) | `__tests__/cam-494-search-modal-pills.test.ts` | ✅ |
| AC-2 terrain pills (Beach/Forest/Mountain/Riverside) emit `terrain=BEAC/FORE/MTNS/RIVE`, never `type=` | H | unit (structural) | `__tests__/cam-494-search-modal-pills.test.ts` | ✅ |
| AC-3 All pill owns no param (clears the dimension) | M | unit (structural) | `__tests__/cam-494-search-modal-pills.test.ts` | ✅ |
| AC-4 `handleSearch` deletes BOTH `type` and `terrain` before setting the selected pill's own param (mutual-exclude); other params (keyword/province/district/dates/guests) preserved via `new URLSearchParams(searchParams.toString())` | H | unit (structural) + read-only reasoning | `__tests__/cam-494-search-modal-pills.test.ts` | ✅ |
| AC-5 initial pill selection hydrates from the URL's `type`/`terrain` params (`resolveSelectedExperience`), defaulting to "all" when neither matches (incl. a dead/legacy code like `type=GLAMP`) | H | unit (structural) + read-only reasoning (node simulation) | `__tests__/cam-494-search-modal-pills.test.ts` + manual (this report) | ✅ |
| AC-6 visible focus ring + `aria-pressed` (not color alone) on every pill button | H | unit (structural) + `check:ds`/`check:palette` | `__tests__/cam-494-search-modal-pills.test.ts` | ✅ |
| AC-7 removed `categories.*` keys (campgrounds/glamping/lakefront/views/boatAccess) have no remaining consumer anywhere; final `categories.*` set is exactly all/campground/carCamping/beach/forest/mountain/riverside in both TH+EN | H | read-only reasoning (grep + JSON parse) | manual (this report) | ✅ |
| AC-8 `terrain=BEAC/FORE/MTNS/RIVE` and `type=CAGD/CACP` map to real `buildCampSiteWhere` clauses (pill selections return real results, not empty sets) | M | read-only reasoning (`lib/campsite-filters.ts`, already covered by CAM-491's QA pass — same backend, same param names) | manual (this report) | ✅ |

## Validation cases
- **Happy** — select Beach pill with `?province=Krabi&keyword=lake` already in the URL, tap Search → resulting URL is `?keyword=lake&province=Krabi&terrain=BEAC` (both `type`/`terrain` deleted first, then `terrain=BEAC` set; unrelated params keyword/province/district/dates/guests carried forward via the `new URLSearchParams(searchParams.toString())` base). Confirmed by reading `handleSearch`: `params.delete("type"); params.delete("terrain");` runs before the conditional `params.set(selected.param, selected.value)`.
- **Boundary/exclusivity** — switching from a `type=CAGD` pill to a `terrain=BEAC` pill in the same search never leaves `type=CAGD` stuck (both dimensions are unconditionally cleared before the new one is set, regardless of which was previously active).
- **URL hydration (all 4 branches)** — verified via a standalone node simulation of `resolveSelectedExperience` mirroring the real function line-for-line: `terrain=BEAC` → `beach`; `type=CAGD` → `campground`; no matching param (`keyword=foo`) → `all`; a legacy dead code (`type=GLAMP`) → gracefully falls back to `all` (no crash, no false-highlight).
- **Error/regression (the whole point of CAM-494)** — Prove-It: reverted `components/SearchModal.tsx` to the pre-fix `origin/dev` version in the worktree and re-ran the suite → 8/10 tests went red (2 incidentally still matched: `keyword` preservation shape, and one unrelated string). Restored the fix → 10/10 green, working tree confirmed clean afterward. Confirms the suite actually catches the dead-`type=` regression it exists to prevent.
- **Locale integrity (cross-story risk)** — `grep -rn "categories\.\(glamping\|lakefront\|views\|boatAccess\|campgrounds\)"` across `components/ app/ lib/` → zero consumer hits (the one `campgrounds` string match is an unrelated file-path literal in `app/api/scrape-seed/route.ts`, not a locale key). `node -e "Object.keys(require('./locales/translations.json').en.categories)"` and the `.th` equivalent both return exactly `[all, campground, carCamping, beach, forest, mountain, riverside]` — no drift between languages, no dangling key.
- **Dead-code grep (repo-wide)** — `grep -rn "GLAMP|LAKE|BAOT"` outside this diff resolves only to legitimate unrelated usages (facility/access-type icon maps, legacy campground validation schemas, AI tool access-code enums) — none are SearchModal's removed campSiteType pill codes re-appearing.

## Coverage
Not measured via `vitest run --coverage` (0/0 instrumented — source-inspection test file, no jsdom in this repo's Vitest config; same established convention as `__tests__/cam-491-category-bar.test.ts`). Every new/changed line in `components/SearchModal.tsx`'s pill logic (`EXPERIENCE_TYPES`, `resolveSelectedExperience`, the `handleSearch` clear/set block, and the button JSX's `aria-pressed`/focus-ring classes) is asserted by at least one test in the matrix above, plus the Prove-It red/green run demonstrates the tests actually detect the regression.

## Findings (non-blocking)
- **Suggestion** — the new `ExperienceType.icon: any` field (mirroring `CategoryBar.tsx`'s identical `Category.icon: any`, already merged to `dev` in CAM-491) adds one eslint `@typescript-eslint/no-explicit-any` warning (file total: 6→8 pre-existing→now). Consistent with the already-accepted sibling pattern; not a new class of debt, not blocking.
- **Info** — `SearchModal`'s `handleSearch` does not clear the `access` param (CategoryBar's `OWNED_PARAMS` defensively clears `type`/`terrain`/`access`; SearchModal only clears `type`/`terrain` since it has no access-type control and AC-4 requires *other* params — including `access`, if set by FilterModal — to be preserved). This is correct per AC-4's scope, not a defect.

## Links
`components/SearchModal.tsx` · `components/CategoryBar.tsx` (CAM-491 reference) · `__tests__/cam-494-search-modal-pills.test.ts` · `locales/translations.json` · `lib/campsite-filters.ts` · `docs/specs/home-search-filters/CAM-487-home-search-filters/CAM-491-redefine-category-tabs/design.md` (shared taxonomy source) · `.claude/rules/qa.md`

## Changelog
- v1 (2026-07-25) — created; independent QA verify of frontend-delivered CAM-494
