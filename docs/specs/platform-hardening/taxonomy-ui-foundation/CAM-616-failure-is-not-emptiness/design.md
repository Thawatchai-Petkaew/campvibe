---
linear: CAM-616
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: camper
artifact: design
owner: frontend-engineer
status: In Progress
version: v2
updated: 2026-07-28
---
# Design — a failure must not render as an absence (CAM-616)

## Flow
No new screen/flow. Every one of the eight surfaces already existed; this story adds/corrects exactly one state per surface — the "error" state that a caught infrastructure failure must reach instead of being folded into the existing "empty" state. Per `.claude/rules/loading.md` §3 (section-level over full-page), each error state replaces only the async section that failed — the surrounding chrome (Navbar/CategoryBar/FilterSortBar/ActiveFilters on Home; the dashboard shell on `/dashboard/campsites`) stays visible and functional.

## How the two shapes were told apart (the hardest part of this story)
The sweep found 22 catches total; 8 are this defect, 14 are deliberate and correct. The single test applied to every catch in the diff's surface: **does the catch produce a state the user can DISTINGUISH from real emptiness?**

- If **yes** — however it looks — it is fine and untouched. Examples left alone:
  - `app/campgrounds/[slug]/page.tsx`'s SEC-1 gate: a wrong-owner and a non-existent id must produce the IDENTICAL `notFound()` — touching this would create an information-disclosure leak, the opposite of a fix. Out of bounds, verified untouched by a regression test in this story's own suite.
  - `lib/safe-fetch.ts`'s `fetchJsonSafe` → `{ok:false}`: this already IS a distinguishable, sanctioned shape (CAM-362/555) — the caller is expected to branch on `.ok` and render its own error state. Out of bounds; reused (not reinvented) for NotificationCenter's three sources.
  - `CatalogResults.tsx`'s three OTHER catches (province admin-area id-boost resolution, Thai-province-name lookup, dated-availability-badge computation): each is an independent, already-shipped ENHANCEMENT layered on top of an otherwise-successful catalog read. Their failure mode is "the enhancement silently doesn't apply" (English province name instead of Thai; no availability badge; the legacy string-only province match instead of the id-boosted one) — the catalog itself still renders correctly with real data. Converting these to a throw would turn a cosmetic degradation into a full outage, which is a regression, not a fix. Left as catch-and-continue, verified by a regression test asserting exactly 2 `catalogError = true;` assignments exist in the file (the two THIS story adds), not 5.
- If **no** — the catch fabricates a value indistinguishable from a real, successful, empty/zero answer (`[]`, `{}`, `0`) and that value flows into the SAME conditional the happy path uses to decide "nothing matched" — it is this defect.

## The eight, and the state each now reaches
| # | Surface | Old (indistinguishable) | New state | Primitive reused |
|---|---|---|---|---|
| 1 | `CatalogResults.tsx` — cached default path | `campSites=[]` → `<EmptyState/>` | `<ErrorState variant="error" compact/>`, rendered inline (not thrown) so Home's chrome survives | `ErrorState` |
| 2 | `CatalogResults.tsx` — filtered/live path | same | same | `ErrorState` |
| 3 | `InfiniteScrollGrid.tsx` — page-2 fetch | `setDone(true)` → "end of list" copy | `loadError` state → retry banner + button, `done` guard still blocks auto-retry | inline banner + `Button` |
| 4 | `app/dashboard/campsites/page.tsx` | `setCampSites([])` → empty-table row (NO error state existed) | `<ErrorState variant="error" compact onRetry=.../>` | `ErrorState` |
| 5 | `NotificationCenter.tsx` | one shared catch → all 3 lists wiped to `[]` | 3 independent error flags via `fetchJsonSafe`; a sibling's data is never wiped; error+retry only when the VISIBLE list is empty because of a failure | `fetchJsonSafe` (CAM-362/555) + inline banner |
| 6 | `getCampSiteCount.ts` + `FilterModal.tsx` (its sole consumer) | `return 0` → "Show 0 Campgrounds"; button stuck "Calculating..." after the throw-only v1 pass | `throw` (structured-logged) + `countError` state → banner + retry above the footer buttons; the primary button's own label also names the failure instead of hanging on "Calculating..." | inline banner + `Button` (same idiom as #3/#5/#8) |
| 7 | `getFilterOptions.ts` + `FilterModal.tsx` (its sole consumer) | `return {}` → 0 filter chips, no message; the throw-only v1 pass produced the SAME zero-chips render (confirmed, see v1→v2 note below) | `throw` (structured-logged) + `filterOptionsError` state → banner + retry replaces the (would-be-empty) sections list | inline banner + `Button` |
| 8 | `CampgroundDetailClient.tsx` — availability | `setAvailability({})` → every date looks free | `availabilityError` → `isDateDisabled` returns `true` for every future date + inline banner + retry | inline banner + `Button` |

