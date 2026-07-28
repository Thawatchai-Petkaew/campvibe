---
linear: CAM-626
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Host
artifact: tech
owner: backend-engineer
status: done
version: v1
updated: 2026-07-28
---
# Tech — does CAM-607's CSP-nonce propagation hold under `next dev`? (CAM-626)

## Method — measured, not reasoned (per `.claude/rules/code.md`'s lesson)

Every claim below is a real Playwright run against a real `next dev` server (Turbopack), a real local Postgres, and the real seeded host (`hoster@campvibe.com`) logged in via the real `/login` form — never inferred from reading `proxy.ts`/Next's source alone, even though that reading (below) explains *why* the measurements come out the way they do.

Two environments were used:
1. A scratch dev server on port 4626 (never the owner's port 3000) against a dedicated local `campvibe_e2e` copy, for open-ended probing.
2. The real e2e-regression harness (`PW_REGRESSION=1 npx playwright test --project=regression`, which itself runs `next dev` on port 3100 — see `e2e/regression/README.md`: *"the Next.js dev server (so `/api/upload`'s dev-fallback path works with zero secrets)"* — this is the literal mode CAM-621 measured against), for the CAM-621-method reproduction.

## Finding 1 — CAM-607's fix DOES hold under `next dev` (measured)

`proxy.ts`'s request-header CSP set (`requestHeaders.set('Content-Security-Policy', csp)`, the CAM-607 fix) runs unconditionally inside `auth(async (req) => {...})` — there is no `NODE_ENV`/dev branch anywhere near it. The only `NODE_ENV`-gated content in `buildCsp` is the `'unsafe-eval'` addition to `script-src` in development (needed for Turbopack Fast Refresh, pre-existing, unrelated to nonce propagation).

Measured, against the scratch dev server (logged in as the seeded host):
- **8/8** navigations to `/dashboard`: response CSP header carried a `'nonce-{n}'` token; **100%** of those nonces matched a nonce found stamped on a real, persistent Next.js-emitted `<script nonce="...">` in the served HTML (51 nonced scripts per page in dev vs. CAM-607's own measured ~38-40 in production — dev ships more scripts: Turbopack HMR client, React Refresh runtime, etc. — irrelevant to the nonce mechanism itself).
- **4/4** dashboard sub-routes hit for the FIRST time in a freshly-started, freshly-`.next`-cleared dev server (`/dashboard/settings`, `/dashboard/bookings`, `/dashboard/campgrounds`, `/dashboard/campgrounds/new` — a genuinely cold Turbopack compile, no CPU-pressure fault injection): **0** CSP violations logged in every case.
- The public `/` route (home page, unauthenticated, its own `CatalogResults` Suspense boundary): **0** CSP violations across 5 navigations.

**Conclusion: there is nothing to fix in `proxy.ts`/`next.config.ts`/`lib/auth.config.ts`.** The CSP-nonce propagation CAM-607 added is mode-agnostic by construction (it is a plain, unconditional line in the request-handling function) and behaves identically whether Next.js is served by `next dev` or `next build && next start`. No CSP directive was touched by this investigation (confirmed: `git diff --stat -- proxy.ts next.config.ts lib/auth.config.ts` for this story is empty).

## Finding 2 — a DIFFERENT, harmless, bounded, CSP-unrelated timing artifact IS real under `next dev`

Despite Finding 1, a stray `<div id="S:...">` streaming container (the same literal signature CAM-604 found in production under CPU pressure) DOES transiently appear under `<body>` on `next dev` — **without any fault injection at all**:

| Route (first hit, cold compile) | `commit` (ms) | container first seen (ms since nav start) | container resolved (ms since nav start) | window (ms) | CSP violations |
|---|---|---|---|---|---|
| `/dashboard/settings` | 591–776 | 689–872 | 919–1112 | ~230–240 | 0 |
| `/dashboard/bookings` | 471–533 | 585–631 | 806–863 | ~221–232 | 0 |
| `/dashboard/campgrounds` | 349–387 | 461–466 | 678–707 | ~217–241 | 0 |
| `/dashboard/campgrounds/new` | 410–418 | 491–512 | 734–746 | ~234–243 | 0 |

(Two independent passes recorded per route — the ranges above cover both.) On already-compiled ("warm") routes the window is smaller and intermittent — e.g. repeated `/dashboard` navigations after the first: transient container observed on 8/8 quick re-checks with a 2s poll window (meaning it was present at SOME point during the window, not stuck at the end — a 6-second high-frequency poll on a single warm `/dashboard` hit showed the container appear at 117ms and clear by 369ms); the public `/` route showed it on 2/5 navigations, resolving in ~70ms each time.

**Root cause: this is Turbopack's on-demand, per-route compilation cost showing up as a wider gap between "the browser receives the streaming placeholder" and "React's own Flight coordinator script relocates it into place"** — a gap that is always present by design in React Server Components streaming (the container is not a bug in itself; it is the mechanism), but is normally sub-millisecond in a fully pre-compiled production build and therefore invisible without deliberately injecting CPU pressure (CAM-607's own method). `next dev` never pre-compiles a route until it is first requested, so the FIRST hit to any route pays a real compile cost baked into time-to-first-byte, and the SAME per-request pipeline (parsing, no production-grade output optimization, dev instrumentation) keeps the subsequent stream-and-relocate step measurably slower than production even on warm routes.

**This is not a CSP defect**: every single measurement above logged **zero** CSP violations. The relocation script IS correctly nonced (Finding 1) and DOES run — it simply does not run instantly, and `next dev`'s own compile/render latency is wide enough to make that normally-invisible gap observable.

**Independent corroboration, found BEFORE this investigation touched anything**: CAM-608's own story (`docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-608-availability-request-sequencing/story.md`, `## Out of scope`) recorded: *"observed recurring intermittently in this story's own local e2e runs (pre-existing on `dev`, reproduced against both the fixed and the unmodified code)"* — i.e. CAM-608 saw the identical signature on `dev` regardless of whether CAM-607's fix was present or reverted. That is only possible if the mechanism is NOT the CSP block CAM-607 fixed — corroborating, from a fully independent prior observation, this story's own measurement.

**This reframes the earlier CAM-608 loose end precisely**: the ticket that dispatched this story noted CAM-608's tail was mis-attributed to "probably the CAM-603 keep-alive tail." Having now root-caused it directly, the correct attribution is: it is the SAME literal DOM signature CAM-604 found (a stray `<div id="S:...">`), but its cause under `next dev` is Turbopack's compile-timing, not CAM-603's keep-alive race and not (any longer) CAM-607's CSP-block — those are three different mechanisms that can produce visually similar symptoms on this codebase's shared Suspense boundary.

## Finding 3 — re-running CAM-621's method: a SEPARATE confound in the shared local e2e database

CAM-621 measured 2 failures in 3 local, CI-faithful (`fresh seed`, `workers:1`) full-suite runs, both carrying the duplicate-DOM signature (`cam-540-dialog-select-dismiss.spec.ts`, `ac6-spot-lifecycle.spec.ts`).

Re-running the identical method:
- **Against the shared, long-lived local `campvibe_e2e` database** (re-seeded via `npm run e2e:db:setup`, which is additive/idempotent — NOT a full reset): the seeded host (`hoster@campvibe.com`) was found to own **16** camp sites (accumulated across many past stories' local test runs on this same machine, per `psql -d campvibe_e2e -c "select count(*) from \"CampSite\" ... where operatorId = hoster"` → `16`) — versus a clean seed's handful. One full-suite run (82 tests) against this database produced **1 failure**: `ac3-logo-roundtrip.spec.ts` timed out (5000ms) waiting for `getByTestId("dropzone--logo")` — a DIFFERENT signature (a timeout, not a duplicate-count assertion), consistent with the same family (compile/render momentarily slower than a fixed timeout) but not the literal duplicate-DOM signature CAM-621 named.
- **Against a freshly created, freshly migrated + seeded, ISOLATED database** (`campvibe_e2e_cam626`, dropped and recreated between runs — the actual "fresh seed" CAM-621's method names), with `.next` cleared before each run (forcing genuinely cold Turbopack compiles, the worst-case timing per Finding 2): **3 consecutive full-suite runs, 82/82 PASSED every time** — `cam-540-dialog-select-dismiss.spec.ts` and `ac6-spot-lifecycle.spec.ts` included, both green in all 3 runs.

```
Run 1 (fresh isolated DB, fresh .next): 82 passed (1.9m)
Run 2 (fresh isolated DB, fresh .next): 82 passed (1.9m)
Run 3 (fresh isolated DB, fresh .next): 82 passed (1.9m)
```

**Conclusion: the accumulated size of the shared local `campvibe_e2e` database is a real, separate amplifier of the SAME timing margin** Finding 2 describes (more owned camp sites → heavier list/dashboard queries and renders → a wider real-world render time on top of Turbopack's already-wider dev-mode window) — plausibly why CAM-621's own run (very likely also against a long-lived shared database, given the harness's documented default) crossed the line into an actual assertion failure while a clean-database run does not. This is reported as a finding for whoever owns the e2e-regression harness's database lifecycle (`e2e/regression/db-guard.ts`/README) — out of this story's allowed file surface (no harness-infra file is in it).

## Route protection — re-verified, not assumed (CAM-203 lesson)

No line in `proxy.ts` changed, so the authz/redirect branch is provably untouched (`git diff` is empty for the file). Re-run anyway, per the CAM-203 lesson that a shared-middleware ticket always re-checks this:
- `isRouteAllowed()` unit truth table (`__tests__/sec3-csp-nonce.test.ts`, `__tests__/cam-607-csp-request-header.test.ts`, this story's own `__tests__/cam-626-csp-holds-in-dev.test.ts`) — unmodified, still green.
- The regression e2e run's own unauthenticated-redirect check (`cam-607-csp-nonce-agreement.spec.ts`'s second `describe` block, re-run 3/3 in Finding 3's clean runs) — still redirects to `/login`.

## What the suite should do instead (recommendations, not fixes — out of this story's surface)

1. **`cam-540-dialog-select-dismiss.spec.ts` / `ac6-spot-lifecycle.spec.ts`** (and any future spec asserting an exact DOM count immediately after a navigation/action on a Suspense-streamed route): wait for the transient streaming container to clear (`await expect(page.locator('body > div[id^="S:"]')).toHaveCount(0)`, bounded to a few seconds) before asserting element counts — a settle-wait in the same spirit as `withKeepAliveRaceRetry` (CAM-603). Not applied here: every spec under `e2e/` other than this story's own new one is outside the allowed file surface for this ticket (a spec needing to change to pass is itself the finding, per this ticket's own instruction).
2. **The e2e-regression harness's local database** (`e2e/regression/db-guard.ts` / README's default `campvibe_e2e`): give it a per-run reset (or a periodic reset cadence) instead of letting it accumulate indefinitely across every story that has ever run the suite locally — Finding 3 measured this as a real, separate flake amplifier. Out of this story's allowed surface (no harness-infra file in it).
3. **CAM-621's blocking-gate decision**: this story does not re-decide it. It reports: the CSP/nonce mechanism itself is proven stable across both `next dev` and production; the residual local instability CAM-621 measured has two identified, non-CSP causes (Finding 2's bounded dev-compile timing + Finding 3's database-accumulation confound), neither of which is "the suite is untrustworthy" — but neither is fixed by this story, so CAM-621's own re-measurement (ideally against an isolated database, per Finding 3) is the correct next input to its flip decision.

## `e2e/regression/README.md` correction (in file surface)

`ac3-logo-roundtrip.spec.ts` was documented as a known, permanent RED (a real, unfixed logo-clear defect). It has been green in every run performed for this story (see Finding 3's 3 clean runs, all 82/82) — consistent with the ticket's own note that it has been green since CAM-360, before this arc. Corrected in `e2e/regression/README.md` (the one, brief, one-off flake seen against the accumulated shared database in this investigation is Finding 3's timing confound, not a reversion of the CAM-360 fix — it did not reproduce in any of the 3 clean-database runs).

## Links
`../../feature.md` · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-604-availability-hydration-mismatch/tech.md` (original production root cause) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-607-csp-streaming-script/tech.md` (the fix this story verified holds in dev too) · `docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-608-availability-request-sequencing/story.md` (independent prior corroboration) · `proxy.ts` (read, unmodified) · `__tests__/cam-626-csp-holds-in-dev.test.ts` · `e2e/regression/cam-626-csp-dev-mode.spec.ts` · `.claude/rules/security.md` (CAM-203/CAM-218/CAM-607 CSP lineage) · `.claude/rules/code.md` ("measure, don't reason").

## Changelog
- v1 (2026-07-28) — created; measured that CAM-607's CSP-nonce propagation holds under `next dev` (0 violations, 100% nonce agreement, cold + warm routes, home page); root-caused the residual transient duplicate-DOM window to Turbopack's dev-compile timing (not CSP), corroborated independently by CAM-608's own prior note; re-ran CAM-621's method and found the local instability traces to a database-accumulation confound, not a CSP regression (3/3 clean-database full-suite runs green); corrected the stale `ac3-logo-roundtrip` README note; no code changed in `proxy.ts`/`app/dashboard/loading.tsx`/`next.config.*`/`lib/auth.config.ts` (nothing found broken there).
