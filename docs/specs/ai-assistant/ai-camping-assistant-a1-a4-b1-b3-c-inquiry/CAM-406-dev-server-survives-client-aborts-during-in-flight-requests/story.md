---
linear: CAM-406
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: admin
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
---
# Dev server survives a client aborting an in-flight request (CAM-406)

<!-- Gate class: SPEC-LITE (S — URGENT dev-stability, no schema/migration, no new API contract, single file-surface addition (lib/observability/abort-guard.ts + instrumentation.ts), expected diff ≤150 lines). G1 folds into the G3 packet. -->

## Story
As an **Admin** (the owner running the local `next dev` demo server), I want the dev server to survive a client disconnecting mid-request, so that testing the ~3-5s `/api/ai/chat` call (or any other in-flight request) in a browser panel or via curl never kills the whole local dev process.
Why: confirmed 2x in one day — a client disconnect mid-request (browser tab/panel closed, curl timeout) surfaced as an uncaught `Error: aborted` (`code: ECONNRESET`) that terminated the entire `next dev` process, taking down the owner's local demo surface. Vercel is unaffected (per-request isolation); this is `next dev`-only.
Scope: add a narrow, exact-match `uncaughtException` guard (`lib/observability/abort-guard.ts`) wired via the Next.js `instrumentation.ts` file convention. No change to `app/api/ai/chat/route.ts`, the OpenRouter client, or any other route's business logic.
Depends on: — (new, standalone observability guard; no prior ticket).

## AC
<!-- Server-process concern, not a UI feature — "Then (user sees)" is `—` on every row (reason: no screen exists for this; the observable effect is the process staying alive + a structured log line, verified via a real running dev-server repro, not the UI). -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | An in-flight request is running (e.g. the `/api/ai/chat` call) | The client disconnects before the response completes | — (no UI; the owner simply keeps using the dev server) | The `next dev` process does not terminate; exactly one structured `warn` log (`request_aborted_by_client`) is emitted; the abandoned request is otherwise a no-op | EC-1 |
| AC-2 | An uncaught exception unrelated to a client abort is thrown (a real bug) | The exception surfaces at the process level | — | This guard does not rethrow and does not warn-log it; Next.js's own pre-existing forgiving `uncaughtException`/`unhandledRejection` handling (verified finding, see Seams) continues completely unchanged — this story neither newly crashes nor newly swallows a real bug | EC-2 |
| AC-3 | The guard's exact-match predicate (`isRequestAbortError`) is evaluated against any thrown value | The value's `message`/`code` do not EXACTLY equal `'aborted'` / `'ECONNRESET'` (including non-`Error` values) | — | The value is never classified as a client-abort — no partial/substring match | EC-3 |

## Rules
- BR-1 `isRequestAbortError(err)` returns `true` only when `err instanceof Error` AND `err.message === 'aborted'` AND `(err as NodeJS.ErrnoException).code === 'ECONNRESET'` — an exact match on both fields, never a substring/partial check. (proves AC-1, AC-3)
- BR-2 The registered listener (`handleUncaughtException`) never rethrows, for ANY error — matching or non-matching. **Verified finding:** Next.js 16.2.9 already installs its own forgiving `uncaughtException`/`unhandledRejection` listener at server-startup (`next/dist/.../node-environment-extensions/process-error-handlers.js`) that logs but does not `process.exit`. Rethrowing here for the "non-matching" branch throws synchronously inside `process.emit('uncaughtException', …)`, which aborts that emit and prevents Next's own listener from ever running for that event — turning a previously-survived real bug into a hard crash (reproduced directly against a real running `next dev` server; see test.md Prove-It). This guard must therefore compose with Next's own handler, never override or race it. (proves AC-2, regression guard)
- BR-3 `registerAbortGuard()` is idempotent — a module-level flag ensures at most one `process.on('uncaughtException', …)` registration per process, covering Next.js dev hot-reload re-invoking `instrumentation.ts`. (proves EC-3 below)
- BR-4 The guard is wired via the Next.js `instrumentation.ts` file-convention `register()` hook, gated to `process.env.NEXT_RUNTIME === 'nodejs'` (the Edge runtime has no `process.on`).

## Edge cases
- EC-1 IF a client disconnects mid-request THEN the process must not terminate AND exactly one structured warn log is emitted (BR-1, BR-2)
- EC-2 IF an unrelated real-bug error is thrown (not matching the abort shape) THEN the guard must neither rethrow it NOR warn-log it — Next.js's own existing handling proceeds completely unchanged (BR-2)
- EC-3 IF `registerAbortGuard()` is invoked more than once in the same process THEN only one listener is ever attached (BR-3)

## Data
- No schema change, no migration. New files only: `lib/observability/abort-guard.ts` (pure predicate + listener logic, unit-testable) and `instrumentation.ts` (Next.js project-root file convention, calls `registerAbortGuard()` once on server start, Node runtime only).

## Seams & refs
- Reuse: none pre-existing — this is a new, narrow observability guard with no parallel logic elsewhere in the repo (grep-confirmed: zero prior `process.on('uncaughtException'`/`unhandledRejection')` registrations in the codebase before this story). Refs: **verified finding** — Next.js 16.2.9's own `installProcessErrorHandlers` (`next/dist/esm/server/node-environment-extensions/process-error-handlers.js`, invoked from `next-server.js` at server construction and per-request from `route-modules/route-module.js`) already prevents a bare JS `uncaughtException`/`unhandledRejection` from crashing `next dev` for ANY error class, matching or not — this story's guard must never fight that mechanism (BR-2).

## Out of scope
- Root-causing the exact mechanism behind the two real production/local incidents. Realistic process-level repro attempts against a genuinely slow, real in-flight request — client-side `curl --max-time` abort, a forceful `SIGKILL` of curl mid-request, and a raw-socket abortive TCP close (`net.Socket#destroy()`) sent ~150ms into a real 5s-delayed handler — all left the dev server unaffected (it survived cleanly, no uncaught-exception log line appeared at all for these). A direct synthetic reproduction of the EXACT reported error shape (`Error('aborted')` + `code: 'ECONNRESET'`, thrown via `setImmediate` outside the request's own promise chain) DID surface the reported log signature verbatim, but Next.js's own pre-existing forgiving handler already kept the process alive for it — even with zero code from this story present. The precise trigger for the owner's two real crashes could not be reproduced at the JS/process level in this sandbox; it may be a Turbopack-native-level fault bypassing JS exception handlers entirely, or a transient timing/version state not captured here → no follow-up ticket filed yet (recommend: capture the FULL terminal output, not a truncated snippet, on the next recurrence, to confirm whether a Rust/Turbopack panic banner is present before further investment).

## Self-verify
- AC-1..3 → unit (`__tests__/cam-406-abort-guard.test.ts`: exact-match predicate, swallow-and-never-rethrow for both matching and non-matching errors, idempotent registration).
- Story-specific: real running-server verification (not just unit-mocked) that (a) the exact reported error shape no longer produces a differently-behaved outcome than today, and (b) — the regression check that actually mattered — a non-matching real-bug error, which survives TODAY via Next's own handler, still survives with this guard installed (an earlier rethrow-based draft of this guard broke that; caught and fixed before handoff). Full narrative + terminal output in `test.md` Prove-It.
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB — N/A, no DB touched).

## Changelog
- v1 (2026-07-18) — created (spec-lite, URGENT dev-stability, G1 folds into G3, Auto mode).
