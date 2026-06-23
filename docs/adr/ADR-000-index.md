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
| ADR-006 | Soft-delete + audit + classification convention | Planned |
| ADR-007 | ID strategy uuid → cuid | Planned |
| ADR-008 | pgvector / AI embeddings seam (defer) | Planned |

**Cross-cutting (decided in plan, recorded here):** pre-launch → clean breaking migration + DB reset + re-seed (no backfill/expand-contract); "reversible" = tested reset/reseed runbook + prior migration set. Each schema change ships as one atomic story (≤~400 LOC) updating schema + zod + seed + api/components together.
