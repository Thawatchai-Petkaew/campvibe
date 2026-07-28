## Story
As the **Host**, I want the availability screen (`/dashboard/campsites/[id]/availability`) to render exactly once with no server/client content disagreement, so that I never see a flash of the wrong month/date state, no effect fires twice on this screen, and the exact double-render class that produced a real last-write-wins race elsewhere (CAM-359) cannot hide here too.
Why: found by CAM-603 under deliberate CPU-pressure fault injection while it was hunting an unrelated e2e-harness failure, and reported (not fixed) because product code was outside that story's file surface — that restraint earned this ticket a known reproduction route instead of a guess.
Scope: read the real React hydration warning on this route (not guessed), remove the divergence at its source where the source is inside this story's file surface, and report — not fix — any divergence whose true source is shared infrastructure outside it. Does not touch `contexts/LanguageContext.tsx`, `app/dashboard/loading.tsx`, or `proxy.ts` (all shared, other screens depend on them).
Depends on: CAM-603 (found and reported this, folded in as this ticket) · CAM-359 (the requestId-gate lesson this investigation checked this route against)

## AC
<!-- This route has no end-user-visible AC of its own (a hydration mismatch is a defect, not a feature) — the "Then" column is what a developer/QA/CI observes, matching the CAM-603 precedent for this kind of hardening ticket. -->
| # | Given | When | Then (developer/CI observes) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The availability page's `AvailabilityCalendar` renders on the server, then hydrates on the client | The server's render and the client's first (hydrating) render evaluate `new Date()` at two different instants that happen to straddle a day/month boundary | No hydration-mismatch console error for `today`/`month`-derived output — the exact React warning ("server rendered HTML didn't match the client properties... Variable input such as `Date.now()`") is suppressed, scoped only to the elements that read `today`/`month` | `components/availability-calendar.tsx`'s `today`/`month` divergence is neutralized at the elements that render it (`suppressHydrationWarning`, not a broad wrapper) | EC-1 |
| AC-2 | The availability route is navigated to cold (no fault injection, ordinary load) | The page finishes hydrating | `btn--availability-add` and `section--availability-calendar` each resolve to exactly ONE element; zero hydration-pattern console errors | Regression-guarded by `e2e/regression/cam-604-availability-renders-once.spec.ts` | EC-2 |
| AC-3 | The SAME route is navigated under deliberate, heavy CPU-pressure fault injection (CAM-603 §4.3 method: 7 saturating child-process busy-loops on a cold Turbopack/production build) | The page streams and hydrates under that pressure | A SEPARATE, dominant defect reproduces reliably (not this story's AC-1 mechanism): the entire page subtree renders twice — once correctly inside `<main>`, once stuck inside a leftover React-Flight streaming container `<div id="S:1">` directly under `<body>` — caused by the app's CSP (`proxy.ts`) blocking Next.js's own inline segment-relocation `<script>` (`Executing inline script violates... action has been blocked`, present on every navigation) | Reported, not fixed — the true source (`proxy.ts` CSP nonce vs Next.js's streaming-relocation script, exercised via the Suspense boundary from `app/dashboard/loading.tsx`) is shared infrastructure outside this story's file surface | — (this is the finding this story reports; a follow-up ticket owns fixing it) |

