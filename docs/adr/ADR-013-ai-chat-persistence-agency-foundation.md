# ADR-013 — AI chat foundation: persistent history + real agent loop + tiered tools

**Status:** PROPOSED — **G2 human tap pending.** Two decision points are the owner's call, not the architect's: **spend** (D5's multi-round loop ~2× the worst-case per complex question) and **retention** (D2's 180-day hard-delete of chat history). Everything else follows the standing rules (ADR-009 no-merge tool layer, `.claude/rules/security.md` AI-layer, `.claude/rules/architecture.md` atomic data). Flip to Accepted once the owner taps those two at G2 (or ratifies ahead of the S2 build). · **Epic:** AI Camping Assistant (CAM-266) · **Story:** S1 (CAM-413) · **Date:** 2026-07-19

**Confirmation** (MADR — the checks that fail if a decision here is violated):
- **D3/D6 invariant test** — a test asserts no personal-tool zod schema contains a `userId` (or any caller-identity) parameter; `ToolContext.userId` is only ever set server-side from the session. Red if a tool ever exposes identity to the model.
- **D2 no-leak test** — a test asserts `ChatMessage` has no `toolTrace` / `rawError` / `systemPrompt` column and that a persisted turn stores only sanitized `content` + `blocks`.
- **D7 byte-stable test** — the existing chat-contract tests (Wave-1 `{answer, cards, suggestions}` shape + the `{messages}` request) stay green unchanged; a new test asserts an unknown `blocks[]` type is skipped, not thrown.
- **D2/retention proof** — the retention job's first run prints a loud line proving it deleted ≥1 eligible row (per ops.md "graceful = silent" lesson), never a silent skip.

## Context

The owner set the direction (2026-07-19): audit the current AI chat architecture against the five research files (`docs/design/platform-master-plan / ai-team-workflow / ai-search-architecture / ai-product-roadmap / ai-assistant-journeys .html`) and **lay the foundation before planning more AI experience**. Three requirements are locked and non-negotiable: the assistant must be **personalized**, must **do more than question-and-answer** (act, not just reply), and must keep a **persistent conversation history — not "ask once and it's gone."**

What ships today (Wave 1, on staging) is a deliberately-cautious slice of the ADR-009 vision: a **single-round, stateless** tool-use turn. `ai-search-architecture.html` already specified an agent loop cap 4 + SSE, so the loop is a planned-but-not-yet-built piece, not a new invention. The real gaps against the three requirements:

- ❌ **Persistent history** — no store at all; every turn is stateless. (Not present in *any* research file either — this requirement is new from the owner.)
- ❌ **Personalization / auth in chat** — the chat endpoint is anonymous; the model has no idea who is asking, so it cannot answer "my last booking."
- ❌ **Multi-round agency** — the current turn serialises all context into one blob and runs one completion; it cannot chain tool calls to complete a task.
- ❌ **Rich in-bubble content contract** — the shipped `{answer, cards, suggestions}` has no room for the comparison tables / trip plans / CTAs the journeys file calls for.
- ✅ **Already correct per the vision:** the read-only tool layer (ADR-009), the cards, the chips, the assistant persona — these match and are untouched by this ADR.

This ADR is the **G2 design artifact** for the foundation. It designs the persistence model, the agent loop, the tiered tool registry, and the contract evolution so that the ten build stories (S2–S10, below) can be built without re-litigating architecture. No migration and no runtime code ship in this story — the decision is what lands here.

**Load-bearing existing surfaces this design must reuse, not fork** (per ADR-009 and the CAM-267/355 "no parallel data path" lessons):
- `lib/ai/openrouter-client.ts` — the current single-round turn; D4 evolves *this* loop, it is not replaced by a second one.
- `lib/ai/tools/*` — the existing read-only registry (`searchCampsites`, `checkAvailability`, `getCampDetail`); D6 adds a tier field and 4 personal tools that wrap **already-scoped** queries (`lib/bookings.ts` selects, wishlist, profile), never a new query path.
- `app/api/ai/chat/route.ts` — the anonymous chat endpoint; D3/D7 add optional auth + per-user rate limit + the persist step.
- `prisma/schema.prisma` `User` (`id String @id @default(uuid())`) — the owner of a conversation; no `ChatConversation`/`ChatMessage` model exists today (confirmed).

