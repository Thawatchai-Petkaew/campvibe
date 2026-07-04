---
linear: CAM-346
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
persona: platform
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-04
---
# Test — Kill the recurring SSE test flake (CAM-346)

## AC→test matrix

| AC | test-id | layer | file | pass/fail |
|---|---|---|---|---|
| AC-1 data event reliably observed under timer jitter; chunk never dropped to an orphaned read | `[AC1] pushes a data event when the pulse version increases` | integration | `__tests__/status-stream-route.test.ts` | PASS |
| AC-2 no data event when version unchanged; loop still terminates (no hang) | `does not push a data event when the version is unchanged` | integration | `__tests__/status-stream-route.test.ts` | PASS |
| AC-3 terminal self-close still ends the loop deterministically (teeth intact) | `opens with the reconnect hint + connected comment + SSE content-type` | integration | `__tests__/status-stream-route.test.ts` | PASS |

(The file's 4th test, `[AC5] 401 on a wrong token when STATUS_TOKEN is set`, is unaffected by this change — it never calls `drain()`. Kept green as a regression check that the fix didn't touch auth.)

## Root cause

`drain()` raced `reader.read()` against a fresh 40ms `setTimeout` **every loop iteration**. When the 40ms timeout won (no chunk had arrived yet — the normal case while waiting on the next poll tick), the `Promise.race` moved on to a new iteration and issued a **brand-new** `reader.read()` call — but the *previous* iteration's `reader.read()` call was never cancelled; it stayed pending in the background.

A `ReadableStreamDefaultReader` resolves its pending `read()` requests **in FIFO order**. So once two or more reads were outstanding (iteration 1's abandoned read + iteration 2's active one), the *next* chunk to arrive resolved the **oldest** pending read — the abandoned one from a *prior*, already-timed-out iteration — not the one the loop was currently awaiting. That resolution was never inspected (nothing was still awaiting that specific promise's value), so the chunk vanished with no error. The loop kept waiting on its *current* read, which would now only ever see a *later* chunk (or the stream's terminal close) — never the one that just got silently consumed.

This exactly reproduces the CI failure in PR #325: only `retry: 3000\n\n: connected\n\n` was observed (both sent synchronously at stream-open, so they always land inside the very first, unraced `read()` call) — the version-bump `data:` event, which naturally lands somewhat later relative to `drain()`'s 40ms polling cadence, is the one exposed to the drop. Under normal (fast, uncontended) local execution the actual chunk usually happens to arrive *within* the current iteration's own read call by luck of the timing, so the bug rarely surfaces; heavier CI CPU contention shifts the relative timing and makes the chunk far more likely to land in the "already timed out, not yet reissued" dead zone.

### Fix

`drain()` now keeps **exactly one** `reader.read()` promise in flight at a time (`pending`). On timeout, the loop re-awaits the *same* pending promise instead of discarding it and starting a new one; only once it actually settles does the loop null it out and (if the loop continues) start a fresh read. A chunk can now only ever be delivered to the read call that is genuinely still waiting for it — the orphaned-promise window is structurally eliminated, not just made less likely.

No change to the route (`app/api/status/stream/route.ts`) — it already exposed the `STATUS_STREAM_POLL_MS`/`STATUS_STREAM_HEARTBEAT_MS`/`STATUS_STREAM_MAX_MS` env seam; no production behavior changed.

## Validation cases per AC

AC-1 (`[AC1] pushes a data event...`):
- normal: version bumps from 0 -> 1 at ~30ms after stream open; the fixed `drain()` observes `data: {"version":1}` and returns immediately on the `until` match (early-exit, not a fixed window).
- concurrent/ordering (the actual regression class): the version-bump chunk's real arrival is not synchronized with `drain()`'s 40ms polling cadence — this is exactly the "concurrent/ordering" bucket in the QA coverage matrix. Proven via an isolated, deterministic mechanism reproduction (not committed to the suite — see Prove-It below) rather than by chasing real timing jitter in-process, since the real defect is a structural FIFO-delivery race, not a probability that gets better with more retries.
- terminal/boundary: if the route never bumps the version, the stream still self-closes at `STATUS_STREAM_MAX_MS` and `drain()`'s `step.done` path exits the loop — asserted by AC-3's test relying on the same mechanism.

AC-2 (`does not push a data event...`):
- normal/negative: version stays constant (`rp.mockResolvedValue(5)`); `drain()` runs the full window and returns without ever seeing a `data:` event.
- boundary: the loop must still terminate (not hang) purely on the outer `deadline`, since no `until` target is ever supplied for this test.

