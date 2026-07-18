---
linear: CAM-270
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-07-18
---
# AI assistant tool layer: safe campsite search tool + OpenRouter client (AI-1) (CAM-270)

## Story
As a **Platform** team member, I want a safe, read-only AI tool layer (`searchCampsites`, `checkAvailability`) plus a server-only OpenRouter client with spend + prompt-injection guards, so that a later chat assistant can answer camping questions from live platform data without querying the DB directly, leaking the model key, or running an uncapped paid loop.
Why: this is the first paid-call surface of the AI roadmap — the spend and untrusted-input guardrails must be fixed at the foundation, before any endpoint/UI can invoke it (ADR-009, security.md AI-layer).
Scope: lib-only foundation — a tool registry + 2 read-only tools + a single-round OpenRouter client + additive petFriendly filter support. No chat endpoint, no streaming, no multi-turn agent loop, no UI.
Depends on: ADR-009 (+ ADR-011 amendment) · `getRemainingCapacity` availability read service (CAM-267/CAM-303, shipped) · `buildCampSiteWhere` + `campCardSelect` (shipped) — all reused, none modified except the additive petFriendly filter.

## AC
<!-- No UI at this layer: the "Then (user sees)" column is `—` on every row (reason: foundation lib story, user-facing Thai copy lands in CAM-272). The contract lives in "System effect". -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | `searchCampsites` is called with valid filters (province / price range / type / petFriendly) | the registry dispatches the tool | — (no UI; CAM-272) | returns at most 10 card payloads built via `buildCampSiteWhere` + `campCardSelect`, always gated to `isActive:true`+`isPublished:true`+`deletedAt:null`; the petFriendly filter is applied only when requested | EC-1 |
| AC-2 | `checkAvailability` is called with a campSiteId + a date range | the registry dispatches the tool | — (no UI; CAM-272) | returns the LIVE `getRemainingCapacity` result (capacity / bookedGuests / heldGuests / remaining / blockedByHost), never cached; a host-blocked or numerically-full range yields `remaining = 0` | EC-4 |
| AC-3 | the model requests a tool with args that fail that tool's zod schema | the registry validates args before executing | — (no UI; CAM-272) | the tool does NOT execute, no DB query runs; the registry returns a handled validation error | EC-2 |
| AC-4 | the model requests a tool name that is not in the registry | the registry looks it up | — (no UI; CAM-272) | rejected without execution; a handled "unknown tool" error is returned, no DB or model side-effect | EC-3 |
| AC-5 | `OPENROUTER_API_KEY` is not set (dev / CI / preview) | the OpenRouter client is called | — (no UI; CAM-272) | the call is skipped and a handled skipped result is returned — no network call, no throw — mirroring the email-client self-skip | EC-5 |
| AC-6 | the primary model call returns a non-2xx or times out | the OpenRouter client runs | — (no UI; CAM-272) | the client falls back once to `OPENROUTER_MODEL_FALLBACK`; if that also fails it returns a handled generic error, never the raw model error, status body, or key | EC-6 |
| AC-7 | one user turn is processed with a key present | the client makes the paid call with the tool schemas | — (no UI; CAM-272) | exactly ONE tool-call round runs (no multi-turn loop), `max_tokens` is capped at the configured ceiling, and the structured result carries `{ answer, cards }` | EC-7 |
| AC-8 | `searchCampsites` matches zero campsites | the tool runs | — (no UI; CAM-272) | returns an empty `cards` array (not null, not an error) so the caller can render an empty state | — (this row IS the empty-result edge) |
| AC-9 | the user text contains content attempting to override the system prompt | the client builds the prompt | — (no UI; CAM-272) | the text is sanitized/normalized and placed in the prompt as DATA only; the model output is parsed as data, never executed or followed as instructions | EC-9 |

