---
linear: CAM-398
feature: booking-reliability
epic: booking-reliability-every-camper-can-complete-a-bo (CAM-395)
persona: camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — Bookings list works: click through to the booking detail and the image fills its frame (CAM-398)

## Test strategy note (read first)

`app/bookings/page.tsx` is a `"use client"` component with `LanguageContext`/`useRouter`/lucide dependencies and no jsdom/RTL render harness in this repo's Vitest config (`environment: 'node'`). This matches the established, repo-wide pattern for this exact page (`__tests__/cam-61-booking-detail.test.ts`, `__tests__/cam-194-perf4-next-image.test.ts`, `__tests__/booking-status.test.ts`) — static source-inspection (assert on the shipped `.tsx` text) is the correct layer here, not a shortcut. Every assertion is a **Prove-It**: demonstrated failing against the pre-fix source (see § Prove-It below), passing against the fix.

**What this does NOT cover** (browser-only, requires a manual owner check on the real localhost/dev URL, or Playwright e2e): a real mouse click on the card literally navigating in the browser, the visual absence of a gap under the image at a desktop viewport, and keyboard `Tab`+`Enter` on the "ดูรายละเอียด" link literally moving focus and navigating. These are marked **owner-verify** below.

## AC→test matrix

| AC/EC | risk (H/M/L) | type | test (it-block name) | file | pass/fail |
|---|---|---|---|---|---|
| AC-1/BR-1 — card body navigates to `/bookings/{id}` | H | unit (source-inspection) | `[card] card div navigates via router.push(...)` | `__tests__/cam-398-bookings-list.test.ts` | PASS |
| AC-1/BR-1 — "ดูรายละเอียด" button navigates to `/bookings/{id}` | H | unit | `[button] "ดูรายละเอียด" Link hrefs /bookings/${booking.id}` | same | PASS |
| AC-1/BR-1 — broken `/campgrounds/undefined` target fully removed | H | unit | `[button] the broken /campgrounds/undefined target (nameThSlug) is fully removed` | same | PASS |
| AC-1 — card root is a valid HTML wrapper (div, not nested `<a>`) | M | unit | `[card] the booking card root is a plain <div> ...` | same | PASS |
| AC-1 — nested Cancel control doesn't double-fire card navigation | H | unit | `[nested-interactive] Cancel button stopPropagation ...` | same | PASS |
| AC-1 — nested "ดูรายละเอียด" control doesn't double-fire card navigation | H | unit | `[nested-interactive] view-details Button stopPropagation ...` | same | PASS |
| AC-1 — visible result (click literally navigates) | H | **owner-verify** (browser-only) | manual: click the card body AND click "ดูรายละเอียด" on localhost → both land on `/bookings/{id}` (not `/campgrounds/undefined`) | — | pending owner check on dev |
| AC-1 — a11y: keyboard reaches the same route | H | unit (source-inspection, negative) + **owner-verify** | `grep` confirms no `tabIndex`/`aria-hidden`/`pointer-events-none`/`role=` overrides anywhere in the file (nothing suppresses the Link's native focusability); real `Tab`+`Enter` reaching `/bookings/{id}` is browser-only | same + manual | PASS (source) / pending owner check (behavior) |
| AC-2/BR-2 — image wrapper uses `md:h-auto`, drops `md:aspect-[4/3]` | H | unit | `[wrapper] image wrapper uses md:h-auto` / `does NOT use md:aspect-[4/3]` | same | PASS |
| AC-2/BR-2 — `object-cover` still absorbs the aspect mismatch | M | unit | `[object-fit] ImageWithFallback still uses object-cover` | same | PASS |
| AC-2 — mobile layout unchanged (EC-2) | M | unit | `[wrapper] image wrapper still carries a bare h-48` / `stacked mobile layout class unchanged` | same | PASS |
| AC-2 — visible result (no gap under the image on desktop) | M | **owner-verify** (browser-only, visual) | manual: open `/bookings` at ≥768px on localhost → image fills the left column height, no gap below it | — | pending owner check on dev |
| EC-1 — navigation depends only on `booking.id`, never the campground/campsite slug | H | unit | `[independence] no navigation target ... references campSite/campground slug fields` | same | PASS |
| regression — `section--booking-list`, status badge, `ConfirmDialog` wiring untouched | L | unit | 3 regression guard tests | same | PASS |
| CAM-194 AC-7 supersede — old `aspect-[4/3]` pin correctly flipped to the new canonical (`md:h-auto` + base `h-48`) | H | unit (guard refresh) | `[no-gap]` × 2 + `[bounded]` | `__tests__/cam-194-perf4-next-image.test.ts` | PASS |

20/20 automated tests pass in the new file; 3 tests updated (not weakened — see § Deviation scrutiny) in the sibling CAM-194 guard file. 3 rows above are `owner-verify` (DOM render / visual / real keyboard nav, browser-only) — each is the *visible* half of an AC whose *data/system* half (correct `href`/`onClick` target, no focus-suppressing attribute) is already proven by source-inspection above; this is the standard split for this page per repo precedent (see CAM-396 test.md), not a gap.

### Coverage-matrix bucket justification (per `.claude/rules/qa.md` §7)

| Bucket | AC-1 | AC-2 |
|---|---|---|
| normal | ✅ card + button both push `/bookings/{id}` | ✅ `md:h-auto` present, object-cover absorbs mismatch |
| null/empty | ⚪ N/A — `booking.id` is always present (API always returns it as the Prisma PK); no null-input surface in this diff | ⚪ N/A — missing image src is handled by `ImageWithFallback`, unchanged by this diff |
| boundary | ⚪ N/A — no numeric bound in this diff | ✅ EC-2 mobile (`< md`) vs desktop (`≥ md`) breakpoint boundary |
| error/validation | ✅ the broken `/campgrounds/undefined` target is proven fully removed (`not.toContain('nameThSlug')`) | ✅ `aspect-[4/3]` proven absent (the exact regression class) |
| concurrent/ordering | ✅ nested Cancel/"ดูรายละเอียด" clicks proven to `stopPropagation` (no double-fire race with the card's own `onClick`) | ⚪ N/A — pure CSS, no ordering concern |

## Prove-It (red-before-green evidence — actually re-run, not asserted from the commit message)

Reverted `app/bookings/page.tsx` to the pre-fix `dev` version (`git show dev:app/bookings/page.tsx`) and re-ran both test files:

```
npx vitest run __tests__/cam-398-bookings-list.test.ts __tests__/cam-194-perf4-next-image.test.ts
 Test Files  2 failed (2)
      Tests  14 failed | 66 passed (80)
```

The 14 that go RED against the pre-fix source (exactly the ones this fix and this story's tests are meant to guard):
- `cam-398-bookings-list.test.ts` (12): `[import] useRouter imported`, `[wiring] component calls useRouter()`, `[card] card div navigates via router.push(...)`, `[card] card div carries data-testid="card--booking-item"`, `[card] card div is cursor-pointer`, `[button] "ดูรายละเอียด" Link hrefs .../{booking.id}`, `[button] the broken /campgrounds/undefined target ... is fully removed`, `[nested-interactive] Cancel button stopPropagation ...`, `[nested-interactive] view-details Button stopPropagation ...`, `[wrapper] image wrapper uses md:h-auto`, `[wrapper] image wrapper does NOT use md:aspect-[4/3] anymore`, `[independence] no navigation target ... references campSite/campground slug fields`
- `cam-194-perf4-next-image.test.ts` (2): `[no-gap] bookings image wrapper uses md:h-auto`, `[no-gap] bookings image wrapper does NOT use aspect-[4/3] anymore` — the sibling `[bounded]` `h-48` assertion in the same file still passed pre-fix (since `h-48` was never touched by BR-2), correctly proving that one is a stability guard, not a Prove-It regression assertion. 12 + 2 = 14, matching the run total.

Restored `HEAD` (the fix, byte-identical — confirmed via `git diff --stat` showing no residual change) → re-ran → 80/80 green again.

## Deviation scrutiny — CAM-194 AC-7 guard update (flagged in the dispatch)

Confirmed **canonical-pin refresh, not weakening**. The old guard pinned the CAM-194-era canonical class set (`aspect-[4/3]` present, `h-auto` absent) — which is the exact CSS this story's BR-2 intentionally reverses (provenance `bb6d5d4`). The updated guard now pins the **new** canonical set and is strictly as strict as before:

- Still asserts a **forbidden** class (`aspect-[4/3]` must be absent) — re-adding it fails the test, same as before (direction flipped, specificity unchanged).
- Still asserts a **required** class (previously "no `h-auto`", now "yes `md:h-auto`") — dropping `md:h-auto` fails the test.
- **Added** a third assertion (`h-48` base height must still be present) that the old guard did not have — a strict superset, not a narrowing. This is a stability guard (not a Prove-It regression assertion, since `h-48` was never touched by this fix) confirming the mobile CLS bound survives BR-2.
- The line-selection logic changed from `.find(l => l.includes('aspect-[4/3]'))` to `.find(l => l.includes('md:w-64'))` — this is an *improvement*: the old selector depended on the very class being flipped away, so it would have silently matched the wrong line (or none) after the fix landed; the new selector keys on a stable, unrelated anchor (`md:w-64`) that survives both the old and new canonical states.

Verdict: the update is required to keep the suite green after a legitimate, in-scope CSS change (BR-2) and does not reduce the guard's ability to catch a regression in either direction (re-adding `aspect-[4/3]` OR dropping `md:h-auto` OR dropping `h-48` all fail it).

## a11y check on the click pattern

- The card is a plain `<div onClick=...>` (not `<a>`/`<button>`), avoiding an invalid `<a>`-inside-`<a>` / `<button>`-inside-`<a>` HTML5 content model.
- The real `<Link href={`/bookings/${booking.id}`}>` nested inside is a native anchor — `grep -n "tabIndex\|aria-hidden\|pointer-events-none\|role="  app/bookings/page.tsx` returns **zero matches** in the whole file, confirming nothing suppresses its default focusability or exposes it to assistive tech as non-interactive. The Link is the keyboard/screen-reader-accessible equivalent path to the same route the card's mouse-only `onClick` provides.
- **Honestly browser-only** (not verified here): actually pressing `Tab` to reach the link and `Enter` to navigate, and confirming the focus ring renders per `DESIGN.md`. Named as an owner-verify row above.

## Full-suite run

```
npx vitest run
 Test Files  5 failed | 158 passed (163)
      Tests  4 failed | 6418 passed (6422)
```

The failures are the pre-existing, environment-dependent ones named in the dispatch (missing generated `@/prisma/delivery/generated/delivery-client` module in this local worktree / stale `git diff staging` artifacts) — reproduced, not new:
- `__tests__/delivery-client.test.ts` — 2 tests (`DELIVERY_DATABASE_URL` not set)
- `__tests__/delivery-tickets-api.test.ts` — whole-suite load failure (same missing generated module; not individually named in the dispatch but identical root cause, confirmed by re-running it in isolation)
- `__tests__/cam-215-sec-a-access-control.test.ts` — whole-suite load failure (same missing generated module; same root cause)
- `__tests__/f5-account-misc.test.ts` / `__tests__/f6-palette-guard.test.ts` — `git diff staging --name-only` artifacts (stale local `staging` ref)

No new failures introduced by this story's diff or its new/updated tests.

## Coverage (metric honesty)

```
npx vitest run __tests__/cam-398-bookings-list.test.ts --coverage --coverage.include="app/bookings/page.tsx"

Statements   : 0% ( 0/42 )
Branches     : 0% ( 0/43 )
Functions    : 0% ( 0/15 )
Lines        : 0% ( 0/40 )
```

This is a real, measured number, reported honestly — **not** "not measured." It reads 0% because every assertion reads the component's source as a **string** (`fs.readFileSync`) rather than importing/executing/rendering it, so V8's instrumentation never sees the file execute — a structural property of the source-inspection layer (see strategy note above), identical to the precedent in `cam-396`'s test.md and `cam-194`'s own file. The behavioral floor for this diff is the **AC→test matrix above (20/20 automated PASS)** plus the **Prove-It red/green demonstration** (14 assertions proven to fail on the pre-fix source), not the v8 %. The story's diff to `app/bookings/page.tsx` is +28/-6 lines (per PR #452 stat); every changed line (the `useRouter` import/call, the card `onClick`/`data-testid`/`cursor-pointer`, the wrapper class swap, both `stopPropagation` calls, the `href` swap) has a direct 1:1 assertion above.

## Quality gate summary (self-verify, QA scope)

- `npm run lint`: 0 errors, 247 pre-existing warnings (none new, none in the touched test files).
- `npm run typecheck`: 0 errors in touched files; remaining errors are the pre-existing missing-generated-module ones (`@/prisma/delivery/generated/delivery-client`), identical on the unmodified branch.
- `npx vitest run __tests__/cam-398-bookings-list.test.ts __tests__/cam-194-perf4-next-image.test.ts`: 80/80 pass.
- `npx vitest run` (full suite): 6418/6422 pass, 4 known env-dependent failures (see above), no new failures.
- `npm run build`: not run by QA — no production code changed by this dispatch (the fix already landed pre-dispatch); build is covered by CI per the PR.
- `npm audit`: out of scope for QA — routes to `security`.

## Defects found

None. The shipped fix (branch `fix/cam-398-bookings-list`, PR #452) matches every AC/BR/EC; the CAM-194 guard update is a legitimate canonical-pin refresh (see § Deviation scrutiny), not a defect or a weakening.

## Owner-verify (localhost, dev DB) — before Done

Per `.claude/rules/ops.md` §3 (AC verified on localhost before merge into `dev`):

1. Open `/bookings` on localhost with ≥1 booking → click anywhere on a booking card (not on the Cancel button) → lands on `/bookings/{id}` (not `/campgrounds/undefined`, not a 404).
2. From the same list, click the "ดูรายละเอียด" button specifically → also lands on `/bookings/{id}` for that same booking.
3. Resize to ≥768px (desktop) → the photo fills the full height of its column with no visible gap beneath it; resize back to mobile → layout is still the original stacked card with `h-48` image (no regression).
4. `Tab` from the page header into a booking card → confirm focus reaches the "ดูรายละเอียด" link (visible focus ring per `DESIGN.md`) and `Enter` navigates to the same `/bookings/{id}` route.

## Links

`story.md` (AC/BR/EC/Seams) · `.claude/rules/qa.md` · `__tests__/cam-398-bookings-list.test.ts` · `__tests__/cam-194-perf4-next-image.test.ts` (AC-7, superseded per BR-2) · `app/bookings/page.tsx` · precedent: `docs/specs/.../CAM-396-.../test.md` (owner-verify split pattern), `__tests__/cam-61-booking-detail.test.ts` (source-inspection precedent for this same page)

## Changelog
- v1 (2026-07-18) — created; QA verification pass (AC→test matrix, Prove-It red/green, deviation scrutiny, full-suite + coverage run)
