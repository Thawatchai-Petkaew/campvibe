---
ticket: CAM-509
epic: CAM-508
title: AssistantTurnLog — capture every assistant turn for weekly improvement (S2/SEE)
class: standard-story
version: 1
---

# CAM-509 — AssistantTurnLog (S2 / SEE pillar)

## Story

As a **platform** maintainer, I want every assistant turn (across all 3 request paths) captured to an `AssistantTurnLog` table — the question, the tools called, the answer, and cheap miss flags — so that the weekly `/ai-chat-improve` skill can read real usage from the IDE (on the Claude subscription, zero paid API) and drive prompt/tool improvements from evidence instead of screenshots.

Scope: a Prisma model + migration, a fire-and-forget write at the two turn-completion seams in `lib/ai/openrouter-client.ts` (which cover guest-nonstream, guest-SSE, and authed), cheap deterministic miss flags, and a 90-day retention helper. **STORE ONLY — no analysis, no paid API call, no LLM at write time.**
Depends on: — (this is the SEE pillar; `/ai-chat-improve` skill + S3 build on it).

Why: the assistant is tuned today from owner screenshots. Telemetry is the keystone that ends that — but the ANALYSIS runs later in the IDE on the flat-rate subscription, so this story only needs to CAPTURE cheaply and safely. Cost architecture (owner decision 2026-07-25): improvement loop = subscription/$0; runtime serving stays on the paid model; only capture is added here.

## AC

| # | Given | When | Then (user sees) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A guest sends a non-streamed chat turn | the turn completes | (nothing — invisible to the user) | one `AssistantTurnLog` row written with path="guest_nonstream", the question, toolCalls, answer, missFlags | EC-1 |
| AC-2 | A guest sends a streamed (SSE) chat turn | the stream completes | (nothing visible) | one row with path="guest_sse" | EC-1 |
| AC-3 | An authed user sends a turn | the turn completes | (nothing visible) | one row with path="authed" and a **hashed** userId (never the raw id) | EC-2 |
| AC-4 | The log write throws (DB down, constraint) | the turn completes | The user still gets their normal answer — the chat is unaffected | no row written; the error is swallowed + logged server-side, never surfaced | EC-3 |
| AC-5 | A search turn returns 0 cards | the turn completes | (nothing visible) | the row's missFlags includes "zero_result" | — |
| AC-6 | The model requests a tool that does not exist | the turn completes | (nothing visible) | the row's missFlags includes "deferred_tool" | — |

## Rules

- BR-1: **Fire-and-forget, never blocking** — the write is wrapped so any failure (throw/timeout) is caught and logged server-side; it MUST NOT change the response or throw into the chat path (AC-4). Prefer Next.js `after()` or an awaited try/catch that swallows — never an unhandled floating promise.
- BR-2: **Capture, don't analyze** — write raw fields (userText, toolCalls JSON, assistantText) + only the CHEAP deterministic missFlags computable at completion; no text classification, no LLM, no network call beyond the single DB insert.
- BR-3: **Miss flags (deterministic set)** — `zero_result` (a search tool ran and returned 0 cards; reuse the existing `searchAttempted && cards.length===0` signal), `deferred_tool` (the model asked for an unknown/unbuilt tool — dispatch returned `unknown_tool`), `no_tool` (no tool dispatched on a turn whose user text is non-trivial). Absent flags = a clean turn. The SEMANTIC misses (honest "no data", wrong tool) are left for the skill's Opus analysis, NOT computed here.
- BR-4: **PDPA** — `userId` is stored ONLY as a stable salted hash (`userIdHash`), never raw; guest turns store `null`. `userText`/`assistantText` are stored in full (owner decision: full capture, 90-day retention) — no other PII is added. Retention: a `deleteTurnLogsOlderThan(days=90)` helper exists and is called by the weekly skill run (and/or a cron); rows older than 90 days are purged.
- BR-5: **Path label** — `path` ∈ {"guest_nonstream","guest_sse","authed"}, derived from which entrypoint completed + whether `ctx.userId` was present.
- BR-6: **Model + timing** — store `model` (the resolved model id) and `latencyMs` (turn wall-clock) for cost/perf trend, and `roundCount` (agent-loop rounds).

## Edge cases

- EC-1: IF the DB insert is slow THEN it must not add meaningful latency to the user response — use `after()` (post-response) so capture never sits on the critical path; if `after()` is unavailable in a path, await with a short timeout + swallow.
- EC-2: IF `ctx.userId` is present THEN store `sha256(userId + SALT)` truncated, never the raw id (BR-4); SALT from env, not committed.
- EC-3: IF the write throws THEN `console.error` a structured line (no secret/PII) and return normally — the user's answer is already sent (EC-1 ordering).
- EC-4: IF `userText` is empty/whitespace THEN still write the row (a no-input turn is signal too) but do not set `no_tool` as a miss.

## Data

New Prisma model `AssistantTurnLog`:
- `id String @id @default(cuid())`
- `createdAt DateTime @default(now())` `@@index`
- `path String` `@@index`
- `userIdHash String?` (BR-4)
- `userText String`
- `toolCalls Json` (array of `{tool, params}`)
- `assistantText String?`
- `missFlags String[]`
- `roundCount Int`
- `latencyMs Int?`
- `model String`

Migration: additive only (new table, no change to existing tables) → reversible (drop table down). Prove up→down→up on the local dev DB.

## Seams & refs

- `lib/ai/openrouter-client.ts` — the two completion seams: `runAssistantTurnFromMessages` (returns `AssistantTurnResult`; covers guest-nonstream via `runAssistantTurn` delegation + authed) and `runAssistantTurnFromMessagesStreaming` (SSE completion). Assemble the turn record where the loop's tool calls + final answer are already in scope; write via a new `lib/ai/turn-log.ts` helper (keeps openrouter-client lean).
- `lib/ai/tool-registry.ts` `ToolContext.userId` — the authed-vs-guest signal + the id to hash.
- The `searchAttempted`/`cards` fields already on `AssistantTurnResult` feed `zero_result` (BR-3).
- New `lib/ai/turn-log.ts` — `logAssistantTurn(record)` (fire-and-forget wrapper, BR-1) + `deleteTurnLogsOlderThan(days)` (BR-4 retention).

## Out of scope

- The `/ai-chat-improve` skill (reads these logs) — a separate follow-up (tooling, no card).
- Any analysis / miner / classification of the logs (that is the skill's job, on the subscription).
- A dashboard/UI over the logs.

## Self-verify

- [ ] `npx prisma migrate dev` applies; migration reversible up→down→up on the local dev DB
- [ ] A turn on each path writes exactly one row with the right `path` (unit/integration test with a mocked prisma)
- [ ] A forced log-write throw does NOT break the chat (AC-4 test — the answer still returns)
- [ ] `zero_result` + `deferred_tool` flags set on the right turns (test)
- [ ] `userIdHash` is a hash, never the raw id; guest = null (test)
- [ ] `npm run lint` · `npm run typecheck` · `npm test` green