## Rules
- BR-1 Both tools are READ-ONLY and ALWAYS apply the public gate `isActive:true, isPublished:true, deletedAt:null` (searchCampsites via `buildCampSiteWhere`; checkAvailability reads published camps only). The registry contains no write tool. (proves AC-1, AC-2)
- BR-2 `searchCampsites` hard-caps output at `take: 10` regardless of any model-supplied count — a larger request is clamped to 10, never overridden. Search dates do NOT exclude camps (CAM-344 hide→badge); "is it free on date X" is `checkAvailability`'s job. (proves AC-1)
- BR-3 Every tool argument is zod-validated in the registry BEFORE the tool executes; invalid args, malformed tool-call JSON, or an unknown tool name are rejected with no DB query and no side-effect (LLM output is untrusted). (proves AC-3, AC-4, EC-7)
- BR-4 `checkAvailability` wraps `getRemainingCapacity` as a LIVE query on every call — never cached, never embedded (ADR-009) — and reuses the shipped `MAX_STATUS_RANGE_NIGHTS = 366` guard, so an over-wide/invalid range returns the guard's safe result instead of looping. (proves AC-2, EC-4)
- BR-5 The OpenRouter key is read from `OPENROUTER_API_KEY` server-side only (never `NEXT_PUBLIC_*`, never in the client bundle/log); when unset the client self-skips and returns a handled skipped result (dev/CI/preview stay green, zero spend). The model id comes from `OPENROUTER_MODEL` (default a cheap, fast tool-calling model) with `OPENROUTER_MODEL_FALLBACK` as the one-time fallback. (proves AC-5, AC-6)
- BR-6 Spend guards on every live call: `max_tokens` capped at the configured ceiling AND exactly ONE tool-call round per turn (no agent loop in this story). A non-2xx/exception falls back once, then returns a handled generic error — the raw model error, status body, and key are never surfaced to the client. (proves AC-6, AC-7)
- BR-7 User text is sanitized/normalized before entering the prompt (prompt-injection defense); model output is parsed as DATA and never executed or followed as instructions (security.md AI/agent-layer). (proves AC-9, EC-7)
- BR-8 Any LIVE-call surface that invokes an assistant turn MUST first apply a per-IP `checkRateLimit` at 30 requests / 15 min; over-limit returns a handled rate-limited result before any paid call, surfaced by the UI as `มีคำถามเข้ามามากเกินไป กรุณารอสักครู่แล้วลองใหม่` (CAM-272). This story reuses the existing helper and fixes the contract; the IP-keyed enforcement point is the chat endpoint (CAM-271). (proves EC-8)
- BR-9 petFriendly filter is additive: when `petFriendly: true` is supplied, `buildCampSiteWhere` adds `petFriendly: true` pushed into `where.AND` (so it never clobbers the keyword `OR`); when absent/false, pet filtering is not applied (existing behavior unchanged). (proves AC-1)

## Edge cases
- EC-1 IF `searchCampsites` is asked to include unpublished / inactive / soft-deleted camps (or the model tries to drop the gate) THEN the base gate still applies and those camps are excluded (BR-1)
- EC-2 IF tool args fail the zod schema THEN reject before execution, no DB query runs (BR-3)
- EC-3 IF the model requests an unknown tool name THEN reject with a handled "unknown tool" error, no side-effect (BR-3)
- EC-4 IF `checkAvailability` gets an over-wide (> 366 nights) or invalid/inverted range THEN it returns the shipped guard's safe result — no per-night loop, no throw to the caller (BR-4)
- EC-5 IF `OPENROUTER_API_KEY` is unset THEN the client self-skips, returns a handled skipped result, makes no network call, and never throws (BR-5)
- EC-6 IF the primary AND fallback model calls both fail THEN return a handled generic error; never leak the raw error, status body, or key (BR-6)
- EC-7 IF the model returns malformed/garbage tool-call JSON THEN it is treated as an invalid tool request and rejected via the registry (no execution); the turn returns a handled error (BR-3, BR-7)
- EC-8 IF a live-call surface exceeds 30 calls / 15 min for one IP THEN the turn is refused with a handled rate-limited result before any paid call (BR-8)
- EC-9 IF the user text tries to override the system prompt THEN it is sanitized and passed as data only; the model output is never executed (BR-7)

## Data
- No schema change, no migration. `petFriendly` is an EXISTING `CampSite` `Boolean @default(false)` field — this story only adds filter support in `buildCampSiteWhere`, it does not alter the column. `searchCampsites` reuses `campCardSelect` verbatim; `checkAvailability` reads via `getRemainingCapacity` (no new query).
- New config (env, not schema): `OPENROUTER_API_KEY` (server-only secret), `OPENROUTER_MODEL`, `OPENROUTER_MODEL_FALLBACK`.

