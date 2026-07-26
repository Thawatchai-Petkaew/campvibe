## Story
As a **Camper**, I want the active catalog filters to appear as a visible, localized, removable row of chips above the results, so that I can see exactly what is narrowing my search and remove one filter with a single tap instead of reopening the filter modal.
Why: a read-only sweep (2026-07-26) found `components/ActiveFilters.tsx` dead (never imported/mounted anywhere), incomplete (missing the CAM-515/CAM-516 `annotatedFeatures`/`camperStyle` groups), and unlocalized (rendered raw MasterData codes like `Terrain: SEA`) — all three defects at once, confirmed on current code before this story started.
Scope: `components/ActiveFilters.tsx` (rewrite) + its mount point `app/page.tsx` + `__tests__/cam-530-active-filters.test.ts` (new). No `locales/translations.json` keys were added — every code + group title this story needs already exists (`filter.<CODE>`, `filter.<GroupName>`, `activeFilters.removeFilter`/`activeFilters.clearAll`, verified before writing). Does not touch `components/FilterModal.tsx`, `components/SearchModal.tsx`, `components/CategoryBar.tsx`, `components/CampgroundDetailClient.tsx`, `components/CampgroundForm.tsx`, `lib/taxonomy-registry.ts`, `lib/campsite-filters.ts`, `lib/validations/**`, `app/actions/**`, `prisma/**`, `app/api/**` (owned by sibling stories in the same epic or out of this story's file surface).
Depends on: `lib/taxonomy-registry.ts` (CAM-523, read-only) · `.claude/plans/research-user-jolly-mochi.md` §"S3 · ActiveFilters — mount + complete + localize" (approved plan).

## Mount-point decision (required by dispatch)
Mounted in `app/page.tsx`, directly above the `<Suspense>` boundary that wraps `<CatalogResults>`, OUTSIDE that Suspense boundary — not inside `components/CatalogResults.tsx`. Rationale:
- `ActiveFilters` is a client component that reads `useSearchParams()` directly; it re-renders on every client-side navigation independent of the server-rendered results stream. Mounting it inside `CatalogResults` (an async **server** component) would gate its very first paint behind the same data fetch the grid waits on, and would require re-deriving the active-filter set from the props `CatalogResults` already receives (a second parsing path competing with the one this story adds) instead of reading the URL directly.
- Mounting in `page.tsx`, above the Suspense fallback, keeps the chip row part of the **instant static chrome** (Navbar/CategoryBar/FilterSortBar) per the section-level-Suspense default (`.claude/rules/loading.md` §3) — it never waits on the grid, and it never blocks the grid: both read the same URL source of truth independently, so "sync with the grid" is achieved by shared source-of-truth, not a prop dependency between them.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper is on Home with `terrain=SEA,WATF` and `camperStyle=CHIC` in the URL (set via FilterModal) | Camper looks at the row above the results grid | Chips render: `สภาพพื้นที่: ทะเล`, `สภาพพื้นที่: น้ำตก`, `รูปแบบแคมป์: สบาย (สายคุณหนู)` — never `terrain: SEA` or any raw code | No system effect (read-only render) | EC-1 |
| AC-2 | Camper is on Home with `annotatedFeatures=ALCO` in the URL | Camper looks at the chip row | A chip renders `คุณลักษณะ: ดื่มแอลกอฮอล์ได้` | No system effect | EC-1 |
| AC-3 | Camper has 3 terrain values active (`terrain=SEA,WATF,MTNS`) | Camper taps the X on the `น้ำตก` (WATF) chip | The `น้ำตก` chip disappears; `ทะเล` and `ภูเขา` chips remain | URL becomes `terrain=SEA,MTNS`; `InfiniteScrollGrid`/`CatalogResults` re-renders against the narrowed set | EC-2 |
| AC-4 | Camper has exactly one value on a param (`min=500`) | Camper taps the X on the `ราคาขั้นต่ำ: 500` chip | The chip disappears; no empty chip row remains if it was the only active filter | `min` param is removed from the URL entirely (not left as an empty string) | EC-3 |
| AC-5 | Camper is on Home with no filter param in the URL (only `keyword`/`sort`, or nothing at all) | Camper looks at the area above the results grid | Nothing renders there — no empty box, no stray spacing, no "no filters" placeholder | No DOM node for the chip row is present | AC-5 has no failure twin — this IS the negative/empty-state row itself |
| AC-6 | Camper has several filters active across different groups (including `annotatedFeatures`/`camperStyle`) | Camper taps `ล้างตัวกรองทั้งหมด` (clear all) | Every filter chip disappears at once | Every managed filter param (`type`/`min`/`max` + all 8 registry `urlParam`s) is removed from the URL; `keyword`/`province`/`district`/`startDate`/`endDate`/`guests`/`sort` are preserved unchanged | — (destructive-but-scoped action, no error path; scope proven by BR-3) |

## Rules
- BR-1 The param↔group↔label mapping is derived from `lib/taxonomy-registry.ts`'s `FILTERABLE_GROUPS` (CAM-523) by iterating it directly — this file may never re-add a hand-written per-param `addFilter(...)` call the way the pre-story dead code did. A new filterable group added to the registry later must appear as a chip with zero edits to `components/ActiveFilters.tsx` (proves AC-1/AC-2; regression-guarded by the registry-driven test).
- BR-2 `type` (Campground type, a scalar enum column) and `min`/`max` (price, not a MasterData group at all) are the only two hand-cased exceptions — matching the exact exception `lib/taxonomy-registry.ts`'s own header comment documents for `type`.
- BR-3 "Clear all" removes only the params this component manages (`type`, `min`, `max`, and every `FILTERABLE_GROUPS[].urlParam`) — it never touches `keyword`/`province`/`district`/`startDate`/`endDate`/`guests`/`sort` (proves AC-6). This intentionally differs from the pre-story dead code's `router.push('/')`, which discarded the camper's entire search context, not just the filters the chip row displays.
- BR-4 Removing one value from a CSV multi-value param (`terrain`, `activities`, `access`, `facilities`, `external`, `equipment`, `annotatedFeatures`, `camperStyle`) leaves every other value on that param untouched and re-joins them with `,`; removing the last remaining value deletes the param key entirely rather than leaving `key=` (proves AC-3/AC-4).
- BR-5 Every chip label is built as `<localized group/field title>: <localized code/value>` via `t.filter[...]` (never a raw MasterData code or a hardcoded English word) — the same fallback-to-raw-code convention `CampgroundDetailClient.tsx`/`CampgroundForm.tsx` already use (`t.filter[code] ?? code`), which is inert here because every code this story's chips can show already has a translation entry (verified against `locales/translations.json` before writing).

## Edge cases
- EC-1 IF a param's value has no matching `t.filter[code]` entry THEN the raw code renders as a fallback (never a blank/undefined chip) — not reachable today (every seeded taxonomy code is translated), kept as a defensive fallback matching the existing repo convention (BR-5)
- EC-2 IF the removed value was not actually present in the CSV (a stale double-click / already-removed chip) THEN `removeActiveFilterValue` is a no-op on that value and the param is unchanged aside from any real removal (BR-4)
- EC-3 IF removing a chip empties its param THEN the param key is deleted from the URL rather than left as `key=` (BR-4, proves AC-4)

## Data
No schema/migration. Read-only consumer of `lib/taxonomy-registry.ts` (`FILTERABLE_GROUPS`, CAM-523) and `locales/translations.json` (`filter.*`, `activeFilters.*` — all keys already existed; none added by this story).

## Seams & refs
- Reuse: `components/ui/badge.tsx` (`Badge variant="secondary"`) for each dismiss token per `DESIGN.md` §3 ("status label (not clickable) → Badge" / the existing `Badge`+X-icon removable-chip pattern this component already used pre-story) — not `FilterChip` (that primitive is for the FilterModal's multi-select **toggle** role; these are **dismiss tokens** for an already-applied filter, a different role sharing the same radius/size/spacing grammar per `DESIGN.md` §3's "different roles, shared grammar" rule). `lib/taxonomy-registry.ts`'s `FILTERABLE_GROUPS` (CAM-523, read-only) is the single param↔group↔label source. Icon: `lucide-react` `X` (already imported pre-story).
- Out of bounds (owned by sibling stories / other agents right now): `components/FilterModal.tsx`, `components/SearchModal.tsx`, `components/CategoryBar.tsx`, `components/CampgroundDetailClient.tsx`, `components/CampgroundForm.tsx`, `lib/taxonomy-registry.ts`, `lib/campsite-filters.ts`, `lib/validations/**`, `app/actions/**`, `prisma/**`, `app/api/**`.
- Refs: `.claude/plans/research-user-jolly-mochi.md` §"S3 · ActiveFilters — mount + complete + localize" (approved plan).

## Out of scope
- Any change to how FilterModal writes/reads URL params, or to the registry itself → owned by CAM-523/524 (already merged) and any future registry story.
- SearchModal chip standardization (`FilterChip` migration for that surface) → CAM-532 (sibling story, same epic).
- A dedicated `data-testid`/QA test-suite pass beyond this story's own unit coverage → QA's normal per-story pass, not expanded here.

## Self-verify
- AC-1/AC-2/BR-5 → unit (`getActiveFilterChips` against a real `URLSearchParams`, EN + TH, asserting the exact localized label and that no raw code substring survives) + owner-verify (visual: `?terrain=SEA,WATF&camperStyle=CHIC` on localhost narrows to a chip row in the current UI language)
- AC-3/AC-4/BR-4/EC-2/EC-3 → unit (`removeActiveFilterValue`: CSV-sibling-preserving removal, last-value-deletes-key, no-op on an absent value)
- AC-5 → unit (`getActiveFilterChips` returns `[]` with no relevant params) + structural (`if (chips.length === 0) return null;` present in source, no empty shell)
- AC-6/BR-3 → unit (`clearAllActiveFilters` removes every managed param, preserves `keyword`/`province`/`startDate`/`sort`)
- BR-1 (registry-driven property) → unit, parameterized over the REAL `FILTERABLE_GROUPS` import (not a hardcoded count) + structural guard against a reintroduced `addFilter(...)` per-param call
- Mount point (done_when) → structural (`app/page.tsx` imports and renders `<ActiveFilters />`)
- Story-specific: full suite green after the change (`npx vitest run`, last act); `npm run typecheck` / `npm run lint` / `npm run check:ds` / `npm run check:palette` green (Badge reused, no new token/hardcoded value, no hand-rolled pill)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