## Decision

Field classification tags follow `.claude/rules/architecture.md` §11: **[PII]** / **[Financial]** / **[Geo]** / **[Public]** (untagged = Public).

### Decision map (traceability)

| # | Decision | Ships as |
|---|---|---|
| D1 | Persist chat history for **authenticated users only**; guest stays stateless | S2 |
| D2 | Two-table atomic model (`ChatConversation` + `ChatMessage`), sanitized text + `blocks` JSON only; atomic append **after a turn succeeds**; **hard-delete + 180-day retention** | S2, S8 |
| D3 | Caps + evict-oldest (200 msg/conversation, 20 conversations/user) | S2 |
| D4 | Real **multi-role** agent loop, **cap 4** completions, forced final prose, per-turn tool cap 6, 45 s deadline | S3a, S3b |
| D5 | **Tiered tool registry** (`guest` \| `authed`, + a `write` seam); `ToolContext.userId` server-bound from session; **no userId in any schema the model sees**; 4 personal tools | S4, S5a, S5b |
| D6 | **Additive** contract: keep `{answer, cards, suggestions}`, add a versioned `blocks[]` envelope (unknown type = skip); request union `{messages}` \| `{conversationId?, message}` | S6 |
| D7 | Streaming (CAM-412) seam — one flush point designed now, slotted later without a rewrite | S6 seam / CAM-412 |

### D1 — Persist history for authenticated users only (guest stays stateless)

A conversation is written **only when a session exists**. A guest turn runs exactly as today — no row, no read-back — and the response instead carries copy inviting login when personal data is asked for. Rationale:

- **PDPA data-minimisation** — storing a guest's free-text questions keyed to a device/anonymous id is retained personal data with no consent surface and no benefit; the cheapest lawful posture is not to store it.
- **DB-spam surface** — the chat endpoint is public; persisting every anonymous turn hands an unauthenticated writer an unbounded insert path. Authed-only persistence + a per-user cap + rate-limit closes it.
- **Nothing to personalise** — a guest has no bookings/profile/wishlist, so there is no history worth resuming; the value of persistence is entirely a logged-in-user value.

### D2 — Two-table atomic model; store only what the user saw; hard-delete + 180-day retention

```prisma
enum ChatRole {
  USER
  ASSISTANT
}

model ChatConversation {
  id     String @id @default(uuid())
  userId String // owner — server-bound from session, NEVER client-supplied [PII-adjacent]
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  title String? // optional display label (truncated first user message); UI-neutral, display only

  messages ChatMessage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt // bumped on each atomic append → drives evict-oldest + the retention scan

  @@index([userId, updatedAt]) // "my conversations", newest-first + evict-oldest lookup
  @@index([updatedAt])         // retention cron scan (updatedAt < now-180d)
}

model ChatMessage {
  id             String           @id @default(uuid())
  conversationId String
  conversation   ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  role    ChatRole // USER | ASSISTANT only — no SYSTEM/TOOL row is ever persisted
  content String   // the sanitized plain text the user actually saw [PII — free text]
  blocks  Json?    // versioned render envelope (the cards/chips the user saw); null for a plain answer

  createdAt DateTime @default(now())

  @@index([conversationId, createdAt]) // replay in order + cap-200 count/evict
}
```
Plus the back-relation `chatConversations ChatConversation[]` on `User`.

