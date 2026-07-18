---
linear: CAM-402
feature: booking-reliability
epic: booking-reliability-every-camper-can-complete-a-bo (CAM-395)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — Bookings list loading is honest: skeleton mirrors the fixed card and no empty-state flash (CAM-402)

## Test strategy note (read first)

`app/bookings/page.tsx` and `components/ui/booking-list-skeleton.tsx` are both rendered by a
`"use client"` page with `LanguageContext`/`useRouter`/lucide/`useMinimumLoading` dependencies and
no jsdom/RTL render harness in this repo's Vitest config (`environment: 'node'`). This matches the
established precedent for this exact page (`__tests__/cam-398-bookings-list.test.ts`,
`__tests__/cam-61-booking-detail.test.ts`) — static source-inspection (assert on the shipped
`.tsx` text) is the correct layer, not a shortcut. Every pinned assertion is a **Prove-It**:
demonstrated failing against the pre-fix source (§ Prove-It below), passing against the fix.

**What this does NOT cover** (browser-timing/visual, requires a manual owner check on the real
localhost/dev URL): the literal ~300ms delay window rendering blank pixels with no "flash" of
`ยังไม่มีการจอง`, and the skeleton's thumbnail column literally showing zero visible gap at a
desktop viewport. These are marked **owner-verify** below (per the dispatch: AC-2 is
browser-timing behavior — the testable layer is the branch-order source guard).

## AC→test matrix

| AC/EC | risk (H/M/L) | type | test (it-block name) | file | pass/fail |
|---|---|---|---|---|---|
| AC-1/BR-1/EC-1 — skeleton thumbnail wrapper carries `md:h-auto` | H | unit (source-inspection) | `[skeleton] thumbnail wrapper carries md:h-auto (stretches on desktop, no bottom gap)` | `__tests__/cam-402-bookings-loading.test.ts` | PASS |
| AC-1/BR-1 — skeleton wrapper keeps base dims `md:w-64` + `h-48` | H | unit | `[skeleton] thumbnail wrapper keeps the base dimensions md:w-64 and h-48` | same | PASS |
| AC-1/BR-1 — inner `<Skeleton>` fills the wrapper (`w-full h-full`) | M | unit | `[skeleton] inner Skeleton fills the wrapper (w-full h-full)` | same | PASS |
| AC-1/EC-1 — **twin-drift guard**: real card wrapper and skeleton wrapper carry the SAME dimensional tokens; fails if EITHER file diverges | H | unit | `[EC-1 twin-drift guard] the real card wrapper and the skeleton wrapper carry the SAME dimensional classes — a future drift in either file fails this test` | same | PASS |
| AC-1/EC-1 — skeleton wrapper no longer matches the PRE-CAM-398 pinned layout (Prove-It) | H | unit | `[EC-1] the skeleton wrapper no longer matches the PRE-CAM-398 pinned layout (bare md:w-64 h-48 with no md:h-auto)` | same | PASS |
| AC-1 — visible result (no visible gap under the skeleton thumbnail, desktop) | M | **owner-verify** (browser-only, visual) | manual: open `/bookings` on localhost at ≥768px while the API is slow/throttled → skeleton thumbnail fills the left column with zero gap beneath it | — | pending owner check on dev |
| AC-2/BR-2/EC-2 — `showSkeleton` is checked first in the render ternary | H | unit | `[order] showSkeleton is checked first` | same | PASS |
| AC-2/BR-2/EC-2 — `isLoading` checked immediately after `showSkeleton`, before `hasError` | H | unit | `[order] isLoading is checked immediately after showSkeleton, before hasError` | same | PASS |
| AC-2/BR-2/EC-2 — delay-window branch renders `null`, not a state | H | unit | `[order] the delay-window branch renders null (nothing), not a state` | same | PASS |
| AC-2/EC-2 — **Prove-It**: empty/error branches unreachable while `isLoading` is true | H | unit | `[EC-2 Prove-It] empty/error branches are unreachable while isLoading is true — the empty-state JSX no longer sits directly behind hasError with no isLoading gate` | same | PASS |
| AC-2 — visible result (no `ยังไม่มีการจอง` flash during the ~300ms delay window) | H | **owner-verify** (browser-timing, not headless-testable) | manual: throttle network (Slow 3G) on localhost, open `/bookings`, watch the first ~300ms — page must show nothing (blank async region under the header), never a flash of `ยังไม่มีการจอง` before the skeleton/list appears | — | pending owner check on dev |
| AC-3 — `noBookingsYet` copy key still renders in the empty branch | M | unit | `[empty] noBookingsYet copy key still renders in the empty-state branch` | same | PASS |
| AC-3 — empty-state condition still `bookings.length === 0` | M | unit | `[empty] empty-state branch condition is still bookings.length === 0` | same | PASS |
| AC-3 — explore-camps CTA still present in the empty state | L | unit | `[empty] explore-camps CTA link still present in the empty state` | same | PASS |
| BR-3 regression — `useMinimumLoading` called with default options (no override) | M | unit | `[hook] useMinimumLoading is still called with its default options (no delay/minDisplay override)` | same | PASS |
| BR-3 regression — hook source itself unmodified (delay=300/minDisplay=400 defaults intact) | M | unit | `[hook] the hook source itself is unmodified (still exposes delay=300, minDisplay=400 defaults)` | same | PASS |
| BR-3 regression — `ErrorBanner` still renders with `errorOccurred` copy key | L | unit | `[error] ErrorBanner still renders with the errorOccurred copy key` | same | PASS |
| BR-3 regression — `section--booking-list` wrapper still present | L | unit | `[list] section--booking-list wrapper still present` | same | PASS |
| BR-3 regression — `BookingListSkeleton` still rendered with `count={3}` | L | unit | `[skeleton] BookingListSkeleton still rendered with count={3}` | same | PASS |

