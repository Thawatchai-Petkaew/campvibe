# ADR-009 — AI Camping Assistant: data architecture + retrieval strategy

**Status:** PROPOSED — **verified NOT shipped** (2026-07-04 PO audit): the AI Camping Assistant epic (CAM-266) is 1/5 done — only the prep-data story CAM-267 (availability partial-capacity) is Done; the tool-layer/chat/card stories this ADR actually decides (CAM-270 architect, CAM-271 backend, CAM-272 designer) are still Backlog. The decision recorded here is real and current (amended in part by ADR-011), but no code implementing it exists yet. Left as Proposed; flip to Accepted only once CAM-270 clears its own G2 (or the human explicitly ratifies the decision ahead of implementation). · **Epic:** AI Camping Assistant · **Date:** 2026-07-01

## Context

The owner wants a **chat assistant** (not a search box) that answers any camping question from **platform-internal data**, renders results as **Cards inside the chat** (clickable → the existing booking flow), and handles live natural-language queries such as *"วันนี้ลานแบบนี้มีว่างไหม"*.

The core architectural question raised by the owner:

> ฐานข้อมูลที่เราเก็บแยกกันต้องทำอย่างไรถึงจะ search ได้แบบภาพกว้าง … จำเป็นต้องทำ Architect ข้อมูลหรือไม่? มารวมกันหรืออย่างไร
> *(Our data is stored in separate normalized tables — how do we make it broadly searchable? Do we need to re-architect / merge the data?)*

Today the data lives in a normalized Prisma/Postgres schema: `CampSite`, `Spot`, `Booking`, `BlockedDate`, `Review`, `Location`/`AdminArea`, taxonomy `options`. Retrieval logic already exists and is reused across the app:

- `lib/campsite-filters.ts` `buildCampSiteWhere(params)` — the centralized WHERE builder (keyword OR, province/district, price, guests, taxonomy `options:{some:{code}}`, availability sub-query over `spots.bookings` excluding CANCELLED).
- `lib/campsite-availability.ts` — live availability (`getCampSiteDailyAvailability` / `checkDateAvailability`).
- `lib/read-models/camp-card.ts` `campCardSelect` / `CampCardPayload` — the exact card payload the UI renders via `components/CampgroundCard.tsx`.

The tension: an LLM cannot answer "broadly" if each fact lives in a separate table, so the instinct is to **merge/denormalize** the data into one searchable store (a document index, embeddings/vector store, or a data warehouse). That instinct is wrong for this workload, and this ADR records why.

Scale is small (N ~ hundreds of campsites). The key constraint: **availability and price are transactional and must be fresh** — a stale answer that says a full campsite is available causes a double-booking and destroys trust.

## Decision

**Do NOT merge, denormalize, or warehouse the data. Keep the normalized schema as the single source of truth, and add a typed "tool layer" that JOINs the existing tables at question time. The LLM is a tool-use / function-calling agent that never queries the DB directly.**

Architecture:

```
Normalized tables  →  Tool layer (typed, read-only)  →  AI agent (tool-use)  →  Chat + Cards  →  existing booking flow
CampSite/Booking/…    buildCampSiteWhere · availability   OpenRouter, cap 4      generative UI       (unchanged)
```

- **Retrieval = function calling over the DB**, not embeddings-RAG and not text-to-SQL. The agent is given a small registry of typed, zod-validated, read-only tools:
  - `searchCampsites(filters)` — wraps `buildCampSiteWhere` + `campCardSelect`; returns card payloads.
  - `checkAvailability(campSiteId, dateRange)` — wraps `lib/campsite-availability.ts`; **always a live query**, never cached/embedded.
  - `getCampDetail(idOrSlug)` — full detail for follow-up questions.
- **Cards are emitted by the server as a structured `cards` block** (the tool return payload), rendered by the existing `CampgroundCard` — they do not pass through the model's token budget, and clicking a card enters the existing booking flow (no AI write path).
- **Embeddings / pgvector = deferred, and content-only when introduced** (vibe/free-text review semantics), never for availability/price/inventory.
- **No data warehouse, no sync pipeline, no merged "search document"** — at N ~ hundreds, a JOIN at query time is fast and always consistent; a denormalized copy would add a staleness/consistency burden with no benefit.

**Chat v1 scope (owner-locked):** cluster **A (Discover)** + **C (Book handoff)** only. Compare/decide (B), trip/route planning (D), and host tools are later phases. Three **prep-data stories** (not AI, no spend) run *before* the AI stories to close data gaps that would otherwise make the assistant answer incorrectly.

## Alternatives

### (b) Embeddings + vector store (RAG) as the primary retrieval

Embed each campsite into a vector store; retrieve by semantic similarity. **Rejected as the primary path** because:
- Availability, price, capacity, and dates are **exact/transactional** — semantic similarity cannot answer "เหลือกี่ที่เสาร์นี้" correctly, and any embedded snapshot is stale the moment a booking lands (double-booking risk).
- It adds an embedding pipeline, a vector store, and a re-index-on-write burden for N ~ hundreds where a direct JOIN is already sub-100ms.
- Structured filters (province, price ≤ X, pet-friendly, guests) are precisely what SQL/Prisma does best; forcing them through vector search loses precision.
- **Kept for later, content-only:** semantic ranking of free-text review/vibe text is a genuine fit and can be layered in as a hybrid signal once the structured path is proven.

### (c) Text-to-SQL (LLM generates SQL against the schema)