## Seams & refs
- Reuse: `lib/campsite-filters.ts` `buildCampSiteWhere` (searchCampsites where-builder + the new additive petFriendly step) · `lib/read-models/camp-card.ts` `campCardSelect` / `CampCardPayload` (card payload) · `lib/campsite-availability.ts` `getRemainingCapacity` + `MAX_STATUS_RANGE_NIGHTS` (checkAvailability live read + range guard) · `lib/email/client.ts` (the server-only, self-skip, plain-fetch, no-npm-dep external-client pattern the OpenRouter client copies) · `lib/rate-limit.ts` `checkRateLimit` (per-IP guard, wired at the CAM-271 endpoint). Refs: ADR-009 (tool-use over normalized data; no merge/warehouse; live availability; embeddings deferred) + ADR-011 amendment (C-cluster → HostLead, deferred in this POC) · `.claude/rules/security.md` §AI/agent-layer.
- petFriendly reader/writer inventory (architecture.md 15b): written by the host listing edit (NO-CHANGE); read by camp-detail display (NO-CHANGE); newly read as a filter in `buildCampSiteWhere` (this story, ADDITIVE). No other reader derives/enforces from petFriendly, so no forked path is created.

## Out of scope
- Chat endpoint + single-turn orchestration + per-IP rate-limit enforcement wiring → CAM-271 (chat endpoint)
- Chat UI (floating entry + home entry + in-chat cards, Discover-only; cards link to `/campgrounds/[slug]`) → CAM-272 (chat UI)
- `getCampDetail` tool + multi-turn agent loop (> 1 tool round) + streaming → CAM-271 / later
- Embeddings / pgvector semantic ("vibe") search → deferred (ADR-009, content-only later)
- HostLead / inquiry handoff (needs HostOS lead inbox, M1.2) → deferred; POC cards link to `/campgrounds/[slug]` instead (ADR-011)
- Persistent per-user/day spend cap (needs a shared store; `lib/rate-limit.ts` is best-effort in-memory) → deferred; this POC contains spend via `max_tokens` + single round + per-IP rate-limit
- Real OpenRouter spend approval → G2 (owner); no real paid call in this story's tests

## Self-verify
- AC-1 → unit (searchCampsites: valid filters incl. petFriendly → ≤10 payloads via buildCampSiteWhere+campCardSelect, gate present; mock prisma)
- AC-2 → unit (checkAvailability → getRemainingCapacity passthrough; full/blocked range → remaining 0; mock the read service)
- AC-3, AC-4 → unit (registry rejects invalid args + unknown tool with no prisma call)
- AC-5 → unit (key unset → skipped result, fetch never called)
- AC-6 → unit (primary non-2xx → fallback called once; both fail → handled error, no key/raw error in result)
- AC-7 → unit (exactly one tool-call round; max_tokens present in the request body; mock fetch)
- AC-8 → unit (zero match → empty cards array)
- AC-9 → unit (sanitizer normalizes injection text; output parsed as data)
- EC-8 → unit (rate-limit over-limit path, at the boundary the CAM-271 endpoint will call)
- Story-specific: all tests MOCK fetch (no real OpenRouter spend); one owner-run manual localhost smoke after the owner places `OPENROUTER_API_KEY` in `.env` (G2 spend-gated). petFriendly filter: assert additive (does not clobber the keyword `OR`).
- Gate = /quality-gate · Done = merge to `dev` + AC verified on localhost (dev DB). No real paid call at G1; live spend is owner-approved at G2.

## Changelog
- v1 (2026-07-18) — created (spec-first, template v2). POC re-scope (owner-approved 2026-07-18): CAM-270 = foundation lib layer carrying BOTH `searchCampsites` and `checkAvailability` tools + the OpenRouter single-round client + additive petFriendly filter (the stale ticket description put `checkAvailability` in AI-2/CAM-271 and omitted petFriendly). Chat endpoint → CAM-271, chat UI → CAM-272. Discover-only POC; HostLead/inquiry handoff deferred (no M1.2 lead inbox yet) — chat cards link to `/campgrounds/[slug]`.