17/17 automated tests pass. 2 rows above are `owner-verify` (browser-timing/visual, headless-untestable)
— each is the *visible* half of an AC whose *data/system* half (branch order, wrapper class parity) is
already proven by source-inspection above; consistent with the established split for this page
(CAM-398/CAM-396 test.md precedent), not a coverage gap.

### Coverage-matrix bucket justification (per `.claude/rules/qa.md` §7)

| Bucket | AC-1 | AC-2 | AC-3 |
|---|---|---|---|
| normal | ✅ skeleton wrapper carries `md:w-64 h-48 md:h-auto`, inner Skeleton fills it | ✅ `showSkeleton` checked first, `isLoading` gates next | ✅ empty branch renders `noBookingsYet` + CTA when genuinely empty |
| null/empty | ⚪ N/A — no null-input surface in this diff (pure CSS classes) | ✅ the delay window IS the `bookings=[]`+`isLoading=true` empty-array case — proven to render `null`, not the empty-state JSX | ✅ `bookings.length === 0` is itself the null/empty case under test |
| boundary | ⚪ N/A — no numeric bound in this diff | ✅ EC-1 twin-drift guard = the boundary between "both files match" and "one file drifts" (proven both directions, see § Prove-It) | ⚪ N/A — no bound in this diff |
| error/validation | ✅ Prove-It: pre-fix bare `md:w-64 h-48` (no `md:h-auto`) proven to fail | ✅ Prove-It: pre-fix branch order (`hasError` directly after `showSkeleton`, no `isLoading` gate) proven to fail | ⚪ N/A — no validation surface; AC-3 is a regression guard on unchanged behavior |
| concurrent/ordering | ⚪ N/A — pure CSS, no ordering concern | ✅ this AC's entire mechanism IS ternary-chain ordering (`showSkeleton` → `isLoading` → `hasError` → empty/list) — directly asserted | ⚪ N/A — no ordering concern |

## Prove-It (red-before-green evidence — actually re-run, not asserted from the commit message)

