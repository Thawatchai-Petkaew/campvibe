---
linear: CAM-346
feature: self-hosted-delivery-tickets
epic: self-hosted-delivery-tickets (CAM-276)
persona: platform
artifact: story
class: spec-lite
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-04
---
# Kill the recurring SSE test flake (CAM-346)

## Story
As a **Platform** team member, I want `__tests__/status-stream-route.test.ts`'s `[AC1] pushes a data event when the pulse version increases` test to reliably detect a version-bump SSE event under CI CPU load without dropping it, so that PR merges are never blocked (or worse, waved through on a retry) by a false-negative flake that erodes trust in the suite.

Scope: test-only story, no production code change. Fixes the `drain()` read helper in `__tests__/status-stream-route.test.ts` (the SSE-stream read harness shared by all 4 tests in that file). Touches no file under `app/api/`, `lib/`, or `prisma/` — `app/api/status/stream/route.ts` already exposes the env-overridable `STATUS_STREAM_POLL_MS`/`STATUS_STREAM_HEARTBEAT_MS`/`STATUS_STREAM_MAX_MS` seam the tests need; no new seam was required.

Depends on: CAM-287 (SSE cutover to `DeliveryPulse`, shipped — the route this file tests) · the CAM-212/223 lesson already recorded in `.claude/rules/qa.md` (fixed-drain-window flake fix). This story closes a SECOND, deeper race in the same `drain()` helper that the CAM-212/223 fix (early-exit `until` + terminal self-close) did not fully close.

## AC
Internal-tooling story — no end-user-facing UI/Thai copy exists for this work (the fix lives inside a Vitest test helper, not the SSE route's public contract), so the AC below verifies test/mechanism correctness rather than "what a user sees":

| # | Given | When | What is verified | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | the SSE stream is open (route mocked via `readDeliveryPulse`) and the pulse version increases ~30ms after open | `drain()` reads the stream until the data event appears or a terminal condition ends the loop | the test reliably observes `data: {"version":1}`, even when the chunk's arrival lands just after one of `drain()`'s internal per-iteration timeouts has already elapsed (the exact dead zone that dropped the event in the PR #325 CI run) | `drain()` keeps exactly ONE `reader.read()` call in flight at a time — a chunk can only ever be delivered to the read call that is actually still awaiting it, never to an abandoned one from a prior iteration | EC-1 |
| AC-2 | the pulse version never changes during the read window | `drain()` runs for a fixed window with no `until` target | the test observes no `data:` event and the call still returns (does not hang) | the loop exits at the outer deadline with no dangling reads left able to fabricate a false-positive event later | — |
| AC-3 | the route is mocked to never bump the version | `drain()` waits past `STATUS_STREAM_MAX_MS` | the loop terminates via the stream's own self-close (`done: true`), not a silently-expiring fixed window that could mask a real "route never emits" regression | the terminal condition (route self-close at `MAX_MS`) still ends the loop deterministically — the CAM-212/223 "keep teeth" requirement holds | — |

## Rules
- BR-1 `drain()` issues at most one outstanding `reader.read()` call at any time; when a per-iteration timeout elapses with no chunk yet, the SAME pending read is re-awaited on the next loop pass — a new `reader.read()` is never issued while one is already outstanding. (proves AC-1)
- BR-2 The `until` early-exit substring match and the route's own `STATUS_STREAM_MAX_MS` self-close remain the only two real terminal conditions for `drain()` — no fixed-duration "assume it arrived by now" window is reintroduced anywhere in the helper. (proves AC-1, AC-3)

## Edge cases
- EC-1 IF the real chunk is enqueued in the narrow window just after a 40ms per-iteration timeout has already elapsed THEN the loop's current, still-pending `reader.read()` call receives it on its next check (not a new call) — the chunk can never be silently consumed by an orphaned promise the loop has already stopped awaiting (BR-1)

## Data
- No schema/migration change. Test-only diff (one file: `__tests__/status-stream-route.test.ts`).

## Seams & refs
- Reuse: `app/api/status/stream/route.ts`'s existing testability seam (`STATUS_STREAM_POLL_MS` / `STATUS_STREAM_HEARTBEAT_MS` / `STATUS_STREAM_MAX_MS` env overrides, already present before this story) — no route change, no new seam.
- Refs: `.claude/rules/qa.md` "CAM-212/223" rationalization row (fixed-drain-window flake) — this story fixes a second, orphaned-read race the same file's `drain()` helper still carried after that earlier fix; `docs/adr/ADR-010-self-hosted-delivery-tickets.md` / CAM-287 (the `DeliveryPulse` cutover this route/test now exercises).

## Out of scope
- Widening `STATUS_STREAM_MAX_MS` / `STATUS_STREAM_POLL_MS` production defaults → not needed; no production behavior is implicated by this defect.
- Rewriting the SSE route itself (e.g., a push-based test double instead of polling) → no defect was found in `route.ts`; not scoped.
- Any other flaky test in the repo → out of scope for this ticket; file separately if found.

## Self-verify
- AC-1 → integration test `[AC1] pushes a data event when the pulse version increases` (`__tests__/status-stream-route.test.ts`) + a standalone, deterministic mechanism reproduction (a synthetic stream that enqueues a chunk 50ms in, landing in the exact post-timeout dead zone): the OLD `drain()` reliably drops the chunk (5/5 runs), the NEW `drain()` reliably keeps it (5/5 runs).
- AC-2 → integration test `does not push a data event when the version is unchanged`.
- AC-3 → integration test `opens with the reconnect hint + connected comment + SSE content-type`, which relies on the same terminal-condition guarantee.
- Story-specific (Prove-It): the isolated mechanism repro demonstrates the bug RED (old helper drops a deterministically-delayed chunk) then GREEN (new helper keeps it), 5/5 each. The real suite additionally ran the fixed file 10x consecutively green, and 10x consecutively green again under artificial CPU saturation (12 busy-loop processes across all 10 local cores) to stress the exact CI-load condition the flake report described. The OLD (buggy) helper was also run 25x under the same artificial load and did not reproduce the flake locally in that window — consistent with a probabilistic race that needs genuine CI-level multi-process contention to trigger; the mechanism repro is what proves the defect deterministically, independent of local scheduling luck.
- Gate = /quality-gate · Done = merge to `staging` + the fixed suite green in CI (no known-flaky test remaining). No new user-visible AC to verify on the Staging URL — this story's Done is the regression-proof test itself passing reliably, not a new browser flow.

## Changelog
- v1 (2026-07-04) — created