- **Store the smallest replayable unit** — the sanitized `content` (what the user saw) + `blocks` (the exact cards/chips they saw, so re-opening the conversation renders instantly without re-running tools). `blocks` is scoped to *render* payloads, not a message dump — it is not a "put everything in JSON" escape hatch.
- **Never persist:** tool traces, raw errors, or the system prompt. They are internal, PII-risky, and give an attacker who reads a row nothing. This is enforced by the D2 no-leak Confirmation test (the model has no such columns to write to).
- **Atomic append, after success only** — a turn is written in one transaction *after* it resolves to a final prose answer. A turn that errors or times out mid-loop writes **nothing** (no half-answer, no leaked error into `content`).
- **Hard-delete + 180-day retention — a deliberate divergence from the house soft-delete convention.** Every other business Set uses `deletedAt` (soft-delete). Chat history does the opposite: a user delete, a conversation delete, and the retention cron all issue a real row `DELETE` (via `onDelete: Cascade`), not a `deletedAt` flag. **Reason:** PDPA favours genuine erasure over a tombstone that still holds the personal text; a "deleted" conversation that lingers as soft-flagged rows is exactly the retained-PII posture D1 avoids. Retention = a cron that hard-deletes conversations whose `updatedAt` is older than 180 days; its first run must prove it deleted ≥1 eligible row (Confirmation). Privacy copy tells the user history is kept ≤180 days and is deletable on demand.

### D3 — Caps + evict-oldest (200 messages / conversation, 20 conversations / user)

- **200 messages per conversation**, **20 conversations per user** — exceeding a cap **hard-deletes the oldest** (message within a conversation; conversation within a user) in the same transaction as the append. Bounds per-user storage, keeps the resume query cheap, and — with D1's authed-only + a per-user rate limit — removes the unbounded-growth surface. Values are starting budgets, tunable by the S2 build; the *mechanism* (bounded + evict-oldest) is the decision.

### D4 — Real multi-role agent loop (cap 4, forced final prose, tool cap 6, 45 s deadline)

Replace the "serialise everything into one blob, run one completion" turn with a **proper `messages[]` array of real roles** (system, user, assistant, tool) and a bounded loop:

- **Cap 4 completions** (matches `ai-search-architecture.html`); the **last round is forced to answer in prose** (no further tool calls) so the loop always terminates with a user-facing answer.
- **Per-turn tool-call cap 6** and a **45-second wall-clock deadline** — hard ceilings on both spend and latency.
- **Injection hardening (why multi-role also helps security):** every user/history message is fenced as **DATA per-item** rather than concatenated into one prompt blob, and history is **re-sanitised on read** — so a malicious past message cannot break out and be read as an instruction on a later turn.
- **Spend:** worst case ≈ 2× a single-round turn on a complex multi-tool question; still หลักสตางค์ (sub-baht order) on the pinned cheap model. **This is the first of the two owner G2 tap points.** Frames OWASP "excessive agency": the loop's caps + the read-only-by-default registry (D5) are the bound on how much the agent can do before a human-confirmed write.

### D5 — Tiered tool registry + server-bound identity + 4 personal tools

