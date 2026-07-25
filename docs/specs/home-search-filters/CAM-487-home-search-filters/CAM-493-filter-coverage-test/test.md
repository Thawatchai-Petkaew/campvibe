---
linear: CAM-493
feature: home-search-filters
epic: CAM-487-home-search-filters
persona: CAMPER
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-07-25
---
# Test — Automated filter-coverage CI guard (CAM-493)

## What this guards

A CI guard that fails the build if any Home tab/search-pill, or any
MasterData filter option, would return **zero results** against the seed
data (`prisma/data/mock-staging-all.json` — the same fixture
`db:sync-from-staging` loads into the local dev DB). Deterministic, DB-free —
scans the committed JSON directly, mirroring `lib/campsite-filters.ts`'s real
filter semantics (`options.some.code` for the 6 CSV taxonomy groups; plain
equality for `campSiteType`).

Catches two failure modes going forward, by name, not just a boolean:

- **(a) the dead-TAB bug** — a Home/SearchModal tab points at a `type=`/
  `terrain=` value with no backing camp (the exact CAM-491 regression).
- **(b) the dead-OPTION bug** — a MasterData filter code (any of the 7
  groups seeded in `prisma/seed.ts`) has zero backing camps.

The code universe is **sourced, not hardcoded**: MasterData codes are parsed
from `prisma/seed.ts`'s `masterData` array (never imported — that module
runs a live Prisma seed via `main()` on load) and the tab/pill pairs are
parsed from `components/CategoryBar.tsx`'s `CATEGORIES` array. A future
added/renamed code or tab is picked up automatically; nothing here can
silently drift from the real source.

## AC→test matrix

| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 every MasterData filter code (all 7 groups: Internal facility, Equipment for rent, External facility, Campground type, Access type, Activity, Terrain) has >=1 backing camp | H | unit (JSON-fixture scan) | `__tests__/cam-493-filter-coverage.test.ts` | ✅ |
| AC-2 every Home tab/pill (`type=CAGD/CACP`, `terrain=BEAC/FORE/MTNS/RIVE`) returns >=1 camp | H | unit (JSON-fixture scan) | `__tests__/cam-493-filter-coverage.test.ts` | ✅ |
| AC-3 distinct province coverage >=60 (of 77) so a province filter is rarely empty | M | unit | `__tests__/cam-493-filter-coverage.test.ts` | ✅ |
| AC-3b every one of the 6 geographic regions (`lib/thai-regions.ts`) has >=1 backing camp | M | unit | `__tests__/cam-493-filter-coverage.test.ts` | ✅ |
| AC-4 price spread reaches a premium band (max `priceHigh` >=15000) so a high-price filter is not empty | L | unit | `__tests__/cam-493-filter-coverage.test.ts` | ✅ |
| AC-5 a failing assertion NAMES the exact dead code(s)/tab(s), never a bare boolean | H | unit (Prove-It) | `__tests__/cam-493-filter-coverage.test.ts` | ✅ |

## Coverage matrix (per bucket)