## Rules
- BR-1 `suppressHydrationWarning` is applied ONLY to the elements whose rendered output reads `today`/`month` (the month-label `<span>`, the two calendar-nav `<Button>`s' `disabled` attribute, and each day-cell's className + day-number text) — never a broad wrapper around the whole component. (proves AC-1)
- BR-2 The Vitest Prove-It (`__tests__/cam-604-availability-calendar-hydration.test.ts`) imports the REAL `AvailabilityCalendar` (not a stand-in) and drives a real `renderToString` → `hydrateRoot` pass across a simulated local-midnight crossing — verified failing-red with the fix removed, green with it restored (recorded in `tech.md`). (proves AC-1)
- BR-3 The e2e regression spec (AC-2) runs under NORMAL load, never fault-injected — a fault-injected assertion on a bug this PR cannot fix (AC-3) would be exactly the flaky-test trap `.claude/rules/qa.md` warns against. (proves AC-2)
- BR-4 The AC-3 finding is reported with the literal evidence (console CSP-violation text + the duplicated node's DOM ancestor chain showing the `#S:1` streaming container) — never presented as fixed or as this story's own root cause. (proves AC-3)

## Edge cases
- EC-1 IF a future change reintroduces an UNSCOPED `suppressHydrationWarning` (e.g. on the whole `AvailabilityCalendar` wrapper) THEN it silences unrelated real mismatches too — guarded by BR-1's scoping + the Prove-It asserting the specific elements, not a wrapper.
- EC-2 IF a future in-surface change (page.tsx / availability-calendar.tsx / host-holds-section.tsx) adds a new render-time non-deterministic value (a new `Date.now()`, `Math.random()`, or a `window`/`localStorage` read outside an effect) THEN the AC-2 e2e spec's zero-hydration-console-error assertion is the standing guard that would catch it once it's large enough to surface without fault injection.

## Data
- No schema/migration. Touches `components/availability-calendar.tsx` only (`suppressHydrationWarning`, scoped + commented) + new test files (`__tests__/cam-604-availability-calendar-hydration.test.ts`, `e2e/regression/cam-604-availability-renders-once.spec.ts`) + this docs folder.

## Seams & refs
- Reuse: none needed — the fix is additive attributes on existing elements, no new component.
- Refs: CAM-603 (`docs/specs/.../CAM-603-e2e-midrun-abort/tech.md` — where this was first found) · CAM-359 (the requestId-gate precedent checked against, see `tech.md` §"the discarded first pass") · React docs' own sanctioned `suppressHydrationWarning` pattern for a live-clock value (https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content).

## Out of scope
- Fixing the CSP-vs-streaming-relocation-script defect named in AC-3 → this lives in `proxy.ts` (shared middleware, security-critical) and `app/dashboard/loading.tsx` (shared Suspense boundary, every `/dashboard/**` route depends on it) — both outside this story's file surface. Follow-up ticket to be filed by the orchestrator/PO, owned by whoever handles CSP/security infra.
- Investigating whether the AC-3 defect also affects OTHER `/dashboard/**` routes (it plausibly does, since the mechanism is route-agnostic) → the follow-up ticket's scope, not this one's.
- Moving the language preference from `localStorage`-only to a cookie the server can read (would eliminate an unrelated CSR-vs-SSR risk noticed while investigating, see `tech.md`) → `contexts/LanguageContext.tsx` is shared; out of this story's file surface.

## Self-verify
- AC-1 → unit (Prove-It): `__tests__/cam-604-availability-calendar-hydration.test.ts`, 3 cases — real component, real `renderToString`/`hydrateRoot`, real day-boundary crossing; verified red without the fix, green with it (see `tech.md`).
- AC-2 → e2e: `e2e/regression/cam-604-availability-renders-once.spec.ts`, run locally against the regression project (`PW_REGRESSION=1`, seeded host + `khao-kho-mountain-camp-6`) — 2/2 passed (setup + spec).
- AC-3 → owner-verify (investigation record, not a test asserting fixed behavior since it isn't fixed here): full reproduction steps, evidence, and the DOM ancestor-chain proof are in `tech.md`.
- Gate = `/quality-gate` — `npm run lint` (0 errors) · `npm run typecheck` (clean) · `npm run check:ds` / `check:palette` (0 violations) · targeted vitest green · full `npx vitest run` green (see PR checks). `npm run build` skipped per dispatch instruction (dev-only route work, no build-affecting change).

## Changelog
- v1 (2026-07-28) — created; fixed the in-surface `new Date()`-in-render divergence (`suppressHydrationWarning`, scoped) with a real Prove-It; investigated and reported (not fixed) the dominant CSP-vs-streaming-relocation defect found under fault injection, which lives in shared infrastructure outside this story's file surface.
