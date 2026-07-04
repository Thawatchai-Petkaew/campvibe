# ADR-011 — Strategy pivot: HostOS-first, public booking/payment deferred

**Status:** PROPOSED — ratified when this PR merges (G1) · **Epic:** Platform Blueprint v6 pivot · **Date:** 2026-07-04

## Context

Owner research ("Platform Blueprint v6") re-examined CampVibe's launch shape. Today's codebase confirms the platform has been a marketplace by construction — `CampSite`/`Spot`/`Booking`/`Review` exist and work — but **no payment gateway exists anywhere in the codebase**: a `Booking` row is created with no money movement attached. That is consistent by design (nothing was ever wired to charge a card), not an oversight, but it also means CampVibe has never actually operated as a real payment marketplace.

Two facts drove the pivot:

1. **Ops burden precedes proof.** A public booking marketplace requires payment, refund, dispute, payout, and fraud/trust operations before supply (hosts) or demand (campers) at scale is proven. Building that layer now is monetization-first, adoption-second — backwards for a pre-launch product with no revenue yet.
2. **The real competitor today is LINE/Facebook + a notebook.** Hosts currently run leads and stays manually through chat apps and paper/spreadsheets. A back-office (HostOS) that replaces that pain delivers seller value **without the platform ever touching money**, and is a smaller, safer first cut than a two-sided payment marketplace.

## Decision

**Pivot to HostOS-first. Defer public booking/payment from initial launch entirely; re-enter it only through a named re-entry gate, decided per campsite.**

- **Launch funnel:** Discover → Inquiry/Quote → Host Lead Inbox → Quote → Manual Hold → Deposit Record → Manual Stay → POS/Rental → Daily Close. The host handles money; the platform is ledger/workflow only.
- **8 product layers + milestone ladder M0–M8** — full detail lives in the new SoT `docs/project/platform-blueprint.md`; this ADR does not duplicate the ladder, it records why the shape changed.
- **BookingReadinessGate (M7.5 re-entry criterion, owner decides per campsite):** HostOS daily-active adoption ≥ target · map/zone/pitch completeness ≥ target · double-hold incidents = 0 · cancellation/refund policy complete · support playbook + audit trail ready. Until a campsite passes, every "จอง"-looking CTA reads สอบถาม/ขอราคา/ส่งคำขอ instead.
- **Deterministic core vs AI-assist layer:** ledger, availability, state transitions, and daily-close math are deterministic code paths; AI only drafts/summarizes/suggests and never commits a money or availability change on its own.
- **4 guardrails (verbatim intent, apply to every milestone):**
  1. AI never auto-publishes a map — host confirms every AI draft before publish.
  2. AI never writes money/availability without host confirmation.
  3. Deterministic core vs AI-assist layer stays split (above).
  4. CTA wording rule — no "จอง"-looking CTA on an ungated campsite; use สอบถาม/ขอราคา/ส่งคำขอ.
- **KPI shift:** north-star moves from bookings/month + search→book conversion to **confirmed stays/เดือน** + qualified inquiries, with lead→close rate, host DAU/WAU, and ledger accuracy as new input metrics; double-hold = 0 and ledger mismatch = 0 as new guardrails (existing CWV + security guardrails unchanged). Full table: `platform-blueprint.md` §5.
- **Revenue direction (PROPOSED, owner confirms in `business.md`):** primary = HostOS SaaS + POS module fees + AI credits; secondary = affiliate/sponsored; booking commission only activates at M7.5+.

## Alternatives considered

### (a) Ship payment now (old `product-plan.md` option จ)

Build the payment/checkout flow as part of initial launch. **Rejected:** this forces the platform to own refund, dispute, payout, and fraud/trust operations before supply or demand is proven — a large, premature ops and compliance burden for a pre-launch product with zero hosts on daily-active HostOS usage. It also forces a monetization decision (commission rate) before the core value proposition (does HostOS/back-office actually replace LINE+notebook for a real host?) is validated.

### (b) Hybrid instant-book for a select subset of camps

Keep the marketplace booking flow for a curated set of "trusted" camps, while HostOS rolls out for the rest. **Rejected for now:** it carries the same payment/refund/dispute ops burden as (a) for the instant-book subset, and it splits the funnel — some camps say "จอง", some say "สอบถาม" — which confuses camper trust and doubles the CTA/state surface QA must cover. **Revisit at M7.5**: once BookingReadinessGate exists and a first campsite can pass it, hybrid becomes exactly what M7.5 already re-enables, per campsite, with a real checklist instead of a curated guess.

## Consequences

**Positive:**
- No premature payment/refund/dispute/payout surface to secure, staff, or support — a materially smaller trust-and-safety perimeter for launch.
- HostOS delivers standalone seller value (replaces LINE/FB + notebook) independent of whether public booking ever launches broadly.
- A named re-entry gate (BookingReadinessGate) makes "when do we turn booking back on" a checklist, not a debate, and lets the decision be made **per campsite** rather than as an all-or-nothing platform flip.

**Negative / risks:**
- **KPI/north-star changes** — `master-plan.md` and `product-strategy.md` north-star markers move from booking-count to confirmed-stays; any historical booking-count tracking is no longer the primary signal.
- **ADR-005 (Booking snapshot) and ADR-006 (atomic inventory lock) remain valid but dormant** — the `Booking` model and its serializable-isolation lock still exist in the schema and are still correct engineering for the day booking reopens at M7.5; they are simply off the critical path until then.
- **ADR-009 (AI Assistant data architecture) is amended** (see ADR-009 `## Amendment 2026-07`): chat v1 cluster **C** changes scope from "Book handoff" to "**Inquiry** handoff" — cards now hand off into a `HostLead`, not a `Booking`. This changes the AI-1..AI-3 / C1/C2 rows in `ai-product-roadmap.md`, which must be re-sequenced against the new milestone ladder in a follow-up PR.
- **Old payment-shaped backlog items defer to the M7.5 epic** — anything in `product-plan.md` framed as "payment/escrow" is superseded by the BookingReadinessGate criteria in `platform-blueprint.md` §3, not deleted from history.
- **The existing reserve-flow foundation (no payment) stays as an internal building block**, not a shipped camper-facing feature — it underpins the M1/M1.2 hold-record and manual-stay flows rather than a public checkout.

## Links

- `docs/project/platform-blueprint.md` — the SoT for the 8 layers + milestone ladder + BookingReadinessGate criteria this ADR ratifies.
- `docs/project/master-plan.md`, `docs/project/product-strategy.md` — vision/mission/KPI and gate-criteria updates that cascade from this decision.
- `docs/adr/ADR-009-ai-assistant-data-architecture.md` — amended (`## Amendment 2026-07 (ADR-011)`) for the Discover→Inquiry scope change.
- `docs/adr/ADR-005-booking-snapshot.md`, `docs/adr/ADR-006-booking-atomic-inventory-lock.md` — remain valid, dormant until M7.5.
- `docs/project/ai-product-roadmap.md`, `docs/project/product-plan.md` — feature-backlog detail to re-sequence in a follow-up PR (PR-B/C/D).
