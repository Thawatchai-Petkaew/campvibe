---
linear: CAM-603
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: Platform
artifact: tech
owner: devops-release
status: in-progress
version: v1
updated: 2026-07-28
---
# Tech — the e2e-regression suite aborts mid-run in CI (CAM-603)

## The failure, and the two facts that pull in opposite directions

Verbatim, from promote PR #679:
```
✘ 2 [regression] › e2e/regression/ac1-edit-round-trip.spec.ts:16:5 › edit round trip: updated nameTh + priceLow persist across save + reopen (6.3s)
    Error: apiRequestContext.get: socket hang up
      - → GET http://localhost:3100/api/campsites/6c4d33ce-97ab-423f-b7fb-d1c3984d6f33
[WebServer] ⨯ Error: aborted
```
The test never reached an assertion — `apiRequestContext.get` matches `getCampSite` in `e2e/regression/helpers.ts:52` (the READ-BACK check inside `ac1-edit-round-trip.spec.ts`, called after the PUT). A re-run of the identical tree passed.

- Toward environmental: the first sighting (CAM-586, folded into this ticket) was on PR #667, a change touching ONLY `scripts/ticket-sync.mjs` — a CLI the app never imports. That diff cannot reach the camp-edit path.
- Against assuming environmental: `.claude/rules/qa.md` treats a flaky test as a DEFECT REPORT until root-caused — CAM-359 (ac6, a real last-write-wins race) and CAM-346 (a real stream-drain race) were both "flakes" that turned out to be real product bugs.

## What was measured, and how

### 1. Pulled the REAL PR #679 CI run (not a re-telling)

```
gh pr view 679 --repo Thawatchai-Petkaew/campvibe --json baseRefName,headRefName,number
gh run list --repo Thawatchai-Petkaew/campvibe --branch dev --limit 20
gh run view --job 90153319544 --repo Thawatchai-Petkaew/campvibe --log
```
The ONLY recorded CI run for that PR (`run_attempt: 1` — never re-run) shows **60/60 passed**, `e2e-regression` job conclusion `success`, and — critically — the identical log line appears in it too, harmlessly, right after `ac6-spot-lifecycle` (test #7, 15.3s) and before `cam-540-dialog-select-dismiss` (test #8):
```
✓   7 [regression] › ac6-spot-lifecycle.spec.ts ... (15.3s)
[WebServer] ⨯ Error: aborted
    at ignore-listed frames { code: 'ECONNRESET' }
✓   8 [regression] › cam-540-dialog-select-dismiss.spec.ts ... (8.6s)
```
This is the run the ticket's "a re-run of the identical tree passed" line refers to. It proves the abort event ITSELF is not fatal by default — most of the time it is harmless noise. It does NOT by itself explain why ac1 died on the ORIGINAL (unrecorded/superseded) attempt.

### 2. Reproduced the identical signature locally, on demand (CAM-578 — this no longer needs CI)

Set up an isolated local e2e DB (`campvibe_e2e_cam603`, never the shared `campvibe_e2e` another agent might be using) via `npm run e2e:db:setup`, then ran the real regression project repeatedly:
```
DATABASE_URL="postgresql://...campvibe_e2e_cam603" AUTH_SECRET=... NEXTAUTH_URL="http://localhost:3100" \
  AUTH_TRUST_HOST=true PW_REGRESSION=1 E2E_PORT=3100 \
  npx playwright test --project=regression --workers=1 e2e/regression/ac1-edit-round-trip.spec.ts e2e/regression/ac6-spot-lifecycle.spec.ts
```
`--workers=1` matches the CI job's own `workers: process.env.CI ? 1 : undefined` (serial, matching the real conditions — not the locally-default parallel workers, which also reproduced it but via a different, concurrency-driven path not worth conflating). Across ~6 runs: the identical `[WebServer] ⨯ Error: aborted {code:'ECONNRESET'}` line fired in roughly half of them, at varying points (once right after the `regression-setup` project's login test, before `ac1` even started; once between `ac1` and `ac6`) — i.e. it is NOT specifically tied to `ac6`'s weight. The suite still passed 3/3 in every one of those runs. **The "immediately after ac6" positioning in the original CI log is best read as coincidental (whichever spec happens to be running at that point in the sequence), not causal** — directly contradicted by this local evidence showing the same event at other points in the sequence.