AC-3 (`opens with the reconnect hint...`):
- normal: `retry: 3000` and `: connected` are both observed — these are enqueued synchronously at stream start, so they are unaffected by the orphaned-read race (they always arrive within the very first, unraced read).

## Prove-It (red-before-green evidence)

The defect is a genuine, identified race (not "no known defect" — a real orphaned-promise bug), so Prove-It was demonstrated as a real repro rather than mutation testing:

1. **Isolated, deterministic mechanism reproduction** (scratch script, not committed — a synthetic `ReadableStream` stands in for the route so the timing is fully controlled instead of racing real system scheduling): enqueue `"OPEN"` at t=0 and `"DATA"` at t=50ms (deliberately landing just after the first 40ms per-iteration timeout at t=40ms, matching the exact dead zone the CI flake landed in). Running the OLD `drain()` against this stream **reliably drops `"DATA"`** (RED — reproduces the bug on demand, 5/5 runs); running the NEW `drain()` against the same stream **reliably keeps `"DATA"`** (GREEN, 5/5 runs). This proves the mechanism structurally, independent of any real machine's scheduling luck — the fix is not "less likely to flake," it makes the drop impossible by construction (only one `reader.read()` is ever outstanding).
2. **The real test file**, with the fix applied, was run:
   - 10x consecutively, standalone: 10/10 green.
   - 10x consecutively under artificial CPU saturation (12 `yes > /dev/null` busy-loop processes across all 10 local CPU cores, simulating CI-level contention): 10/10 green.
   - As a bonus check, the file was temporarily reverted to the OLD (buggy) `drain()` and run 25x under the same artificial load: it did not reproduce the flake in that local window (0/25 failed) — consistent with a probabilistic race whose trigger condition (the real chunk landing in the exact post-timeout dead zone, which depends on fine-grained relative timer scheduling) is more reliably hit under genuine CI multi-worker contention than under "other cores busy on the same machine." This is why step 1 (the deterministic, timing-controlled mechanism repro) is the load-bearing evidence for this fix, not a bare retry-until-red attempt against the real file.

## Coverage

Test-only change — the diff is entirely inside a Vitest test helper function (`drain()`), not production code, so there is no "new code" coverage floor to hold to 80% for this story (same precedent as CAM-303). Reported for honesty:

| File | Note |
|---|---|
| `app/api/status/stream/route.ts` | Unchanged; already covered by this same test file's 4 cases (no coverage regression). |
| `__tests__/status-stream-route.test.ts` | The changed file IS the test; "coverage of a test helper" is not a meaningful metric — its correctness is proven by the Prove-It evidence above instead. |

## Run results

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  ~330-880ms (single run, varies by machine load)
```

10x consecutive (fixed file, standalone): `PASS=10 FAIL=0`
10x consecutive (fixed file, under 12-process CPU saturation across 10 cores): `PASS=10 FAIL=0`
25x consecutive (OLD buggy file, under the same CPU saturation): `PASS=25 FAIL=0` (did not reproduce locally in this window — see Prove-It note above on why the isolated mechanism repro is the load-bearing evidence)

Full repo suite (`npm test`): 116/116 test files passed, 5255/5255 tests passed (run twice for stability — identical both times). The dispatch's noted "known pre-existing env-dependent failure" in `__tests__/delivery-client.test.ts` did **not** reproduce in this environment — reporting the real, observed number rather than the expected caveat (metric honesty).

## Quality gate summary

- `npm run lint`: 0 errors, 234 pre-existing warnings (none in the changed file; no new warnings introduced).
- `npm run typecheck`: 0 errors.
- `npm test`: 5255/5255 passed (116/116 files) — run twice, identical.
- No production file touched (`app/`, `lib/`, `prisma/` all untouched — test-only diff, one file changed: `__tests__/status-stream-route.test.ts`).
- `npm run build` skipped per this ticket's dispatch (test-only change, no build-affecting surface).

## Staging-verify (non-automated)

Not applicable in the usual sense — this story ships no new user-visible behavior and no production code changed. Done for this story = the fixed regression suite merged into `staging` and green in CI (no flake), per its `story.md` Self-verify Gate line.

## Links

`story.md` (AC/BR) · `.claude/rules/qa.md` (CAM-212/223 lesson this story extends) · `app/api/status/stream/route.ts` (unchanged; the route under test) · PR #325 (the CI run that surfaced the original flake)

## Changelog
- v1 (2026-07-04) — created