Let the model write SQL directly. **Rejected** because:
- Security: arbitrary generated SQL against a production DB is an injection/oversharing surface (bypasses the public gate `isActive/isPublished/deletedAt`, can read other users' data). Hard to sandbox safely.
- Correctness: the model can hallucinate columns/joins; our availability logic (BlockedDate + capacity summing) is subtle and already encoded correctly in `campsite-availability.ts` — re-deriving it per query invites drift.
- The typed tool layer gives the same "broad" capability with a bounded, reviewed, testable surface.

### (d) Merge / denormalize into one searchable document store or warehouse

Flatten the tables into one wide "campsite search document" (or a warehouse) that the AI reads. **Rejected** because:
- It duplicates the source of truth and requires a sync pipeline; every write must fan out or the document goes stale — exactly the failure mode we must avoid for availability.
- At N ~ hundreds there is no query-performance problem to solve; the JOIN is cheap.
- It is a large architectural commitment (new store, ETL, consistency handling) for zero benefit at this scale — violates the "lean" iron rule.

## Consequences

**Positive:**
- **No schema migration and no new datastore** to stand up the assistant — the tool layer reuses `buildCampSiteWhere`, `campsite-availability`, and `campCardSelect` verbatim, so chat answers stay consistent with the rest of the app by construction.
- **Always-fresh availability/price** — the live-query tool cannot return stale inventory, so the assistant is safe to drive booking handoff.
- **Bounded security surface** — read-only, zod-validated tools that enforce the public gate; no write tool, no raw SQL, no client-supplied SQL. The model output is treated as data, never executed (per `.claude/rules/security.md` AI-layer rules).
- **Incremental** — hybrid vector ranking (content-only) and new clusters (B/D/host) layer on later without reworking the foundation.
- **Cheap to reason about** — cards bypass the token budget; the agent loop is capped (≤4 iterations) with a per-user/day spend cap.

**Negative / risks:**
- The assistant is only as correct as the underlying data — hence the three **prep-data stories must land first**: (1) availability must check `BlockedDate` and return partial capacity ("เหลือ 2/5"); (2) price/fee must match the booking total and a `cancellation policy` field must exist; (3) reviews need a verified-stay gate. Shipping AI on top of these gaps would produce confidently-wrong answers.
- Function calling adds LLM latency per turn (multiple tool round-trips); mitigated by the iteration cap, a cheap pinned model, and a keyword fallback on error.
- **Cost:** every AI turn is a paid OpenRouter call. This is **owner-gated on spend** — no live API call is made until the owner approves at G2. The prep-data stories carry no spend.
- Deferring embeddings means purely-semantic "vibe" queries ("ลานเงียบ ๆ ฟีลดิบ") are answered by keyword/structured matching in v1 and may be weaker until the content-only vector layer is added.

## Links

- Discovery + feature list: the AI-assistant discovery doc (Use-Case → Feature List, clusters A–E, locked scope A+C, prep-first).
- Visual: `docs/design/ai-search-architecture.html`.
- Reuse points: `lib/campsite-filters.ts`, `lib/campsite-availability.ts`, `lib/read-models/camp-card.ts`, `components/CampgroundCard.tsx`.
- Security posture: `.claude/rules/security.md` (AI/agent-layer: untrusted input, no exec of model output, scoped tokens + spend cap).

## Amendment 2026-07-28 (ADR-016) — the amendment below is itself reversed on cluster C

**[ADR-016](ADR-016-camper-direct-booking-and-in-chat-completion.md) reverses the ADR-011 amendment's destination change.** Owner decision 2026-07-28: **cluster C is Book handoff again** — the chat's destination is a `Booking`, not a `HostLead`. Round 1 hands off to the existing booking page **prefilled** and writes nothing from the chat, so:

- The "new dependency: HostOS lead inbox must exist first" below **no longer applies** — the lead inbox is still Backlog (CAM-289), and the chat now targets `POST /api/bookings`, which already exists.
- The guardrail below **still holds, and is the load-bearing part**: the model never performs the write itself; the write is a deterministic code path behind the camper's own explicit confirm.

Everything else in the ADR-011 amendment (the tool layer, no-merge stance, deferred embeddings) is unaffected. The text below is preserved as written on 2026-07-04.

## Amendment 2026-07 (ADR-011)

Superseded in part by the Blueprint v6 pivot (`docs/adr/ADR-011-strategy-pivot-hostos-first.md`): **chat v1 scope is now A (Discover) + C (Inquiry)** — cluster C is no longer "Book handoff." A card's click-through now hands off into an **inquiry form that creates a `HostLead`**, never a `Booking`. This changes the destination of the C-cluster handoff described in this ADR's Context and Decision sections; everything else in this ADR is unchanged and still correct:

- The typed tool layer (`searchCampsites`, `checkAvailability`, `getCampDetail`), the no-merge/no-warehouse decision, and the deferred-embeddings stance are unaffected — retrieval still reads the same normalized tables the same way.
- **New dependency:** the HostOS lead inbox (M1.2, `docs/project/platform-blueprint.md` §3) must exist and accept leads before the C-cluster ships — chat cannot hand off to an inbox that does not yet exist. This reorders `ai-product-roadmap.md`'s AI-1..AI-3 / C1/C2 rows against the new milestone ladder (tracked as a follow-up re-sequencing PR).
- Guardrail: the inquiry handoff is still a **read-only AI path into a write the user/host confirms** — the AI never creates the `HostLead` write itself without the surrounding form/confirmation step, consistent with `.claude/rules/security.md`'s AI-layer rule (model output is data, never auto-executed).