Additionally found (same local run) a structured, ALREADY-INSTRUMENTED log line:
```
[WebServer] {"level":"warn","event":"request_aborted_by_client","message":"client disconnected mid-request; request abandoned, process survived"}
```
This is `lib/observability/abort-guard.ts` (CAM-406) — read, not edited (out of this story's file surface; `lib/**`). Its own docstring states, as an already-verified finding: Next.js 16.2.9 installs its own forgiving `uncaughtException`/`unhandledRejection` handler that logs `Error: aborted {code:'ECONNRESET'}` (from a client disconnecting mid-request against `next dev`) and does **not** call `process.exit` — by design, so one bad request never kills the dev server. CAM-406's guard adds only a clearer structured log on top; it never rethrows (verified in that file's own history: an earlier rethrow-based draft turned an unrelated, previously-survived error into a hard crash — the opposite of this story's goal).

**This means the exact error class in this ticket's failure is a pre-existing, already-diagnosed, already-survived-by-design class in this exact codebase** — not a new mystery.

### 3. Named a concrete, testable mechanism for WHY it is usually harmless but can occasionally fail a real `request.*` call

Verified via source, not assumed:
- `next dev` never sets `keepAliveTimeout` — only `next-start.js` (`node_modules/next/dist/cli/next-start.js:75`) reads a `keepAliveTimeout` CLI option and threads it to `start-server.js`; `next dev` has no such flag. So Node's own default (`server.keepAliveTimeout = 5000`ms) governs the dev server used by this suite.
- Playwright's `APIRequestContext` (the `request` fixture every regression spec's `request.get/put` call shares) is built with `keepAlive: true` (confirmed: `grep -o "keepAlive[^,}]*" node_modules/playwright-core/lib/coreBundle.js` → `keepAlive: true`), with no matching idle-timeout of its own.
- This is the textbook Node.js keep-alive race: a client that reuses a pooled connection right as the server's idle timer destroys the socket can lose the race — server sees `Error: aborted {code:'ECONNRESET'}`, client sees `socket hang up`. Browsers (Chromium, driving every `page.goto()` in this suite) silently retry an idempotent GET that hits a stale reused connection; Node's `http.Agent` (what Playwright's `request` fixture uses) does not — which is exactly why only the explicit `request.get/put` calls in this suite (never a page navigation) are the ones that can fail a TEST on this, matching the PR #679 signature precisely (`apiRequestContext.get`, not a page-level error).

### 4. Fault injection — what it showed and what it did NOT show

Three deliberate attempts, per CAM-586's inherited escalation instruction ("reproduce deliberately... rather than waiting for a timing coincidence"):

1. **Direct idle-gap timing** (`http.Agent({keepAlive:true})`, gaps 4900–5200ms around the request boundary, 21 trials, otherwise-idle system): **0/21 client-side failures.** The race window is normally sub-millisecond on an idle machine — confirms the mechanism needs a widening factor, not that it's wrong.
2. **Concurrent forced compile** (a probe connection idling ~4.7s while a second connection hits a never-before-visited route to force a real Turbopack compile, 4 trials): **0/4 reproductions.** Next.js 16.2.9's Turbopack dev compiles fast enough (619ms–2.9s for a cold route) that it did not, in these trials, widen the window enough on its own.
3. **Sustained CPU pressure** (6–8 saturating single-thread busy-loops running concurrently on this 10-core machine, emulating a resource-constrained CI runner, across two separate full-suite local runs, `--workers=1`): the suite DID start failing — but with a **different** signature than this ticket's target, both times:
   ```
   Error: locator.click: Error: strict mode violation: getByTestId('btn--availability-add') resolved to 2 elements:
     1) ...aka getByRole('button', { name: 'เพิ่มช่วงวันปิด' })   <- Thai
     2) ...aka getByText('Add blocked dates')                     <- English
   ```
   alongside a browser console line: `[browser] Uncaught Error: Hydration failed because the server rendered text didn't match the client.` This is a genuine, reproducible (2/2) finding — a hydration-mismatch double-render on `/dashboard/campsites/[id]/availability` (almost certainly a language-context SSR/CSR divergence under slow rendering) — but it is a **different bug, in product code** (`app/`), out of this story's file surface. **Reported, not fixed here** (see story.md `## Out of scope`); worth its own ticket if it recurs under more realistic conditions.

### 5. The exact client-visible failure DID reproduce — while verifying the fix itself

While self-verifying the harness change below (running the real regression pair repeatedly under the same sustained CPU pressure as §4.3), `ac6-spot-lifecycle.spec.ts` failed with:

```text
Error: apiRequestContext.get: read ECONNRESET
  - → GET http://localhost:3100/api/campsites/31f5f9cc-16af-4eb9-83b9-05378bc86a51/spots
```

This is the SAME class of failure as the ticket's original quote — a `request.*` call itself receiving a socket-level abort — reproduced directly, not inferred. It also caught a real gap in this story's own first draft: `isTransientKeepAliveRace` originally matched on `err.code === 'ECONNRESET'`, but Playwright relays an `APIRequestContext` failure to the test process as a plain `Error` with the failure folded entirely into `message` — no `.code` property at all — so that first draft would have MISSED this exact, real, freshly-caught failure and let it propagate unretried. Fixed by matching on the message text directly (`message.includes("ECONNRESET")`, alongside the original "socket hang up"/"aborted" substrings, still excluding "ECONNREFUSED"). Re-verified: the corrected predicate now classifies this exact real message as retry-eligible (added as its own case in `cam-603-keepalive-retry.spec.ts`, using the verbatim string).

**Revised conclusion: the exact client-visible failure mechanism IS confirmed** — a `request.*` call on the shared APIRequestContext failing with an ECONNRESET-class socket error, matching the ticket's signature exactly (a Node-side request, not a page navigation). What remains a leading-mechanism-not-formally-proven claim is only the FINER-GRAINED explanation of *why* (the Node keep-alive-timeout race, §3) — the two structural preconditions for it are independently verified true in this codebase (client keeps connections alive with no idle cap; server leaves Node's 5-second default in place), and it reproduces reliably under the same sustained-CPU-pressure conditions that also, separately, exposed a different real defect (§4.3) — but a byte-level trace of the exact race window (server event-loop delay vs. client's send timing) was not captured (§ "What would raise confidence further"). This is enough to ship the harness hardening with confidence: it is verified to correctly retry the EXACT real failure observed, not a hypothetical one.

## The harness hardening shipped — and how a real crash still fails loudly

`e2e/regression/helpers.ts` adds `isTransientKeepAliveRace` (a narrow predicate, deliberately mirroring `lib/observability/abort-guard.ts`'s `isRequestAbortError` shape — read, not imported, to keep the test harness self-contained and not coupled to app internals) and `withKeepAliveRaceRetry` (wraps one `request.*` call, retries exactly once ONLY on that narrow class). Applied to every direct `request.get/put` call site in `e2e/regression/**`: `helpers.ts`'s `findCampBySlug`/`getCampSite` (used by ac1–ac6 + cam-558), and the direct calls in `ac5-create-camp.spec.ts`, `ac6-spot-lifecycle.spec.ts`, `cam-558-touch-targets.spec.ts` (its one `PUT` sends a fixed, deterministic body — idempotent, safe to retry once).

**Why this cannot hide a real crash:** the predicate explicitly excludes `ECONNREFUSED` (connection refused — the signature of a process that is actually down). If the `next dev` webServer genuinely crashed (OOM, an uncaught fatal error bypassing Next's own forgiving handler), **every** subsequent `request.*` call — in every remaining spec, not just the one mid-flight — would get `ECONNREFUSED`, and none of those get retried; the suite fails immediately and loudly, exactly as it would have before this change. Compare: a blanket retry-on-any-network-error would retry `ECONNREFUSED` too, silently absorbing a real crash into a slower, still-green run — this is precisely what BR-4 (story.md) exists to prevent.

**Why a transient retry cannot go silent:** `withKeepAliveRaceRetry` pushes a `cam-603-transient-retry` annotation on the test whenever it actually retries — visible in the HTML report (`playwright-report/`, already uploaded as a CI artifact by the existing `e2e-regression` job). This means a run that only went green because of a retry is still distinguishable from a genuinely clean run — a decision for the owner/DevOps on whether such a run should count toward BR-6's "10 consecutive green" clock is deliberately left open here (noted, not decided).

**Proven in isolation (Prove-It, no network, cannot itself be flaky):** `e2e/regression/cam-603-keepalive-retry.spec.ts` — 9 cases against synthetic errors: the predicate's exact true/false boundary (including the `ECONNREFUSED` exclusion), the wrapper's exactly-one-retry behavior, the annotation firing, a second failure of any kind propagating unchanged, and an unrelated error never being intercepted at all. `vitest.config.ts` excludes `e2e/**`, so this lives as a Playwright test (not under `__tests__/`, which is outside this story's file surface).

## Confidence and what would raise it further

If this recurs, the single highest-value next instrument (not run here — would need either a much heavier CI-realistic CPU/memory constraint than this local 10-core machine could easily emulate, or waiting for a real recurrence) is: capture `process.hrtime()` around every `request.*` call in the harness itself for one CI run where the abort fires, to measure the ACTUAL idle gap and the ACTUAL server-side event-loop delay at that moment, rather than inferring it. The webServer's own stdout is already fully available after the fact via `gh run view --job <id> --log` (verified against PR #679's real run while investigating this) — no new capture mechanism is needed for that half.

## Links
`../../feature.md` · `e2e/regression/README.md` (mechanism summary for future readers) · `e2e/regression/helpers.ts` · `lib/observability/abort-guard.ts` (CAM-406, read-only reference — the server-side sibling of this story's client-side guard) · `.claude/rules/qa.md` (the "flaky = defect report until root-caused" rule this investigation followed) · `story.md`

## Changelog
- v1 (2026-07-28) — created; full investigation record (PR #679 CI log pull, local repro across ~10+ runs, source-verified mechanism, 3 fault-injection attempts and their honest results including the unrelated hydration-mismatch finding), and the harness hardening shipped.
