---
linear: CAM-406
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: admin
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-07-18
---
# Test — dev server survives client aborts during in-flight requests (CAM-406)

## AC→test matrix
| AC | risk (H/M/L) | type (unit/integ/e2e) | test file | status |
|---|---|---|---|---|
| AC-1 | H | unit + real-server repro | `__tests__/cam-406-abort-guard.test.ts` + Prove-It below | ✅ |
| AC-2 | H | unit + real-server repro | `__tests__/cam-406-abort-guard.test.ts` + Prove-It below | ✅ |
| AC-3 | M | unit | `__tests__/cam-406-abort-guard.test.ts` | ✅ |

## Validation cases
- BR-1: `isRequestAbortError` — 5 cases (exact match / wrong message / wrong code / no code / non-Error values: string, plain object, `undefined`).
- BR-2 (the regression that actually mattered): `handleUncaughtException` never rethrows for a matching OR non-matching error; asserted both `expect(() => …).not.toThrow()` AND, for the non-matching case, that `console.warn` is NOT called (this guard stays silent and defers entirely to whatever else is registered — i.e. Next's own handler).
- BR-3: `registerAbortGuard()` idempotency — `process.listenerCount('uncaughtException')` increases by exactly 1 on first call, unchanged on a second call.

## Coverage
Not measured via `--coverage` this pass (new file, single module, no pre-existing branch touched). All new code paths in `lib/observability/abort-guard.ts` are exercised by the 8 new unit tests (`isRequestAbortError` 5 cases, `handleUncaughtException` 2 cases covering both branches, `registerAbortGuard` idempotency). `instrumentation.ts` itself is a 6-line Next.js wiring file (env-runtime gate + one dynamic import + one function call) with no branch logic of its own beyond the runtime gate — exercised indirectly by the real running-server repro below (both `nodejs`-runtime paths hit).

## Prove-It (real running-server repro — process level, per dispatch)

Ran entirely in the worktree on port **3005** (never touched port 3000 / the owner's live server).

**1. Realistic client-abort repro attempts against a genuinely slow real handler (temp debug route, deleted before commit) — all left the server unaffected, no crash, no uncaught-exception log line at all:**
- `curl --max-time 1` against a route sleeping 8s (`GET`) → curl exits `28` (timeout), server unaffected, next request served fine.
- `curl -X POST … & sleep 1; kill -9 <curl-pid>` against a route sleeping 5s (`POST`, reads body first) — 5 iterations — server unaffected each time.
- A raw `net.Socket` (`node:net`) sending a valid `POST` request line + body then `socket.destroy()` ~150ms later (abortive close, closer to a browser-tab-close than curl's own graceful teardown) — 6 iterations — server unaffected each time.
- Waited up to 12s after each abort (past the handler's own internal delay) in every case — process stayed alive throughout, `ps` showed the same PIDs, and the server kept serving new requests.
- Honest conclusion: none of these realistic client-side abort mechanics reproduced an uncaught-exception crash in this Next 16.2.9 (Turbopack) + Node 22.23.0 sandbox.

**2. Direct synthetic reproduction of the EXACT reported error shape** (temp debug route, deleted before commit): `setImmediate(() => { const e = new Error('aborted'); e.code = 'ECONNRESET'; throw e; })` — throws asynchronously, outside the route handler's own promise chain, mirroring how the real defect's error surfaces AFTER the response is already logged.
- **Before this story's code (instrumentation.ts absent):** hitting the route produced the log signature verbatim — `GET … 200 in 963ms` → `Error: aborted … code: ECONNRESET` → `⨯ uncaughtException: Error: aborted` (matches the ticket's reported signature exactly) — **but the process itself survived** (`ps` still showed 2 live procs; a follow-up request returned `200`).
- **Root cause of that survival — verified finding:** Next.js 16.2.9 already installs its own forgiving `uncaughtException`/`unhandledRejection` listener (`node_modules/next/dist/esm/server/node-environment-extensions/process-error-handlers.js`, wired from `next-server.js` at server construction and per-request from `route-modules/route-module.js`) that logs (`console.error(reason)`) and deliberately does **not** call `process.exit` — "we definitely shouldn't crash the entire process" (its own source comment). This mechanism already covers ANY uncaught exception, not just aborts.

**3. The real regression this story caught (before it ever reached a PR):** an early draft of the guard rethrew for the "not our narrow class" branch (matching the dispatch's literal suggestion). Tested against the real running server with two request kinds:
- `?kind=abort` (matches our predicate) → swallowed, structured warn logged, server survived.
- `?kind=other` (`throw new Error('a genuinely different bug, unrelated to abort')`, NOT matching) → **the entire `next dev` process crashed and exited** (`ps` showed 0 procs afterward), where it had SURVIVED the identical error with NO guard installed at all one run earlier.
- Cause: throwing synchronously inside a `process.on('uncaughtException', …)` listener aborts `process.emit('uncaughtException', …)` immediately — Next's own later-registered forgiving listener never runs for that event. Confirmed with an isolated two-listener Node sanity script (`iter1 throws → iter2 never called`) before touching the real server.
- **Fix:** the shipped `handleUncaughtException` never rethrows for either branch (see `lib/observability/abort-guard.ts` file header). Re-ran the same two-request-kind test against the fixed guard: `?kind=abort` → swallowed + warn-logged, survives; `?kind=other` → survives unchanged (Next's own handler still runs, exactly as it does with no guard at all) — confirmed via a follow-up request returning `200` after both.

**Honest summary:** this story could not reproduce the owner's exact real-world crash mechanism at the JS/process level after multiple realistic and one exact-shape synthetic attempt, because Next.js's own built-in exception handling already prevents a bare JS `uncaughtException`/`unhandledRejection` from killing `next dev`, for both the abort shape and unrelated real bugs. The shipped guard is therefore a safe, narrow, non-regressing defense-in-depth addition (adds a low-noise structured signal distinguishing the known client-abort class; provably does not weaken Next's own existing crash-prevention for real bugs) rather than a demonstrated fix for the two specific reported crashes — flagged to the orchestrator as `needs_decision` in the handoff (recommend capturing full terminal output, not a truncated snippet, on the next recurrence to check for a Turbopack-native panic banner, which no JS-level guard can address).

## QA verdict (independent re-verify)

- Diff surface: clean (`git diff origin/dev...HEAD --stat`) — only `instrumentation.ts`, `lib/observability/abort-guard.ts`, this test file, and the two spec docs; no other file touched.
- Predicate (BR-1): confirmed exact-match only — `err instanceof Error && err.message === 'aborted' && code === 'ECONNRESET'`; 5/5 cases pass (wrong message, wrong code, missing code, non-Error string/object/undefined all rejected — no substring/partial match).
- Never-rethrow (BR-2, the regression that mattered): re-proved red→green independently — temporarily reinstated `throw err` in the non-matching branch, reran the suite: the "does NOT rethrow… for a non-matching (real bug) error" test failed exactly as the story's narrative claims (`AssertionError: expected [Function] to not throw`); reverted the one-line change, reran: 8/8 green again. The regression guard has real teeth, not just a source-inspection assertion.
- Idempotent registration (BR-3/EC-3): confirmed — `registerAbortGuard()` called twice adds exactly one listener.
- `instrumentation.ts` nodejs-runtime guard (BR-4): confirmed — `if (process.env.NEXT_RUNTIME !== 'nodejs') return;` present before any `process.on` touch; no edge-runtime break.
- `npx vitest run __tests__/cam-406-abort-guard.test.ts` → 8/8 pass. `npm run typecheck` → clean, 0 errors.
- Coverage: not measured via `--coverage` this pass (consistent with the QA-authored note above — single new module, all paths exercised by the 8 tests). No defect found; no sub-ticket opened.

## Links
`story.md` (AC/BR/Out-of-scope) · `.claude/rules/api.md` · `.claude/rules/observability.md`

## Changelog
- v1 (2026-07-18) — created alongside story.md; Prove-It documents both the honest non-repro of the real incident and the real regression this story caught and fixed pre-handoff.
- v1.1 (2026-07-18) — QA independent re-verify appended (diff-surface check + red→green re-proof of the never-rethrow regression guard); no defects.
