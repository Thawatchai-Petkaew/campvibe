# Architecture Decision Records — Index

ADRs record decisions that are hard to reverse or carry significant trade-offs (per `.claude/rules/architecture.md`). Format: **Context · Decision · Alternatives · Consequences**.

These ADRs are the **G2 design artifact** for the epic *"Atomic Schema · data model → Atomic-Data Framework + international standards"* (Linear CAM-96; plan `option-2-virtual-cosmos.md`, G1 approved). They are **Proposed — pending G2 human sign-off**; no migration is written until they are approved.

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](ADR-001-i18n-storage.md) | Localized content storage (Translation table) | Proposed (G2) |
| [ADR-002](ADR-002-money-decimal-currency.md) | Money = Decimal + ISO-4217 currency; FX read-time | Proposed (G2) |
| [ADR-003](ADR-003-enum-vs-masterdata.md) | Closed Prisma enum vs open MasterData boundary | Proposed (G2) |
| [ADR-004](ADR-004-multi-region-location.md) | Multi-country location: Country + AdminArea tree | Proposed (G2) |
| [ADR-005](ADR-005-booking-snapshot.md) | Booking snapshot (crystallization) scope | Proposed (G2) |
| [ADR-006](ADR-006-booking-atomic-inventory-lock.md) | Booking atomic inventory lock: serializable isolation with bounded retry (CAM-57) | Proposed (G2) |
| [ADR-007](ADR-007-strict-csp-nonce-nextauth.md) | Strict nonce-based CSP composition with NextAuth v5 middleware (CAM-203) | Proposed (G2) |
| [ADR-008](ADR-008-google-oauth-jwt-upsert.md) | Google OAuth login — JWT-only upsert (no adapter), link-by-email (CAM-234) | Accepted |
| [ADR-009](ADR-009-ai-assistant-data-architecture.md) | AI Camping Assistant: no-merge tool layer over normalized DB; availability live; embeddings deferred/content-only; chat v1 = A+C (AI Camping Assistant epic) | Proposed (G2) |
| [ADR-010](ADR-010-self-hosted-delivery-tickets.md) | Self-hosted delivery tickets: separate `prisma/delivery/schema.prisma` + own DB, validated state machine (BACKLOG→TODO→IN_PROGRESS→AWAITING_GATE→DONE + CANCELED/reopen), atomic columns replacing label/title hacks (Self-hosted Delivery Tickets epic, CAM-276/CAM-277) | Proposed (G2) |
| [ADR-011](ADR-011-strategy-pivot-hostos-first.md) | Strategy pivot: HostOS-first, public booking/payment deferred behind a BookingReadinessGate re-entry criterion (Platform Blueprint v6 pivot) | Proposed (G1) |
| [ADR-012](ADR-012-hostos-data-model.md) | HostOS core data model: `HostLead`/`LeadConversation`/`Quote`+`QuoteLine`/`InternalHold`/`DepositRecord` + `Booking(source=MANUAL)` for ManualStay, in the product schema (Blueprint v6 HostOS core, M1.2) | Proposed — pending G2 |

**Cross-cutting (decided in plan, recorded here):** pre-launch → clean breaking migration + DB reset + re-seed (no backfill/expand-contract); "reversible" = tested reset/reseed runbook + prior migration set. Each schema change ships as one atomic story (≤~400 LOC) updating schema + zod + seed + api/components together.