- Each tool carries **`tier: guest | authed`** and the registry is filtered by whether a session exists (+ a `write` tier reserved as a seam for a future confirmed-write tool à la ADR-009's guardrail — not built here).
- **`ToolContext.userId` is set server-side from the session and is the ONLY way a tool learns who is asking.** It is **not a parameter in any tool's zod schema** — the model literally cannot see, set, or forge a caller identity. An **invariant test** (Confirmation) asserts this for every personal tool. This makes cross-user access **structurally impossible**, not merely checked — the ADR-009 "model output is data, never trusted" rule extended to identity.
- **Four new `authed`-tier personal tools**, each wrapping an **already-scoped** existing query (never a new query path):
  - `getMyBookings` — the caller's bookings (wraps the scoped `lib/bookings.ts` select).
  - `getMyBookingDetail` — one booking the caller owns.
  - `getMyProfile` — the caller's profile with the **phone masked** (`081-•••-••XX`) so the raw number never enters the model context [PII].
  - `getMyWishlist` — the caller's wishlisted camps.

### D6 — Additive contract evolution (versioned `blocks[]` + request union)

- **Response:** keep `{answer, cards, suggestions}` exactly (Wave-1 clients + tests stay byte-stable) and **add** `blocks[]` — a versioned envelope where each block declares a `type`. **Unknown type = the client skips it, never throws.** Every rich journeys artifact (comparison table, trip plan, CTA) is then an additive new block type, no breaking change.
- **Request:** a **union** — the existing `{messages}` shape **and** the new `{conversationId?, message}` shape both parse. Existing tests pass unchanged; the new shape drives persisted multi-turn.

### D7 — Streaming seam (CAM-412 slots in later)

The final-prose answer is emitted at **one flush point**. Designing that single seam now means CAM-412 (SSE streaming of the last answer, spec already on a branch) can be added later **without restructuring** the loop or the contract — stream the final round, keep the tool rounds server-side.

## Alternatives considered

### (a) Guest persistence with an anonymous key — **rejected**
Persist guest turns keyed to a device/anonymous cookie so a returning guest resumes their chat. Rejected: it stores personal free-text with no consent surface (PDPA data-minimisation), it re-opens the unauthenticated unbounded-insert spam path D1 closes, and an anonymous correlation key is itself a fresh PII/linkage risk — all to serve a user who has no bookings/profile to personalise anyway. Guest value comes from a good stateless answer + a login invite, not a stored anonymous history.

### (b) Restructure the response contract now (breaking) — **rejected**
Redesign `{answer, cards, suggestions}` into a single unified `blocks`-only shape immediately. Rejected: it breaks the shipped Wave-1 client and every byte-stable contract test for no user-visible gain, and it couples the persistence work to a contract migration. The additive versioned-envelope + request-union path (D6) reaches the same rich-content end state with zero breakage and keeps the two changes independently shippable.

### (c) Summarise / compact old turns to fit context — **deferred (not rejected)**
Roll old turns into a running summary so a very long conversation still fits the model context window. Deferred: at current turn counts the cap-200 window + the 45 s deadline + a cheap pinned model are sufficient, and a lossy summary risks dropping a fact the user relies on. Revisit when a real conversation approaches the model's context limit — the two-table model already keeps full turns, so a summary layer can be added later without a migration.

## Consequences

**Positive:**
- **No re-architecture of retrieval** — persistence + agency + tiering sit *on top of* the ADR-009 tool layer; availability/price stay live and correct by construction.
- **Personalisation is safe by design** — server-bound `userId` + no-identity-in-schema make cross-user leakage structurally impossible, not a check that can be forgotten (the CAM-267/355 failure class).
- **Additive contract** — rich in-bubble content and multi-turn persistence ship without breaking the live client or its tests; each of S2–S10 is an atomic ≤400-line PR.
- **PDPA-forward** — authed-only + hard-delete + 180-day retention + a delete-on-demand path is a defensible personal-data posture from day one.
- **Streaming-ready** — CAM-412 is a later add, not a rewrite.

**Negative / trade-offs (the honest cost):**
- Spend and latency rise on complex questions (D4) — bounded, but real; **owner G2 tap #1**.
- A migration adds two tables + one enum (additive, reversible) plus a retention cron to own and monitor; **owner G2 tap #2** is the 180-day figure.
- A deliberate divergence from the house soft-delete convention (D2) that future readers must not "correct" back to `deletedAt` — the Confirmation test + this ADR are the guardrail.

### Risks (1–8)

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Latency / spend** — multi-round loop can ~2× a complex turn | Cap 4 completions · tool cap 6 · 45 s deadline · forced final prose · cheap pinned model — owner-gated at G2 |
| 2 | **Prompt injection via stored history** — a past user/tool message re-enters the prompt | Per-item DATA fencing (not one blob) · re-sanitise history on read · stored `content` is never treated as instructions |
| 3 | **Cross-user data leak (IDOR via tools)** — a personal tool returns another user's data | `ToolContext.userId` server-bound from session · **no userId in any tool schema** the model sees · invariant test — structurally impossible |
| 4 | **Duplicate / replayed turn** — a client retry appends/answers twice | **Accepted for v1** (atomic append per successful turn, no dedup key) → follow-up: idempotency key on the turn |
| 5 | **Unbounded growth / write spam** — conversations/messages grow without bound | Caps 200/20 + evict-oldest · per-user rate limit on the endpoint · authed-only (guest never writes) |
| 6 | **Retention / PDPA correctness** — the cron must actually hard-delete, and a user delete must cascade | `onDelete: Cascade` · retention cron with a first-run proof it deleted ≥1 row (no silent skip) · privacy copy (≤180 days, deletable) |
| 7 | **Stale / partial write on turn failure** — a half-answer or raw error persisted | Atomic append **only after** a final prose answer · nothing written on error · no `toolTrace`/`rawError`/`systemPrompt` columns exist |
| 8 | **Contract drift breaking existing clients** — `blocks[]` breaks the live client/tests | Purely additive versioned envelope · unknown-block-type = skip · request union so `{messages}` and `{conversationId?, message}` both parse — existing tests byte-stable |

## Build order — S1–S10 → CAM-413..423

Ten build stories under epic CAM-266, each a PR ≤ ~400 lines, run in three parallel lanes that converge. CAM ids below are the intended sequence to be created under the epic (the ticket DB is the status SoT; these are provisional until created).

| # | CAM | Story | Size | Decision(s) |
|---|---|---|---|---|
| S1 | **CAM-413** | ADR-013 — record the foundation decision (**this story**); the G2 human tap = spend + retention | S | all |
| S2 | CAM-414 | Prisma models + `conversation-store` (atomic append, caps, evict-oldest) | M | D1, D2, D3 |
| S3a | CAM-415 | Real multi-role `messages[]` (per-item DATA fencing) | M | D4 |
| S3b | CAM-416 | Agent loop cap 4 + forced final prose + tool cap 6 + 45 s deadline | M | D4 |
| S4 | CAM-417 | Tiered registry (`guest`/`authed` + `write` seam) + server-bound `ToolContext.userId` + invariant test | S–M | D5 |
| S5a | CAM-418 | Booking tools: `getMyBookings` / `getMyBookingDetail` | M | D5 |
| S5b | CAM-419 | Profile + wishlist tools: `getMyProfile` (phone-masked) / `getMyWishlist` | M | D5 |
| S6 | CAM-420 | Route v2: request union + optional session + persist + `blocks[]` envelope | M–L | D6, D7 seam |
| S7 | CAM-421 | Conversation endpoints: list / view / delete | M | D2 |
| S8 | CAM-422 | Retention cron (180-day hard-delete) + privacy copy | S | D2 |
| S9 (+S10 opt) | CAM-423 | UI resume: login re-opens the last chat + a "start new" button (+ optional merge of the guest thread) | M–L | D1, D6 |

Verification (per the plan): full role rotation on the auth-adjacent stories (Security confirms the model cannot inject `userId`, cross-user data is structurally impossible, phone mask is real); a real localhost smoke — ask "my latest booking" as a guest (gets a login invite) and logged-in (gets real data); promote → staging; **not prod**.

## Links

- Supersedes nothing; **builds on** ADR-009 (no-merge tool layer, availability live) and ADR-011 (HostOS-first re-sequencing). The read-only tool layer, live-availability, and deferred-embeddings decisions of ADR-009 are unchanged.
- Security posture: `.claude/rules/security.md` (AI/agent-layer: untrusted input + output, server-bound identity, spend/turn cap) · `.claude/rules/architecture.md` (atomic Pixels, snapshot rule, Resolution Boundary).
- North-star for the rich content the `blocks[]` envelope will carry: `docs/design/ai-assistant-journeys.html`, `docs/design/ai-search-architecture.html`.
- Streaming follow-on: CAM-412 (SSE, spec on a branch, slots into the D7 seam).
