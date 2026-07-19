# ADR-015: Streaming transport for the assistant's final answer (CAM-412)

Status: Accepted — owner-ratified deltas (AUTO mode) at G1 per story.md Changelog v1 (2026-07-19).

## Context

`POST /api/ai/chat` (CAM-271/415/416/417/420) resolves a turn through a bounded
agent loop (`lib/ai/openrouter-client.ts` `runTurnFromBaseMessages`, up to
`MAX_AGENT_ITERATIONS` = 4 completions) and returns one JSON body
`{ answer, cards, suggestions?, searchAttempted? }` only once the WHOLE turn
finishes. On the guest Discover funnel a turn takes ~3-5s end to end, all of
it spent staring at a typing indicator before any text appears.

CAM-412 asks for the final answer text to appear progressively (word-by-word
feel) while keeping: no new model call, no second paid round, MAX_TOKENS
(680) unchanged, the tool round invisible to the client, cards+chips arriving
together in one terminal event, and the existing JSON body as the automatic,
byte-stable fallback. The story's own Seams & refs flagged one restructuring
question as an explicit "architect/G2 decision" rather than guessing it:
*how does the tool-deciding call detect `tool_calls` while still enabling a
streamed final answer*, given the loop cannot know ahead of a call whether
its completion will carry `tool_calls` or prose.

## Decision

1. **Uniform streaming transport, client-visible forwarding decided per call.**
   Every completion call in the loop (`streamOneCompletion`,
   `lib/ai/openrouter-client.ts`) is requested from OpenRouter with
   `stream:true`. The first meaningful SSE delta chunk of a given call reveals
   its "mode": `tool_calls` appearing first means this is a tool-deciding
   round — the rest of that stream is drained SILENTLY (never yielded past
   the module) and reconstructed into the exact `{content, tool_calls}` shape
   the non-streaming path already builds from one JSON body, so the REST of
   the loop (`executeToolCalls`, iteration/tool-call/deadline accounting) is
   byte-identical to `runTurnFromBaseMessages`. `content` appearing first
   means this call IS the turn's terminal answer — cleaned text chunks are
   forwarded live. This is transport-only: loop semantics, `MAX_TOKENS`,
   `MAX_TOOL_CALLS_PER_ROUND/TURN`, `MAX_AGENT_ITERATIONS`, and
   `TURN_DEADLINE_MS` are unchanged bit-for-bit — reused, not reimplemented.

2. **SSE-style `ReadableStream` over `Accept`-header content negotiation, no
   new dependency.** A request to `POST /api/ai/chat` carrying
   `Accept: text/event-stream` (legacy `{messages}` shape only — see scope
   note below) may receive a `text/event-stream 200` framed as `delta` →
   `meta` → `done` (or a terminal `error`); every other request keeps the
   existing JSON body untouched. Framing/parsing is a small hand-rolled
   reader on both ends (`readSseDataLines` server-side,
   `consumeAiChatStream` client-side in `lib/api-client.ts`) — no
   EventSource/SSE parser library added (out of scope per story.md).

3. **Stream headers commit only on a real success.** The route
   (`handleLegacyTurnStreaming`, `app/api/ai/chat/route.ts`) pulls the
   generator (`runAssistantTurnFromMessagesStreaming`) ONCE before deciding
   the HTTP response: if the first yielded event is `delta`/`meta` (success),
   it commits to `text/event-stream 200`; if it is `skipped`/`error` (nothing
   was ever shown), it returns the SAME JSON status/code the non-streaming
   path would (`503 assistant_disabled` / `502 assistant_error`). Guard order
   (rate-limit → zod → key-check) is unchanged and runs entirely BEFORE the
   generator is ever created. This is what makes "any failure before the
   first delta returns JSON" true without a double paid call: the decision
   is just "which event did the generator yield first," not a separate
   probe request.

4. **Suggestions are buffered server-side, never streamed.** A tag-safe
   incremental flusher (`TagSafeFlusher`) withholds any trailing text that
   could be an in-progress `<suggestions>` open tag (including one split
   across two network chunks), pinning the safe boundary permanently once a
   real tag is confirmed. `extractSuggestions` (CAM-410, unchanged) still
   does the actual parse/strip, against the FULL buffered completion — no
   parallel parser.

