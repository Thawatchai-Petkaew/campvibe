---
ticket: CAM-631
epic: CAM-630 — In-chat guided booking
feature: AI Assistant
status: In Progress
version: 1
---

## Story

As an **Admin**, I want the booking direction recorded as an ADR and every contradicting document reconciled with it, so that the next agent designing in-chat booking reads one consistent instruction instead of three documents that disagree with each other and with the code.
Why: three documents (platform-blueprint §4, ADR-011, the conversation-to-booking research) currently give conflicting instructions, and the guardrail they all cite was never enforced in code. `.claude/rules/ops.md` records the scar — a policy change that updated one file left CLAUDE.md contradicting it two promotes later.
Scope: docs only. ADR-016 + the amendments/cascade + this spec. No code, no schema, no behaviour change.
Depends on: owner decision in chat 2026-07-28 · epic CAM-630

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The decision is unrecorded and three docs disagree | An agent reads `docs/adr/ADR-016-…md` | — (no user-facing UI in this story; docs only) | ADR-016 exists with Context · Decision · Alternatives · Consequences · Confirmation, states guardrail 4 retired and guardrail 2 narrowed, and cites the four verified code facts | EC-1 |
| AC-2 | ADR-011 states the retired CTA rule as current instruction | An agent reads ADR-011 | — | ADR-011 carries a dated superseded-in-part note at the top naming exactly which bullets no longer hold | EC-2 |
| AC-3 | `platform-blueprint.md` §4 guardrails 2 and 4 state the retired rule | An agent reads §1/§3/§4 | — | Guardrail 4 is struck through and marked retired; guardrail 2 is narrowed in place; both point at ADR-016; §1 and §3 M7.5 say payment (not booking) is what is deferred | EC-3 |
| AC-4 | Other docs restate the retired wording | `grep -rn "BookingReadinessGate" docs/` runs | — | Every hit is payment-scoped, historical, or points at ADR-016 | EC-4 |
| AC-5 | `docs/adr/ADR-000-index.md` lists ADRs | An agent reads the index | — | ADR-016 has a row; ADR-011's row is marked superseded in part with a link | — (index has one row per ADR; a missing row is AC-5 failing, not a separate edge) |

## Rules

- BR-1 Guardrail 4 (CTA wording) is **retired**, and the retirement records that it was never enforced in code — so it ratifies shipped behaviour rather than changing it (proves AC-1, AC-3).
- BR-2 Guardrail 2 is **narrowed, not dropped**: the model never writes money or availability; the write is a deterministic code path on the camper's own explicit final confirm. A **host** confirmation is no longer required for a camper booking (proves AC-1, AC-3).
- BR-3 `BookingReadinessGate` still governs **payment/checkout** re-entry at M7.5. It no longer gates the camper booking CTA (proves AC-3, AC-4).
- BR-4 Round 1 of in-chat booking writes nothing from the chat — guided flow then handoff to the existing booking page prefilled. Committing the booking in chat is a later decision needing its own ADR (proves AC-1).
- BR-5 No file under `app/ lib/ components/ prisma/ scripts/` may be touched by this story.

## Edge cases

- EC-1 IF a reader takes ADR-016 as changing runtime behaviour THEN the ADR must state explicitly that no code changes and that direct booking already shipped (BR-1)
- EC-2 IF a reader opens ADR-011 alone THEN the superseded-in-part note must appear above the Context section, not buried in Consequences (BR-1)
- EC-3 IF a reader re-derives the retired rule from guardrail numbering THEN §4 entry 4 must say in words that it is a retirement record, not an active rule (BR-1)
- EC-4 IF a generated artifact (`docs/specs/INDEX.md`) still shows the old epic title THEN it is left alone — it is generated from the ticket DB, and hand-editing it would be overwritten by the next `ticket-sync.mjs index` (BR-5)
- EC-5 IF an amendment softens RISK-1 (hosts get no booking signal) or RISK-2 (unpayable, unaccepted `PENDING`) THEN the ADR fails its own purpose — both are stated plainly and RISK-2 names CAM-289 as the side expected to close it, still open (BR-2)

## Data

- No entity, field, or migration. Docs only · migration: none

## Seams & refs

- Reuse: `docs/adr/ADR-011-strategy-pivot-hostos-first.md` (amended in place, not rewritten) · `docs/project/platform-blueprint.md` (SoT for the guardrails) · Refs: ADR-016, ADR-009 (Amendment 2026-07-28), ADR-012 (note)
- Grep inventory of the retired wording, all reconciled in this PR: `platform-blueprint.md` §1/§2/§3/§4/§6 · `master-plan.md` · `product-strategy.md` · `product-plan.md` · `user-research.md` · `ai-product-roadmap.md` · `design/platform-master-plan.html` · `ADR-009` · `ADR-011` · `ADR-012`. NO-CHANGE: `docs/specs/INDEX.md` (generated), `business.md` (payment-scoped, still true), per-story specs under `docs/specs/**` (historical AC, not instruction).

## Out of scope

- Building the in-chat guided flow → epic CAM-630 round 1
- Committing the booking from inside the chat → later ADR (ADR-016 decision point 5)
- Wiring the host booking notification (ADR-016 RISK-1) → not ticketed; named as the top follow-up
- Closing the unpayable/unaccepted `PENDING` gap (ADR-016 RISK-2) → epic CAM-289
- Renaming the `/status` board lane "Booking Engine (Gated)" → ticket-DB change, not a docs change

## Self-verify

- AC-1..5 → owner-verify (docs review) + the greps in ADR-016 `## Confirmation`
- Story-specific: `git diff origin/dev --name-only` shows zero files under `app/ lib/ components/ prisma/ scripts/`
- Gate = /quality-gate (docs-only diff) · Done = ADR-016 read and approved by the owner

## Changelog

- v1 (2026-07-28) — created; records the owner's 2026-07-28 in-chat booking-direction decision
