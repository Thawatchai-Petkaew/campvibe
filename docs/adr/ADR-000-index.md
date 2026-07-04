# Architecture Decision Records — Index

ADRs record decisions that are hard to reverse or carry significant trade-offs (per `.claude/rules/architecture.md`). Format: **Context · Decision · Alternatives · Consequences**. New ADRs SHOULD also carry a MADR-style `Confirmation:` field (the CI check/test that fails if the decision is violated) — see `.claude/templates/tech.md`.

These ADRs were originally raised as the **G2 design artifact** for the epic *"Atomic Schema · data model → Atomic-Data Framework + international standards"* (Linear CAM-96; plan `option-2-virtual-cosmos.md`, G1 approved). Most have since shipped to staging and are flipped to **Accepted** below (2026-07-04 hygiene pass) — the "pending G2 human sign-off" note applied when this index was first written, not to the current state of ADR-002..007/010.

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](ADR-001-i18n-storage.md) | Localized content storage (Translation table) | Proposed (G2) — verified NOT shipped, see file note |
| [ADR-002](ADR-002-money-decimal-currency.md) | Money = Decimal + ISO-4217 currency; FX read-time | Accepted |
| [ADR-003](ADR-003-enum-vs-masterdata.md) | Closed Prisma enum vs open MasterData boundary | Accepted |
| [ADR-004](ADR-004-multi-region-location.md) | Multi-country location: Country + AdminArea tree | Accepted |
| [ADR-005](ADR-005-booking-snapshot.md) | Booking snapshot (crystallization) scope | Accepted |
| [ADR-006](ADR-006-booking-atomic-inventory-lock.md) | Booking atomic inventory lock: serializable isolation with bounded retry (CAM-57) | Accepted |
| [ADR-007](ADR-007-strict-csp-nonce-nextauth.md) | Strict nonce-based CSP composition with NextAuth v5 middleware (CAM-203) | Accepted |
| [ADR-008](ADR-008-google-oauth-jwt-upsert.md) | Google OAuth login — JWT-only upsert (no adapter), link-by-email (CAM-234) | Accepted |
| [ADR-009](ADR-009-ai-assistant-data-architecture.md) | AI Camping Assistant: no-merge tool layer over normalized DB; availability live; embeddings deferred/content-only; chat v1 = A+C (AI Camping Assistant epic) | Proposed (G2) — verified NOT shipped, see file note |
| [ADR-010](ADR-010-self-hosted-delivery-tickets.md) | Self-hosted delivery tickets: separate `prisma/delivery/schema.prisma` + own DB, validated state machine (BACKLOG→TODO→IN_PROGRESS→AWAITING_GATE→DONE + CANCELED/reopen), atomic columns replacing label/title hacks (Self-hosted Delivery Tickets epic, CAM-276/CAM-277) | Accepted |
| [ADR-011](ADR-011-strategy-pivot-hostos-first.md) | Strategy pivot: HostOS-first, public booking/payment deferred behind a BookingReadinessGate re-entry criterion (Platform Blueprint v6 pivot) | Accepted |
| [ADR-012](ADR-012-hostos-data-model.md) | HostOS core data model: `HostLead`/`LeadConversation`/`Quote`+`QuoteLine`/`InternalHold`/`DepositRecord` + `Booking(source=MANUAL)` for ManualStay, in the product schema (Blueprint v6 HostOS core, M1.2) | Accepted |

**Cross-cutting (decided in plan, recorded here):** pre-launch → clean breaking migration + DB reset + re-seed (no backfill/expand-contract); "reversible" = tested reset/reseed runbook + prior migration set. Each schema change ships as one atomic story (≤~400 LOC) updating schema + zod + seed + api/components together.
