# CAM-416 — Agent loop cap 4 + forced final prose + tool cap 6 + 45s deadline (S3b)

> Epic: AI Chat Foundation (ADR-013) · Feature: AI assistant chat
> Full design: `docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md` §D4 (ratified 2026-07-19; owner G2 tap #1 accepted)
> Type: internal engine restructure (wire contract byte-stable — same as CAM-415). Spec-lite class:
> no schema/migration, no new/changed API contract — `POST /api/ai/chat` request/response shape unchanged.
> G1: folded — ADR-013 D4 is the ratified spec (owner-approved 2026-07-19); no separate G1 tap for this story.
> Depends on: CAM-415 (`lib/ai/openrouter-client.ts`'s shared `runTurnFromBaseMessages` engine + the
> `[system, ...turns]` messages-array seam this story extends).

## Story

As the **platform** (server-authoritative agent turn, no direct end-user-facing screen), I want the
single-round tool-call engine replaced with a real, bounded multi-round agent loop, so that a question
needing more than one tool call (e.g. search then check availability on the top result) can be answered
in one turn instead of being cut off after exactly one round — while spend and latency stay hard-capped
(ADR-013 D4, owner G2 tap #1).

Scope: `lib/ai/openrouter-client.ts`'s `runTurnFromBaseMessages` (the CAM-415 shared engine) becomes a
bounded loop (≤4 completions, forced-final prose on the last, ≤6 tool calls per turn, 40s wall-clock
deadline — v2, tightened from the ADR's illustrative 45s so the deadline plus one final model-call
timeout can never reach the route's own execution ceiling, see Changelog — pinned model fallback);
`app/api/ai/chat/route.ts` gains `export const maxDuration = 60`.
Persistence, tiered tools, and the `blocks[]` contract are **out of scope** — S2/S4/S6.
Depends on: CAM-415 (the messages-array engine this story extends).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The model's first completion carries no `tool_calls` | The turn runs | — (no screen; answer text/cards unchanged) | The loop stops at iteration 1 — identical behavior to the pre-CAM-416 single-round engine | EC-1 |
| AC-2 | The model requests tool_calls across 2 or 3 rounds, then answers with no further tool_calls | The turn runs | — | Each round executes its tool_calls (bounded by BR-2/BR-3) and re-enters the loop; the loop stops the instant a completion carries no `tool_calls`, never running past `MAX_AGENT_ITERATIONS` | EC-2 |
| AC-3 | The model keeps requesting tool_calls through iteration `MAX_AGENT_ITERATIONS` (4) | The 4th completion runs | — | That call is made with `tool_choice:'none'` (BR-1) — the model is forced to answer in prose; any tool_calls it still returns are ignored, never dispatched, never a 5th completion call | EC-3 |
| AC-4 | A round's tool_calls would push the turn's total executed count past `MAX_TOOL_CALLS_PER_TURN` (6) | The round executes | — | Only the calls that fit the remaining turn budget (bounded also by the unchanged per-round `MAX_TOOL_CALLS_PER_ROUND`, 3) are dispatched; the rest get a handled `too_many_tool_calls` tool message, never invoking the tool (BR-2) | EC-4 |
| AC-5 | The turn's wall-clock elapsed time reaches `TURN_DEADLINE_MS` (40s, v2) before a completion after the first | The loop checks the deadline (before making that call) | — | No further network call is made; if the most recent completion carried non-empty `content`, that becomes the final answer; otherwise the turn ends in the handled `assistant_unavailable` error (BR-4) | EC-5 |
| AC-6 | The turn's first completion needed the fallback model (primary failed) | A later iteration in the same turn runs | — | That iteration calls the fallback model DIRECTLY — no repeat attempt at the primary model (BR-5) | EC-6 |
| AC-7 | A camper posts the existing `{messages: [...]}` request shape | The route responds | Identical `{answer, cards, suggestions?}` body as before this story | No change to request/response shape, status codes, or rate-limit/validation ordering; `POST /api/ai/chat` gains `maxDuration = 60` (route config only, not a contract change) | AC-1..AC-6 of CAM-415 (unchanged, still green) |

## Rules

- BR-1: `MAX_AGENT_ITERATIONS = 4` — at most 4 completion calls per turn. The loop stops the instant a completion's `tool_calls` is empty/absent. The iteration numbered `MAX_AGENT_ITERATIONS` is ALWAYS called with `tool_choice:'none'` (a real completion call forcing prose, never a client-side guess at an answer) so the turn always terminates with a user-facing answer.
- BR-2: `MAX_TOOL_CALLS_PER_TURN = 6` bounds the SUM of tool calls actually dispatched across every round in the turn, on top of the unchanged `MAX_TOOL_CALLS_PER_ROUND = 3` (CAM-270) which still bounds a single round. Per round, `executeLimit = max(0, min(MAX_TOOL_CALLS_PER_ROUND, MAX_TOOL_CALLS_PER_TURN - alreadyExecutedThisTurn))`; anything beyond `executeLimit` gets the existing handled `{ok:false, code:'too_many_tool_calls'}` tool message (CAM-270 BR-6 mechanism, reused, never a new code).
- BR-3: tool-result / `assistant(tool_calls)` messages append onto the turn's own in-memory `messages[]` array only (per round: one assistant message carrying `tool_calls` + one `tool` message per call). Never persisted, never carried into another turn — ADR-013 D2 persistence is a separate, later story (S6/S7) and only ever persists the final sanitized answer, never a mid-loop tool trace.
- BR-4: `TURN_DEADLINE_MS = 40_000` (v2 — see Changelog) is a wall-clock budget checked with `Date.now()` before every completion call AFTER the first (the per-call `MODEL_CALL_TIMEOUT_MS = 15_000` timeout, CAM-270, is unchanged and independent). A breach makes NO further network call: the most recently-received completion's own `content` (if its trimmed length is > 0) becomes the final answer (through the same `extractSuggestions` path as any normal stop); if that content is empty, the turn ends in the existing handled `GENERIC_ERROR` (`assistant_unavailable`) — never a raw timeout/internal error.
- BR-5: model fallback (CAM-270 AC-6/BR-6: try `OPENROUTER_MODEL`, then `OPENROUTER_MODEL_FALLBACK` once) runs ONLY on the turn's FIRST completion. Whichever model actually answered (primary or fallback) is PINNED for the rest of the turn — every later iteration calls that exact model directly via a single call, no repeat fallback dance. A pinned-model call that itself fails ends the turn in the handled `GENERIC_ERROR`, same as CAM-270/415's existing follow-up-failure behavior (no re-loop, no 3rd attempt).
- BR-6: suggestions (CAM-410) are extracted from the FINAL completion of the loop only — never from an intermediate tool-requesting round's `content` (which is typically empty anyway when `tool_calls` is present).
- BR-7: `app/api/ai/chat/route.ts` exports `maxDuration = 60` (Next.js route-segment config) — headroom above the turn deadline so the platform's own execution ceiling is never the limiting factor. Route config only; no request/response contract change.
- BR-8 (v2, Security Info fix): the invariant `TURN_DEADLINE_MS + MODEL_CALL_TIMEOUT_MS < maxDuration * 1000` must hold (40_000 + 15_000 = 55_000 < 60_000, a 5s margin) — a deadline check that JUST passes must never let its one remaining model call push the route past its own `maxDuration`, which would surface a raw platform 504 instead of this file's own graceful 502 `assistant_unavailable`. Enforced by a numeric test in `__tests__/cam-416-agent-loop.test.ts` so it cannot silently regress.

## Edge cases

- EC-1: IF the model never requests a tool THEN exactly ONE completion call happens, identical to the pre-CAM-416 behavior (no regression on the common case).
- EC-2: IF a round's completion itself requests further tool_calls (round 2, 3, or any round before the iteration cap) THEN those tool_calls DO execute and DO trigger another completion call — this explicitly supersedes CAM-270/415's prior "no agent loop, follow-up's own tool_calls are ignored" guarantee, which was scoped to exactly one round by design and is now superseded by this story.
- EC-3: IF the model requests tool_calls specifically on the iteration-4 (forced-final) response THEN those tool_calls are ignored outright (never dispatched, never counted against `MAX_TOOL_CALLS_PER_TURN`) and the response's `content` is used as the final answer.
- EC-4: IF a round's requested tool_calls only partially fit the remaining turn budget (e.g. 2 remaining slots but 3 requested) THEN exactly the first `executeLimit` are dispatched in order and the rest are rejected as `too_many_tool_calls` — every `tool_call_id` still gets a matching tool message so the next completion call stays well-formed (same invariant as the existing per-round cap).
- EC-5: IF the deadline breaches with zero prior content (the typical case — a tool-requesting completion usually returns `content: null`) THEN the turn ends in the handled `assistant_unavailable` error, never a raw timeout exception surfaced to the client.
- EC-6: IF the pinned model (post-fallback) itself fails on a later iteration THEN the turn ends in the handled `GENERIC_ERROR` immediately — no re-attempt at the original primary model, no infinite retry.

## Data

No schema/migration. `lib/ai/openrouter-client.ts` gains exported constants `MAX_AGENT_ITERATIONS` (4),
`MAX_TOOL_CALLS_PER_TURN` (6), `TURN_DEADLINE_MS` (40000, v2), `MODEL_CALL_TIMEOUT_MS` (15000, now
exported so the deadline invariant test can read it); `MAX_TOOL_CALLS_PER_ROUND` (3, CAM-270)
unchanged. `executeToolCalls` gains an `executeLimit` parameter (replacing the hardcoded per-round
constant) and returns an added `executedCount`. `callModelOnce`/`callOpenRouter` gain an optional
`CallOptions.toolChoice` used only for the forced-final call. `callModelWithFallback` now returns
`{ outcome, model }` so the loop can pin the answering model. `app/api/ai/chat/route.ts` gains
`export const maxDuration = 60`.

## Seams & refs

- Reuse: the CAM-415 `[system, ...turnMessages]` seam (`runAssistantTurnFromMessages`,
  `runAssistantTurn`) — both entry points delegate to the SAME `runTurnFromBaseMessages`, now the
  bounded loop; neither entry point's own signature changed. Suggestion extraction
  (`extractSuggestions`, CAM-410) and per-round tool dispatch (`executeToolCalls`,
  `dispatchTool`/tool-registry, CAM-270) are reused unchanged apart from the `executeLimit` threading.
- Refs: ADR-013 (AI Chat Foundation) §D4 · CAM-270 (the per-round tool-call cap + fallback mechanism
  this story extends to a turn-level cap + pinning) · CAM-415 (the messages-array engine).
- Not touched: `lib/ai/tool-registry.ts` (tier/registry refactor is CAM-417/S4, explicitly out of
  scope here) · `lib/ai/conversation-store.ts` / Prisma (persistence is CAM-414/S2, already shipped,
  not touched by this story) · `lib/ai/build-turn-messages.ts` (per-message fencing, CAM-415, untouched).

## Out of scope

- Tiered tool registry (`guest`/`authed`/`write`) + server-bound `ToolContext.userId` → CAM-417 (S4).
- Persisting the turn / conversation history → CAM-414 (S2, already shipped) — this story's loop
  messages remain in-memory-only for the turn, never written to `ChatMessage`.
- Streaming the final answer (CAM-412 seam) → CAM-420 (S6).
- Any change to `POST /api/ai/chat`'s request/response contract → none; byte-identical by design.

## Self-verify

- AC-1..7 → unit (`__tests__/cam-416-agent-loop.test.ts` — multi-round chain, no-tool immediate answer,
  4-round forced final, per-turn cap, deadline via injected clock (`Date.now()` spy), fallback pin,
  the BR-8 numeric deadline/maxDuration invariant) + updated sibling assertion in
  `__tests__/cam-270-openrouter-client.test.ts` (the superseded "no agent loop" pin, EC-2).
- Story-specific: sibling AI suites (CAM-270/271/272/405/408/410/411/415) re-run green, zero weakened
  assertions — only the one pin whose INTENT this story explicitly supersedes (EC-2) was updated.
- Gate = `/quality-gate` · Done = merged into `dev`, AC verified on localhost (dev DB) before merge.

## Changelog

- v1 (2026-07-19) — created.
- v2 (2026-07-19) — Security review (Info, post-merge): the iteration>1 deadline check could pass at
  ~44.9s and let its one remaining model call run up to `MODEL_CALL_TIMEOUT_MS` (15s), reaching
  ~60s — right at (not under) the route's `maxDuration`, risking a raw platform 504 instead of the
  graceful 502 `assistant_unavailable`. Fixed by tightening `TURN_DEADLINE_MS` 45s→40s (leaves a 5s
  margin: 40+15=55 < 60); the loop's DECISION (a turn-level wall-clock cap independent of the per-call
  timeout, BR-4) is unchanged, only the exact budget. Added BR-8 (the numeric invariant) + a permanent
  test asserting `TURN_DEADLINE_MS + MODEL_CALL_TIMEOUT_MS < maxDuration*1000` so it cannot silently
  regress; exported `MODEL_CALL_TIMEOUT_MS` (was module-private) so the test can read it.
