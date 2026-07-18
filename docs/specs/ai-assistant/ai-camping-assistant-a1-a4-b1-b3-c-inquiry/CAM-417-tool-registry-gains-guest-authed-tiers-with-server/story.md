---
linear: CAM-417
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-19
---
# Tool registry gains guest/authed tiers with server-bound user context (CAM-417)

> Full design: `docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md` §D5 (ratified 2026-07-19).
> Type: internal engine plumbing (wire contract byte-stable). Spec-lite class: no schema/migration,
> no new/changed API contract — `POST /api/ai/chat` request/response shape unchanged.
> G1: folded — ADR-013 D5 is the ratified spec; no separate G1 tap for this story.
> Depends on: CAM-416 (`lib/ai/openrouter-client.ts`'s bounded agent loop this story extends).

## Story
As the **platform** (server-authoritative tool layer, no direct end-user-facing screen), I want the
AI tool registry to carry a `guest`/`authed` tier and a server-bound `ToolContext` on every
`execute()`, so that a later story (CAM-418/419) can add personal tools (bookings, profile, wishlist)
that are structurally impossible for the model to invoke on someone else's behalf — the model can
never see, set, or forge the caller's identity (OWASP excessive-agency control point).

Scope: `lib/ai/tool-registry.ts` gains `ToolTier` (`'guest' | 'authed'`, left open for a future `'write'`
seam — no write machinery here), `ToolContext` (`{ userId?: string }`), `getRegisteredTools(tier)`
(returns only that tier's tools), and a `dispatchTool` guard that refuses an `authed` tool when
`ctx.userId` is absent. The two existing tools (`searchCampsites`, `checkAvailability`) become
`tier: 'guest'`. `lib/ai/openrouter-client.ts` threads an optional `ctx: ToolContext = {}` through the
whole turn (`runAssistantTurn`/`runAssistantTurnFromMessages` -> `runTurnFromBaseMessages` -> the model
call chain -> `executeToolCalls` -> `dispatchTool`) and composes the tool schema list from the tier
(guest always; authed added only when `ctx.userId` is present).
**Out of scope (explicitly, this story does NOT):** add any personal (`authed`-tier) tool — CAM-418/419;
read `auth()` in `app/api/ai/chat/route.ts` — CAM-420. Every real request today still resolves `ctx = {}`
end-to-end, so the `guest` tier is the only ACTIVE tier on the wire — no behavior change for the camper.
Depends on: CAM-416 (the bounded-loop engine this story threads `ctx` through).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A caller has no session (`ctx = {}`, the only path exercised today) | The turn builds its tool schema list | — (no screen; answer/cards unchanged from pre-CAM-417) | Only `guest`-tier tools (`searchCampsites`, `checkAvailability`) are offered to the model — byte-identical to before this story | EC-1 |
| AC-2 | A caller has a session (`ctx.userId` set — exercised only by tests until CAM-420) | The turn builds its tool schema list | — | Both `guest`-tier AND `authed`-tier tools are offered to the model | EC-2 |
| AC-3 | The model requests a real, registered `authed`-tier tool while `ctx.userId` is absent | `dispatchTool` runs | — | The call is refused (`{ok:false, code:'unauthorized_tool'}`); the tool's own `execute()` is never invoked | EC-3 |
| AC-4 | The model requests a tool name that is not registered at all (a hallucination) | `dispatchTool` runs | — | The call is refused (`{ok:false, code:'unknown_tool'}`), identical to pre-CAM-417 behavior; no tool's `execute()` runs | EC-4 |
| AC-5 | The full registered tool set (every tier) | A security scan runs | — | No tool's zod `parameters` shape or hand-written `jsonSchema` contains a `userId` (or any caller-identity) field — the model has no way to see, set, or forge one | EC-5 |

## Rules
- BR-1: `ToolTier = 'guest' | 'authed'` — a union deliberately left open for a future `'write'` value (ADR-013 D5 seam); no `'write'` tier or write-tool machinery is added in this story.
- BR-2: `ToolContext = { userId?: string }` is built server-side from the NextAuth session per request and passed into `dispatchTool`/`execute()` only — it is NEVER a field in any tool's zod `parameters` or `jsonSchema` (proves AC-5).
- BR-3: `getRegisteredTools(tier)` returns exactly the tools registered at that tier — no cross-tier inclusion. The caller composes tiers (`buildToolSchemas` in openrouter-client.ts: `guest` always, `authed` appended only when `ctx.userId` is present) (proves AC-1/AC-2).
- BR-4: `dispatchTool(name, rawArgs, ctx = {})` checks, in order: (1) tool exists → else `unknown_tool`; (2) `tool.tier === 'authed' && !ctx.userId` → `unauthorized_tool`, no execution; (3) zod parse → else `invalid_args`; (4) `execute(parsedArgs, ctx)` (proves AC-3/AC-4).
- BR-5: `ctx` defaults to `{}` at every layer it isn't explicitly supplied (`runAssistantTurn`, `runAssistantTurnFromMessages`, `runTurnFromBaseMessages`). No caller in this codebase passes a non-default `ctx` yet — the route does not call `auth()` until CAM-420 — so every real turn today resolves the guest-only tool list, unchanged from before this story.

## Edge cases
- EC-1: IF a guest-tier request's model hallucinates a call to a tool name it was never offered but that IS registered as `authed` THEN the refusal is `unauthorized_tool` (BR-4 step 2), not silently allowed.
- EC-2: IF `ctx.userId` is present but no `authed`-tier tool is registered yet (true until CAM-418/419 ship) THEN `getRegisteredTools('authed')` returns `[]` and the composed schema list is unchanged from guest-only — no crash, no phantom tool.
- EC-3: IF an `authed`-tier tool's `execute()` were ever reached without `ctx.userId` THEN that is a defect in `dispatchTool` itself — the BR-4 ordering (tier check before zod parse, before execute) is the enforced invariant this story ships.
- EC-4: IF the model requests a totally unregistered name (e.g. a plausible-sounding `getMyBookings` before CAM-418 ships it) THEN the result is `unknown_tool`, distinct from `unauthorized_tool` — the caller cannot infer from the error code alone whether a tool exists but is gated, or does not exist.
- EC-5: IF a future tool author adds `userId` to a tool's zod schema or `jsonSchema` by mistake THEN the CAM-417 invariant test (`__tests__/cam-417-tool-registry-tiers.test.ts`) fails, catching it before merge.

## Data
- No schema/migration. `lib/ai/tool-registry.ts` gains `ToolTier`, `ToolContext`, a `tier` field + 2nd `execute` param on `ToolDefinition`, a new `ToolDispatchResult` code `'unauthorized_tool'`, and `getRegisteredTools(tier)` (was zero-arg). `lib/ai/tools/search-campsites.ts` / `check-availability.ts` gain `tier: 'guest'`. `lib/ai/openrouter-client.ts` threads an optional `ctx: ToolContext = {}` through `runAssistantTurn`, `runAssistantTurnFromMessages`, `runTurnFromBaseMessages`, the model-call chain, and `executeToolCalls`.

## Seams & refs
- Reuse: `lib/ai/tool-registry.ts` (the CAM-270 dispatch pipeline this story extends, never forked) · the CAM-416 `runTurnFromBaseMessages` bounded-loop engine (ctx threads through unchanged loop semantics). Refs: ADR-013 §D5 · ADR-009 (no-merge tool layer) · CAM-270 (original registry) · CAM-416 (the loop this story threads ctx through).
- Not touched: `app/api/ai/chat/route.ts` (no `auth()` read — CAM-420) · no personal tool added (CAM-418/419) · `lib/ai/conversation-store.ts` (persistence, CAM-414, unrelated).

## Out of scope
- 4 personal `authed`-tier tools (`getMyBookings`, `getMyBookingDetail`, `getMyProfile`, `getMyWishlist`) → CAM-418/CAM-419.
- Reading `auth()` in the chat route to populate a real `ctx.userId` → CAM-420.
- A `'write'` tier or any confirmed-write tool machinery → not scheduled; ADR-013 D5 seam only.

## Self-verify
- AC-1..5 → unit (`__tests__/cam-417-tool-registry-tiers.test.ts` — tier filtering, dispatch refusal,
  hallucinated-name distinction, the whole-registry no-userId invariant) + updated
  `__tests__/cam-270-tool-registry.test.ts` (tier field + 2-arg execute assertions).
- Story-specific: sibling AI suites (CAM-270/271/272/404/405/406/408/409/410/411/414/415/416/421/422)
  re-run green with only the two pinned `dispatchTool` call-shape assertions updated in
  `cam-270-openrouter-client.test.ts` (added the now-real 3rd `ctx` arg, default `{}` — a genuine call-
  shape change, not a weakened assertion) — full suite re-run as the last act, zero new failures.
- Gate = `/quality-gate` · Done = merged into `dev`, AC verified on localhost (dev DB) before merge.

## Changelog
- v1 (2026-07-19) — created.