**Full revert (both fixes reverted together)** — checked out the pre-fix (`4209da3~1`) version of
both `app/bookings/page.tsx` and `components/ui/booking-list-skeleton.tsx`, re-ran:

```
npx vitest run __tests__/cam-402-bookings-loading.test.ts
 Test Files  1 failed (1)
      Tests  6 failed | 11 passed (17)
```

The 6 that go RED against the pre-fix source (exactly the ones this fix and this story's tests
guard):
- AC-1: `[skeleton] thumbnail wrapper carries md:h-auto`, `[EC-1 twin-drift guard] ...`, `[EC-1] the
  skeleton wrapper no longer matches the PRE-CAM-398 pinned layout ...`
- AC-2: `[order] isLoading is checked immediately after showSkeleton, before hasError`, `[order] the
  delay-window branch renders null (nothing), not a state`, `[EC-2 Prove-It] empty/error branches
  are unreachable while isLoading is true ...`

Restored `HEAD` (byte-identical, confirmed via `git status --short` empty + `git diff HEAD` empty)
→ re-ran → 17/17 green again.

**Twin-drift guard scrutiny (dispatch-specific: must fail on EITHER side diverging, not just both
at once)** — tested each side independently, restoring to green between runs:

1. Skeleton wrapper only reverted to `md:w-64 h-48 flex-shrink-0` (real card wrapper left fixed):
   ```
   npx vitest run __tests__/cam-402-bookings-loading.test.ts -t "AC-1"
   Tests  3 failed | 2 passed | 12 skipped
   ```
   Fails (3): the two skeleton-specific assertions + the twin-drift guard.

2. Real card wrapper only reverted to `md:w-64 h-48 overflow-hidden relative` (skeleton left fixed):
   ```
   npx vitest run __tests__/cam-402-bookings-loading.test.ts -t "AC-1"
   Tests  1 failed | 4 passed | 12 skipped
   ```
   Fails (1): **only** the twin-drift guard — proving it is the sole assertion in this file that
   would catch a regression introduced on the real-card side rather than the skeleton side (the
   other AC-1 tests only inspect the skeleton file and would silently pass).

Both directions confirmed → the guard has real teeth against drift on either file, restored clean
(`git status --short` empty) after each run.

## a11y check

- `BookingListSkeleton`'s region carries `role="status"` + `aria-busy="true"` + `aria-live="polite"`
  with the `SR_LABEL` (`translations.th.common.loading_sr`) in an `sr-only` span; the decorative
  card rows are `aria-hidden="true"` — unchanged by this fix (regression-guarded, not re-asserted
  here since BR-3 states no a11y-relevant change in scope).
- **Browser-only** (not verified here): a screen reader actually announcing `SR_LABEL` once per
  region, not once per skeleton card row. Not a new AC for this story (unchanged from CAM-247);
  no owner-verify row added since BR-3 scopes this out.

## Full-suite run

```
npx vitest run
 Test Files  5 failed | 161 passed (166)
      Tests  4 failed | 6462 passed (6466)
```

The failures are the pre-existing, environment-dependent ones named in the dispatch (missing
generated `@/prisma/delivery/generated/delivery-client` module in this local worktree — confirmed
via `ls prisma/delivery/generated/` = no such directory, gitignored, produced only by
`npm run delivery:generate`/postinstall — and stale `git diff staging` artifacts), reproduced, not
new:
- `__tests__/delivery-client.test.ts` — 2 tests (`DELIVERY_DATABASE_URL` not set)
- `__tests__/delivery-tickets-api.test.ts` — whole-suite load failure (same missing generated
  module)
- `__tests__/cam-215-sec-a-access-control.test.ts` — whole-suite load failure (same missing
  generated module)
- `__tests__/f5-account-misc.test.ts` / `__tests__/f6-palette-guard.test.ts` — `git diff staging
  --name-only` artifacts (stale local `staging` ref)

No new failures introduced by this story's diff or its tests.

## Coverage (metric honesty)

