---
linear: CAM-616
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: camper
artifact: story
owner: frontend-engineer
status: In Progress
version: v2
updated: 2026-07-28
---
# แปดหน้าจอบอกว่า "ไม่มีอะไรตรงนี้" ทั้งที่ระบบล่ม (CAM-616)

## Story
As a **Camper** (and, on the operator surfaces, a **Host**), I want a system failure to look like a system failure — not like an empty result — so that I don't abandon a search that would have matched dozens of camps, don't believe a listing was deleted, and don't pick a date that is actually blocked; and so that the operator sees the incident instead of a normal-looking empty page.
Why: the sweep of 2026-07-28 found eight more places carrying the exact shape CAM-588 already fixed on the camp detail page yesterday — a caught infrastructure error silently re-labelled as "there is genuinely nothing here", which both misleads the user and hides the incident from us in the same stroke.
Scope: `components/CatalogResults.tsx` (both catches — cached default path + filtered/live path) · `components/InfiniteScrollGrid.tsx` (page-2 fetch failure) · `app/dashboard/campsites/page.tsx` (adds an error state where none existed) · `components/NotificationCenter.tsx` (splits one shared catch over three independent sources) · `app/actions/getCampSiteCount.ts` · `app/actions/getFilterOptions.ts` · `components/FilterModal.tsx` (their sole consumer — brought into scope at v2, see Changelog) · `components/CampgroundDetailClient.tsx` (the availability catches only) · `locales/translations.json` (new error/retry copy, TH+EN) · new tests only.
Depends on: CAM-588 (the reference implementation this story generalises — `app/campgrounds/[slug]/page.tsx`, read-only here) · CAM-362/CAM-555 (`lib/safe-fetch.ts`'s `{ok:false}` never-throw shape, reused not reinvented) — both MERGED.

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The default (unfiltered) catalog read fails (cache/DB error) | A visitor loads the home page | An error state with a "back to home" action, never "ไม่พบแคมป์ที่ตรงกับตัวกรอง" | No fake empty result; the outage is logged (`catalog_default_load_failed`), not swallowed | EC-1 |
| AC-2 | A filtered/search catalog read fails (DB error) | A visitor searches with a filter active | The same error state, never the filtered-empty message | Logged as `catalog_filtered_load_failed`; short-circuits before the availability/province/wishlist reads | EC-1 |
| AC-3 | The page-2 ("load more") cursor fetch fails (5xx or network) | A visitor scrolls to the bottom | `t.catalog.load_more_error` ("โหลดลานเพิ่มเติมไม่สำเร็จ") + a retry button, never `t.catalog.end_of_list` ("ดูลานครบทั้งหมดแล้ว") | `loadError` tracked separately from `done`; auto-retry is blocked, the retry button re-issues the same cursor request | EC-2 |
| AC-4 | An operator's `/api/operator/dashboard` read fails | The operator opens "My Camp Sites" | An error state with retry, never `t.dashboard.noCampSitesFound` ("you have no camp sites yet") | This surface had no error state at all before this story; one is added | EC-3 |
| AC-5 | The host-bookings source fails while the invites source is healthy (or vice versa) | A host with a real pending booking opens the notification bell | The pending booking still shows; if the visible list is empty ONLY because of a failure, an error+retry replaces `t.common.noNotifications` | Each of the three sources (host bookings / camper booking updates / invites) fails into its OWN flag — a sibling's data is never wiped | EC-4 |
| AC-6 | The filter-count query fails | The camper opens the filter modal and adjusts a filter | `t.filter.countError` banner + retry above the buttons; the primary button names the failure (`t.filter.countErrorLabel`) instead of "Calculating..." forever | `getCampSiteCount` re-throws (`campsite_count_failed`); FilterModal's `countError` state renders the distinguishable state; retry re-issues the same query | EC-5 |
| AC-7 | The filter-options query fails | The camper opens the filter modal | `t.filter.optionsError` banner + retry in place of the (would-be-empty) filter-chip list | `getFilterOptions` re-throws (`filter_options_load_failed`); FilterModal's `filterOptionsError` state renders the distinguishable state; retry re-issues the same query | EC-5 |
| AC-8 | The availability-calendar read fails | A camper opens a camp detail page and looks at the date picker | Every future date is disabled (not selectable) + `t.booking.availabilityLoadError` ("โหลดวันว่างไม่สำเร็จ กรุณาลองใหม่อีกครั้ง") with a retry, never every date rendered as bookable | `availabilityError` makes `isDateDisabled` return `true` for every future date until a retry succeeds | EC-6 |

## Rules
- BR-1 A caught infrastructure/DB error must reach a state the user can tell apart from genuine emptiness — an error UI, a retry affordance, or a thrown error (never a silent `[]`/`{}`/`0` that a later `.length === 0` / `=== 0` check reads as "there is nothing"). (proves AC-1..AC-8)
- BR-2 A genuinely empty result (a real `0` rows / `0` count / `{}` options with no error) is unaffected by this story — the correct twin is never touched. (regression guard, all ACs)
- BR-3 Independent sources sharing a UI surface (NotificationCenter's three fetches) each get their OWN error flag; one source's failure never wipes a sibling's already-loaded data (the CAM-362 anti-pattern, closed here for a THIRD surface). (proves AC-5)
- BR-4 The 14 catches this sweep found deliberate and correct are NOT touched: SEC-1 anti-enumeration 404s (`app/campgrounds/[slug]/page.tsx`, out of bounds) · `lib/safe-fetch.ts`'s `{ok:false}` never-throw shape (out of bounds, reused by NotificationCenter) · CatalogResults.tsx's three OTHER fail-open catches (province admin-area resolution, Thai-province-name lookup, dated-availability-badge computation) — each is an independent, already-scoped enhancement whose own failure must not turn into an outage for the rest of a successful catalog read.
- BR-5 Error/retry copy is plain Thai (no jargon, no em-dash separator) and lives in `locales/translations.json` (TH+EN) — never hardcoded in JSX.

## Edge cases
- EC-1 IF both the cached-default AND the filtered/live catalog reads are exercised in the same request (never simultaneously — `useCache` selects exactly one) THEN each path's own catch independently renders the error state; neither path can mask the other
- EC-2 IF the page-2 fetch fails and the visitor scrolls again (sentinel re-enters view) THEN no second automatic fetch fires (the `done` guard, unchanged) — only the retry button re-issues the request
- EC-3 IF the operator retries after a `loadError` and the retry succeeds THEN the table renders normally and the error state is gone
- EC-4 IF ALL THREE notification sources fail AND the filtered list is empty THEN the error+retry replaces the empty-state copy; IF at least one source's data renders (non-empty list) THEN the error is not shown over real content
- EC-5 IF `getCampSiteCount`/`getFilterOptions` throw THEN the province-admin-area-resolution fail-open catch inside `getCampSiteCount` is UNCHANGED (still catch-and-continue) — only the final count/options query's own failure throws
- EC-6 IF the availability fetch later succeeds (retry) THEN `availabilityError` resets to `false` before the request, and a genuinely unavailable date (present in the resolved map) stays disabled on its own existing merit

## Data
No schema/migration change. No new API endpoint. New locale keys: `catalog.load_more_error`, `notifications.loadError`, `booking.availabilityLoadError`, `filter.countError`, `filter.countErrorLabel`, `filter.optionsError` (TH+EN, `locales/translations.json`).

## Seams & refs
- Reuse: `components/ErrorState.tsx` (variant="error", compact) for CatalogResults' two catches and the dashboard/campsites page — never hand-rolled. `lib/safe-fetch.ts`'s `fetchJsonSafe`/`SafeJsonResult` (CAM-362/555) for NotificationCenter's three independent fetches — reused, not reimplemented. `t.common.retry` (existing key) reused for every new retry button label instead of a new duplicate key. FilterModal's two failure states reuse the SAME inline banner (`role="alert"` + `AlertCircle` + `RotateCcw` retry `Button`) idiom InfiniteScrollGrid/NotificationCenter/CampgroundDetailClient already established — no ninth idiom invented.
- Refs: CAM-588 (`app/campgrounds/[slug]/page.tsx`) — the reference implementation this story generalises (log structured, then re-throw or render a distinguishable state, never fold a DB failure into a data-shaped "0"). CAM-362/CAM-555 — the "independent source, own error state" precedent this story applies to NotificationCenter. `.claude/rules/loading.md` §3 — section-level over full-page: CatalogResults renders `<ErrorState compact/>` inline rather than throwing, so the Navbar/CategoryBar/FilterSortBar/ActiveFilters chrome above its Suspense boundary stays visible (throwing would propagate to the root `app/error.tsx` boundary and blank that chrome too).

## Out of scope
- Extending `CampgroundDetailClient.tsx`'s remaining-capacity fetch (a separate effect, already fail-open to "unbounded/nothing shown" — a different, already-correct shape) → not touched, not part of the eight named defects.
- Flipping any of these new error states into a blocking design-system guard → not requested by this story.

## Self-verify
- AC-1/AC-2 → behavioral (Vitest, direct call to the real `CatalogResults` async function, Prisma/cache mocked at the boundary, asserting the returned React element's `.type` against the real `ErrorState`/`EmptyState`/`InfiniteScrollGrid` references) — teeth proven manually (fix reverted → red → restored → green, recorded in `design.md`)
- AC-3 → behavioral (RTL render of the real `InfiniteScrollGrid`, `fetch` + `IntersectionObserver` mocked, retry button clicked)
- AC-4 → behavioral (RTL render of the real dashboard/campsites page, `fetch` mocked)
- AC-5 → behavioral (RTL render of the real `NotificationCenter`, three independent `fetch` responses)
- AC-6/AC-7 → integration (real action functions called directly, only `prisma` mocked, asserting a rejection + a structured log line) AND behavioral (RTL render of the real `FilterModal`, both actions mocked to reject, banner+retry asserted, `__tests__/cam-616-filter-modal-error-states.test.ts`) — teeth proven manually on both layers
- AC-8 → source-inspection (established precedent for this specific heavy component in this repo — see `design.md`), Prove-It position/behaviour assertions (not a bare grep)
- EC-1..EC-6 → covered inline in the above test files
- Gate = `/quality-gate`. Done = every AC verified on localhost (dev DB) before merge into `dev`.

## Changelog
- v1 (2026-07-28) — created. Closes the eight-surface "failure renders as emptiness" sweep; generalises CAM-588's reference fix.
- v2 (2026-07-28) — `components/FilterModal.tsx` brought into scope by the orchestrator (excluded at v1 by orchestrator error, not overreach). AC-6/AC-7 now cover the full user-visible closure, not just the action-layer throw; confirmed the pre-fix `getFilterOptions` gap rendered the original "zero filter chips, no message" defect one level down, and the `getCampSiteCount` gap left the button on "Calculating..." forever — both closed with the same banner+retry idiom used on the other seven surfaces.