5. **Upstream abort propagation, one AbortController per turn.** The route
   creates its own `AbortController`, wired to both `request.signal` and the
   `ReadableStream`'s own `cancel()` callback (covers every disconnect path
   regardless of which one a given runtime surfaces first), and threads its
   `signal` through every upstream OpenRouter fetch
   (`runAssistantTurnFromMessagesStreaming(..., signal)`). A close/cancel
   tears the paid generation down; `AbortController.abort()` is itself
   idempotent, so a duplicate abort is a safe no-op (BR-6/AC-7/EC-6).

6. **Model fallback only pre-first-delta.** BR-6's existing "fall back once
   to `OPENROUTER_MODEL_FALLBACK`" guard applies only to the turn's FIRST
   completion, and only while that call has forwarded ZERO content chunks to
   the client. Once any text has been shown, swapping models mid-answer
   would produce garbled output, so any further failure on that call is a
   genuine mid-stream error (AC-4/EC-1), never a fallback retry.

7. **Scope: legacy (guest, stateless) path only.** `POST /api/ai/chat`'s v2
   branch (CAM-420, session-bound + persisted, `handleV2Turn`) does not
   honor `Accept: text/event-stream` in this story — it always returns the
   existing JSON body. Rationale: the story's own framing is the "guest
   Discover funnel" and its `Depends on:` list cites CAM-271 (the original,
   stateless contract), not CAM-420; the v2 path additionally has to
   persist the turn only AFTER success (D2), which is a second, separable
   restructuring question. This is additive/backward-compatible by
   construction (BR-1) — a follow-up story can extend streaming to the v2
   path without touching this contract. `components/ai-chat/use-ai-chat.ts`
   only requests streaming on the guest (`aiChatAPI.send`) branch;
   `aiChatAPI.sendTurn` (authed) is untouched.

## Alternatives considered

- **Probe-then-stream (two calls):** make a cheap non-streaming call first to
  decide tool-vs-content, then a second streaming call for the real answer.
  Rejected — doubles spend/latency and violates BR-5's "no second paid
  round."
- **Client-side SSE library (`eventsource-parser` or similar):** rejected —
  story.md explicitly forbids a new dependency; the wire framing is simple
  enough (`event: <name>\ndata: <json>\n\n`) for a ~20-line hand parser on
  each end.
- **Stream the v2 (persisted) path too, in this same story:** rejected for
  size/risk — persistence-after-streaming-success is a genuinely separate
  restructuring (the D2 "persist only after success" invariant would need to
  move from "after the JSON result" to "after the SSE stream settles");
  splitting it keeps this PR to the core contract only.
- **Buffer the whole answer server-side, then replay it "fast" to simulate
  streaming:** rejected — defeats the entire purpose (time-to-first-visible-
  text would still equal the full completion latency).

## Consequences

- `lib/ai/openrouter-client.ts` gains a second, streaming-capable engine
  (`runAssistantTurnFromMessagesStreaming` + its private helpers) alongside
  the unchanged `runTurnFromBaseMessages` — some structural duplication
  between the two loops is the accepted cost of a byte-stable non-streaming
  path (`runAssistantTurn`/`runAssistantTurnFromMessages` are untouched,
  zero behavior change, confirmed by the full existing CAM-270/415/416/417
  test suites staying green).
- The client (`lib/api-client.ts`, `components/ai-chat/*`) gains a transient
  `kind:"streaming"` chat entry (grows via `delta`, replaced by the settled
  `kind:"answer"` entry on `meta`/`error`) — never persisted, never sent back
  as outgoing history.
- A future story that wants to stream the v2/persisted path can reuse
  `runAssistantTurnFromMessagesStreaming` + the same SSE framing; it will
  need its own persist-after-settle wiring (an explicit new decision, not
  silently inherited from this ADR).

## Confirmation

`__tests__/cam-412-*.test.ts` — the seam-invariant test walks every
resolution path (full stream / stream+meta / mid-stream error / before-
first-delta failure→JSON / no-streaming-capability→JSON / abort) and asserts
each ends in exactly one of the existing terminal outcomes, with identical
cards/suggestions validation regardless of transport; a dedicated case
asserts the `<suggestions>` delimiter split across two chunks never reaches
any `delta` event.