## v1 → v2: FilterModal.tsx closure (orchestrator correction)

v1 shipped the action-layer throw for #6/#7 but scoped `components/FilterModal.tsx` (their sole consumer) out of the file surface, and reported the resulting consumer-side gap rather than silently closing it. The orchestrator corrected the scope (FilterModal.tsx was excluded by orchestrator error, not overreach) and asked for the same treatment the other seven surfaces got — v2 does that.

**Confirmed before fixing (the orchestrator's direct question):** with only the v1 action-layer throw and no `.catch()` in FilterModal, `getFilterOptions`'s rejection never reached `setFilterSections` — `filterSections` stayed at its initial `[]` exactly as it did pre-story, and the modal rendered ZERO filter chips with no message distinguishing "an error happened" from "this catalog has no filterable options". **That was the original defect, still live, one level down** — not a neutral no-op. `getCampSiteCount`'s gap was different in kind: the unhandled rejection left `isCountLoading` `true` forever, so the button read "Calculating…" indefinitely — never a false "0", but also never a state that resolves, which the orchestrator correctly called "a different lie" (a spinner that never finishes is exactly as indistinguishable from a working system as the empty-render bug this story exists to close).

**v2 fix — matches the SAME idiom used on the other seven surfaces (no ninth invented):**

- `countError` (boolean state) — set by a new `try/catch` around the extracted `runCount()` callback (used by both the debounced effect and a manual retry). On failure: a `role="alert"` banner (`AlertCircle` + message + `RotateCcw` retry `Button`, `t.common.retry`) renders above the footer's button row; the primary "Show N Campgrounds" button's own label also switches to a named-failure string (`t.filter.countErrorLabel`) instead of hanging on `isCountLoading`'s stale "Calculating...". Retry re-invokes `runCount()` directly (bypassing the 500ms debounce).
- `filterOptionsError` (boolean state) — set by a new `.catch()` on the extracted `loadFilterOptions()` callback (used by both the mount/language effect and a manual retry). On failure: the same banner+retry idiom renders in place of the (would-be-empty) `filterSections.map(...)` list.
- Both flags reset to `false` at the START of their own retry attempt (not on the sibling's), so the two failure states are independent — a count failure never hides a real options list, and vice versa.
- New copy: `filter.countError` / `filter.countErrorLabel` / `filter.optionsError` (TH+EN, `locales/translations.json`), plain language, no jargon, no em-dash. Retry label reuses the existing `common.retry` key (no duplicate created).
- Teeth proven the same way as the other five behavioral surfaces: both catches temporarily reverted (no try/catch / no `.catch()`), the new `[error/teeth]` tests in `__tests__/cam-616-filter-modal-error-states.test.ts` re-run and observed RED (with real unhandled-rejection console output confirming the exact pre-fix defect shape), then restored and reconfirmed GREEN.

## Copy (new keys, TH+EN, `locales/translations.json`)
- `catalog.load_more_error` — "โหลดลานเพิ่มเติมไม่สำเร็จ" / "Couldn't load more camps"
- `notifications.loadError` — "โหลดการแจ้งเตือนไม่สำเร็จ" / "Couldn't load notifications"
- `booking.availabilityLoadError` — "โหลดวันว่างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" / "Couldn't load available dates. Please try again."
- Retry button label reuses the existing `common.retry` ("ลองอีกครั้ง" / "Try again") everywhere — no duplicate key created.
No em-dash separators; no technical jargon (no "API", "endpoint", "500", "database").

## States (per touched element)
Every new interactive element (retry buttons) covers: default · hover/focus (inherited from `components/ui/button.tsx`'s existing variants — token-only, unchanged) · active (press) · disabled (n/a — never disabled while shown) · loading (n/a — retry re-triggers the surface's own loading state, which already existed) · error (this IS the error state) · a11y (`role="alert"` on every new banner, `aria-hidden` on decorative icons, retry buttons keep the existing `Button` component's focus ring).

## a11y
- `role="alert"` on every new banner (`banner--load-more-error`, `banner--notifications-error`, `banner--availability-error`) — assertive, since these represent a failure the user should notice, unlike the existing `role="status"` end-of-list/loading regions.
- Icons (`RotateCcw`, `AlertCircle`) carry `aria-hidden="true"`; the banner's text carries the meaning.
- Retry buttons are real `<Button>` elements (keyboard-reachable, existing focus-ring token, ≥44px tap target inherited from the shared component) — never a bare clickable `<div>`.

## Components & tokens
No new component. Reused: `ErrorState` (`components/ErrorState.tsx`), `Button` (`components/ui/button.tsx`), `fetchJsonSafe`/`SafeJsonResult` (`lib/safe-fetch.ts`, read-only). New inline banners (InfiniteScrollGrid, NotificationCenter, CampgroundDetailClient) use only existing tokens already present in each file's own class list (`text-muted-foreground`, `text-destructive`, `bg-destructive/5`, `border-destructive/30`, `rounded-full`) — no new token, no stray hex/px/shadow. `check:ds` + `check:palette` both green.

## Teeth proof (done manually, not left as a toggle — CAM-604/608 practice)
For each of `components/CatalogResults.tsx`, `components/NotificationCenter.tsx`, `app/dashboard/campsites/page.tsx`, `app/actions/getCampSiteCount.ts`, `app/actions/getFilterOptions.ts`: the fix was temporarily reverted (the `catalogError`/`hasLoadError`/`loadError` gate short-circuited, or the `throw` swapped back to `return 0`/`return {}`), the corresponding `[error/teeth]`-tagged tests were re-run and observed RED, then the real fix was restored and the suite re-confirmed GREEN. `CampgroundDetailClient.tsx`'s availability fix is proven via source-inspection Prove-It position assertions (the established precedent for this specific component in this repo — see `.claude/rules/qa.md`'s "prefer behavioral… where the env allows"; this component has ~15 heavy dependencies — dynamic `MapComponent`, `next-auth` `useSession`, `ImageGallery`, `AmenitiesModal` — with no existing render harness in the codebase, confirmed by grepping every prior CAM-397/354/528/f3-detail-surface test targeting this file).

## Non-goals
Does not touch `app/campgrounds/[slug]/page.tsx` (CAM-588, already correct) or `lib/safe-fetch.ts` (CAM-362/555, already correct) — both explicitly out of bounds. Does not add a new design-system component or token. Does not change any happy-path rendering, data shape, or query (`FilterModal.tsx`'s taxonomy/price/apply logic is untouched — only the two failure paths gained a state).

## Links
`../../feature.md` · `story.md` (AC-1..AC-8, BR-1..BR-5, EC-1..EC-6) · CAM-588 (`app/campgrounds/[slug]/page.tsx` — the reference implementation) · CAM-362/CAM-555 (`lib/safe-fetch.ts` — the reused never-throw shape) · `.claude/rules/loading.md` §3 (section-level error/loading over full-page) · `.claude/rules/qa.md` (Prove-It + teeth-proof practice)

## Changelog
- v1 (2026-07-28) — created; documents how the 8 defects were told apart from the 14 deliberate catches, the per-surface state table, the FilterModal consumer gap (flagged, not silently closed), and the manual teeth-proof.
- v2 (2026-07-28) — `components/FilterModal.tsx` brought into the file surface by the orchestrator (it was scoped out at v1 by orchestrator error). Confirmed the exact pre-fix rendered behaviour for both `getFilterOptions` (silent zero-chips render — the original defect, one level down) and `getCampSiteCount` (button stuck on "Calculating..." forever — a different but equally indistinguishable-from-working failure). Closed both with the same banner+retry idiom used on the other seven surfaces; teeth proven (reverted → red → restored → green) in `__tests__/cam-616-filter-modal-error-states.test.ts`.