- **normal** — every MasterData code + every tab/pill pair counted against real camps (AC-1, AC-2).
- **boundary** — province-count floor (60 of 77) and region-emptiness floor; price-spread floor (AC-3, AC-3b, AC-4).
- **null/empty** — N/A here (the guard's subject is "does this code/tab have >=1 backing camp", not an input-validation boundary); justified by the assertion's own zero-count branch, which IS the null case under test.
- **error/naming** — a failing assertion always names the dead code/tab (AC-5), verified twice via Prove-It (below).
- **concurrent/ordering** — N/A; a pure, order-independent scan of a static fixture.

## Prove-It (red-before-green, demonstrated twice)

**#1 — dead MasterData code.** Temporarily pushed a fake entry
`{ code: "ZZZZ_FAKE", group: "Terrain" }` onto the parsed `MASTER_DATA`
array. Re-ran the suite → **RED**, naming it exactly:

```
dead MasterData code(s) in group "Terrain" with ZERO backing camps: [ZZZZ_FAKE]
— a filter selecting any of these returns an empty result set
```

Reverted → 18/18 **GREEN**.

**#2 — dead Home tab.** Temporarily pushed a fake pair
`{ param: "type", value: "ZZZZ_FAKE_TAB" }` onto the parsed `TAB_PAIRS`
array. Re-ran the suite → **RED**, naming it exactly:

```
dead Home tab(s) with ZERO backing camps: [type=ZZZZ_FAKE_TAB]
— tapping this tab shows an empty result grid
```

Reverted → 18/18 **GREEN**. No temporary change left in the committed file
(`grep ZZZZ_FAKE __tests__/cam-493-filter-coverage.test.ts` → no match).

## Coverage %

Not measured via `vitest run --coverage` in the traditional sense — this
story adds **no new production code** (a pure CI test-guard, DB-free JSON
scan). The guard exercises 100% of the sourced code universe directly: every
one of the 34 parsed MasterData codes across 7 groups, and all 6 parsed
CategoryBar tab/pill pairs, is asserted against the real seed fixture; the
Prove-It runs above are the coverage evidence for the guard's own failure
path.

## Findings (non-blocking, flagged for follow-up — NOT part of this ticket's AC)

- **Important (candidate defect, out of this ticket's scope)** — `components/SearchModal.tsx`'s
  `CAMPGROUND_TYPES` array (lines 34-43) still declares pill ids
  `GLAMP`, `LAKE`, `FOREST`, `VIEW`, `BAOT` that set `type=<id>` on search
  (`handleSearch` → `params.set("type", type)` → `buildCampSiteWhere`'s
  `where.campSiteType = type`). None of these are valid `campSiteType`
  values (`prisma/seed.ts`'s "Campground type" MasterData group has only
  `CAGD`/`CACP`; `BAOT` exists but under the "Access type" group, a
  different filter dimension). Tapping "Glamping"/"Lakefront"/"Forest"/
  "Views"/"Boat Access" in the SearchModal (mounted live in `Navbar.tsx`)
  returns **zero results**, always. `__tests__/cam-491-category-bar.test.ts`
  already asserts `CategoryBar.tsx` never emits these values
  (`.not.toMatch(/param:\s*"type"[^}]*value:\s*"(GLAMP|LAKE|FOREST|VIEW|BAOT)"/)`)
  — confirming the team already knows these are dead — but `SearchModal.tsx`
  was not updated in that same pass. **Reproduction:** open the SearchModal
  (search icon in Navbar) → tap any of "Glamping / Lakefront / Forest /
  Views / Boat Access" → Search → result grid is empty. Not filed as a
  blocking defect against CAM-493 (this ticket's AC scoped the tab/pill
  assertion to the CategoryBar `CATEGORIES` set only, per dispatch); flagged
  here per QA's "any defect found → open a sub-ticket" duty. Could not open
  a ticket via `scripts/ticket-sync.mjs` from this worktree (`STATUS_TOKEN`
  missing in `.env`) — recommend the orchestrator file this as a follow-up
  story against `SearchModal.tsx`.

## Links

`prisma/seed.ts` (MasterData source) · `prisma/data/mock-staging-all.json` (seed fixture) ·
`components/CategoryBar.tsx` (tab source) · `components/SearchModal.tsx` (pill source + flagged finding) ·
`lib/campsite-filters.ts` (filter semantics mirrored) · `lib/thai-regions.ts` (region partition) ·
`__tests__/cam-493-filter-coverage.test.ts` · `__tests__/cam-491-category-bar.test.ts` (sibling guard) ·
`.claude/rules/qa.md`

## Changelog
- v1 (2026-07-25) — created; CI filter-coverage guard authored + Prove-It (x2) + SearchModal finding flagged
