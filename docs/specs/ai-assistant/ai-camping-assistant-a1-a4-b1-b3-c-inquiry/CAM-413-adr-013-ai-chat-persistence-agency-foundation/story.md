---
linear: CAM-413
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: story
owner: solution-architect
status: In Progress
version: v1
updated: 2026-07-19
---
# ADR-013 — AI chat persistence, agent loop & tiered tools foundation (CAM-413)

## Story
As a **Camper**, I want the delivery team to lock the foundation for a persistent, personalized, agentic AI chat, so that the S2–S10 build stories share one atomic data model, one agent-loop contract, and one identity-safe tool boundary instead of each guessing.
Why: the owner set three locked requirements (personalized · does-more-than-Q&A · persistent history) and asked to lay the structure BEFORE planning more AI experience; a hard-to-reverse call (a persistence model, hard-delete vs soft-delete, an agent-loop spend ceiling) needs a recorded decision + a human tap.
Scope: this is the **G2 design artifact** — it authors ADR-013 (Context · D1–D7 · Alternatives · Consequences + 8 risks · Confirmation checks) + the S1–S10 → CAM-413..423 build map + the ADR-000 index line. **No runtime code, no Prisma migration, no endpoint ships in this story** — those are S2–S10.
Depends on: ADR-009 (no-merge tool layer, availability live — built on, not superseded) · ADR-011 (HostOS-first re-sequencing)

## AC
<!-- This is a decision/spec-lite story: the deliverable IS the ADR. "Then" = what a reader of the repo sees. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The AI-chat foundation has no recorded architecture decision | A team member opens `docs/adr/` | `ADR-013` exists with Status `PROPOSED`, all four house sections (Context · Decision · Alternatives · Consequences), and a `Confirmation:` field naming the tests that fail if a decision is violated | `docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md` committed | AC-2 |
| AC-2 | ADR-013 is authored | A team member reads the Decision section | D1–D7 are each stated with rationale: authed-only persist (guest justification), atomic two-table model, caps+evict, hard-delete+180-day retention (soft-delete divergence note), multi-role loop cap 4 (OWASP excessive-agency + spend), server-bound `userId` with no identity in tool schema, additive `blocks[]`+request-union | Design is unambiguous enough for S2–S10 to build without re-deciding | — (content review; no failure branch) |
| AC-3 | The ADR index lists ADR-001..012 | A team member opens `docs/adr/ADR-000-index.md` | A new row for ADR-013 with status `Proposed (G2)` and the spend + retention tap note | Index row added, linking the file | — (single append; asserted by grep) |
| AC-4 | ADR-013 records hard-to-reverse trade-offs | The owner reviews at G2 | The two human-decision points — **spend** (loop ~2× worst case) and **retention** (180-day hard-delete) — are surfaced explicitly as the G2 tap, not silently chosen | Owner decision recorded on the ticket; Status can flip PROPOSED→ACCEPTED | — (gate artifact; owner-verify) |

## Rules
- BR-1 ADR-013 Status starts `PROPOSED` and flips to `ACCEPTED` only on the owner's G2 tap (or explicit pre-build ratification); it is never edited to a different decision in place — a superseding decision gets a new ADR marking this one `SUPERSEDED` (ADR-000 lifecycle).
- BR-2 The two owner G2 decision points are **spend** (D4 loop ~2× a complex turn, still หลักสตางค์ on the pinned cheap model) and **retention** (D2 180-day hard-delete). Both are stated as trade-offs, never guessed silently.
- BR-3 D2 hard-delete is a **deliberate divergence** from the house `deletedAt` soft-delete convention (PDPA prefers genuine erasure); the divergence is named in the ADR + guarded by the Confirmation no-leak test so a future reader does not "correct" it back.
- BR-4 D5 identity invariant: `ToolContext.userId` is server-bound from the session and appears in NO tool zod schema the model sees — enforced by an invariant test (Confirmation), making cross-user access structurally impossible (not merely checked).

## Edge cases
- EC-1 IF a build story (S2–S10) tries to persist tool traces / raw errors / the system prompt THEN it violates D2 — the model has no such columns and the no-leak Confirmation test goes red (BR-3).
- EC-2 IF `blocks[]` introduces a type an older client does not know THEN the client skips it (never throws); the Wave-1 `{answer, cards, suggestions}` contract + tests stay byte-stable (D6).
- EC-3 IF a chat turn errors or exceeds the 45 s deadline mid-loop THEN nothing is persisted (atomic append happens only after a final prose answer) — no half-answer, no leaked error in `content` (risk 7).

## Data
- New (designed here, migrated in S2 — **not** in this story): `ChatConversation` (id, userId→User cascade, title?, createdAt, updatedAt; `@@index([userId, updatedAt])`, `@@index([updatedAt])`) · `ChatMessage` (id, conversationId→ChatConversation cascade, role `ChatRole{USER,ASSISTANT}`, content [PII], blocks Json?, createdAt; `@@index([conversationId, createdAt])`) · enum `ChatRole` · back-relation `User.chatConversations`.
- migration: **none in this story** (S2 owns the migration — additive two tables + one enum, reversible; hard-delete via `onDelete: Cascade`, no backfill).

## Seams & refs
- Reuse (design points at, does not fork): `lib/ai/openrouter-client.ts` (D4 evolves this loop) · `lib/ai/tools/*` (D5 adds tier + 4 personal tools wrapping already-scoped `lib/bookings.ts`/wishlist/profile queries) · `app/api/ai/chat/route.ts` (D6/D7 add optional auth + persist + envelope) · `prisma/schema.prisma` `User` (owner FK). · Refs: ADR-013 (this) · ADR-009 · ADR-011 · CAM-412 (streaming, D7 seam) — pointers, never implementation.

## Out of scope
- The migration + `conversation-store` → CAM-414 (S2) · agent loop → CAM-415/416 (S3a/S3b) · tools → CAM-417/418/419 (S4/S5) · route v2 + envelope → CAM-420 (S6) · conversation endpoints → CAM-421 (S7) · retention cron → CAM-422 (S8) · UI resume → CAM-423 (S9) · guest-thread merge (S10) + turn idempotency key (risk 4) → follow-up.

## Self-verify
- AC-1..AC-3 → source review (ADR file has 4 sections + Confirmation; index row present) · AC-4 → owner-verify at G2 (spend + retention tap).
- Story-specific: no runtime code / migration in this PR (`git diff` = ADR + index + story.md only); ADR lifecycle status = PROPOSED; the S1–S10 → CAM-413..423 map is present.
- Gate = /quality-gate (docs-only: lint/typecheck unaffected) · Done = ADR + index + story.md committed, PR opened into `dev`, G2 tap on spend + retention.

## Changelog
- v1 (2026-07-19) — created; ADR-013 authored (D1–D7, 8 risks, Confirmation), index row added, build map S1–S10 → CAM-413..423.