```
npx vitest run __tests__/cam-402-bookings-loading.test.ts --coverage \
  --coverage.include="app/bookings/page.tsx" \
  --coverage.include="components/ui/booking-list-skeleton.tsx"

Statements   : 0% ( 0/46 )
Branches     : 0% ( 0/46 )
Functions    : 0% ( 0/18 )
Lines        : 0% ( 0/44 )
```

This is a real, measured number, reported honestly — **not** "not measured." It reads 0% because
every assertion reads the component/skeleton source as a **string** (`fs.readFileSync`) rather than
importing/executing/rendering it, so V8's instrumentation never sees the file execute — a
structural property of the source-inspection layer (see strategy note above), identical to the
precedent in `cam-398`'s test.md. The behavioral floor for this diff is the **AC→test matrix above
(17/17 automated PASS)** plus the **Prove-It red/green demonstration** (6 assertions proven to fail
on the pre-fix source, including the two-directional twin-drift scrutiny), not the v8 %. The
story's diff is +10/-4 lines across the two production files (per commit `4209da3` stat); every
changed line (the `isLoading ? null :` insertion, the `md:h-auto` class addition, both updated
comments) has a direct 1:1 assertion above.

## Quality gate summary (self-verify, QA scope)

- `npm run lint`: 0 errors, 247 pre-existing warnings (none new, none in the touched files).
- `npm run typecheck`: 0 new errors; remaining errors are the pre-existing missing-generated-module
  ones (`@/prisma/delivery/generated/delivery-client`), identical on the unmodified branch (23
  errors, all trace to the same missing `prisma/delivery/generated/` directory — a worktree
  environment gap, not caused by this diff).
- `npx vitest run __tests__/cam-402-bookings-loading.test.ts __tests__/cam-398-bookings-list.test.ts`:
  37/37 pass.
- `npx vitest run` (full suite): 6462/6466 pass, 4 known env-dependent failures (see above), no new
  failures.
- `npm run build`: not run by QA — no production code changed by this dispatch (the fix already
  landed pre-dispatch on branch `fix/cam-402-bookings-loading`); build is covered by CI per the PR.
- `npm audit`: out of scope for QA — routes to `security`.

## Defects found

None. The shipped fix (branch `fix/cam-402-bookings-loading`, PR #457) matches every AC/BR/EC; the
twin-drift guard is proven to catch drift introduced from either file independently (§ Prove-It).

## Owner-verify (localhost, dev DB) — before Done

Per `.claude/rules/ops.md` §3 (AC verified on localhost before merge into `dev`):

1. Throttle network to Slow 3G (or add an artificial delay to `/api/bookings`) on localhost, open
   `/bookings` → watch the first ~300ms: the async region under the header must show nothing (no
   `ยังไม่มีการจอง` flash) before the skeleton (or the real list, if data arrives fast) appears.
2. With the throttle still active, once the skeleton shows: at ≥768px (desktop), the skeleton's
   left-column thumbnail block must fill the full row height with zero visible gap beneath it,
   matching the real card's loaded appearance exactly (no layout shift when data arrives).
3. Let the fetch complete normally with zero bookings → confirm `ยังไม่มีการจอง` + the explore CTA
   still render exactly as before (AC-3, no regression).
4. Resize to mobile width during the loading state → confirm the skeleton's mobile stacked layout
   is unchanged (base `h-48`, no `md:*` classes active).

## Links

`story.md` (AC/BR/EC/Seams) · `.claude/rules/qa.md` · `__tests__/cam-402-bookings-loading.test.ts` ·
`__tests__/cam-398-bookings-list.test.ts` (CAM-398 precedent, real-card wrapper source) ·
`app/bookings/page.tsx` · `components/ui/booking-list-skeleton.tsx` ·
`lib/hooks/use-minimum-loading.ts` · precedent: `.../CAM-398-.../test.md` (source-inspection +
owner-verify split pattern for this same page)

## Changelog
- v1 (2026-07-18) — created; QA verification pass (AC→test matrix, Prove-It red/green including
  two-directional twin-drift scrutiny, full-suite + coverage run)
