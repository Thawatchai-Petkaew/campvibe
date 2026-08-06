---
artifact: epic
feature: ai-assistant
epic: in-chat-booking-completion (CAM-695)
status: Backlog
version: v1
updated: 2026-08-06
---
# In-chat booking completes the loop — the camper books without leaving the chat (CAM-695)

> Round 2 of [ADR-016](../../../adr/ADR-016-camper-direct-booking-and-in-chat-completion.md). The design decisions for this round are recorded in **[ADR-018](../../../adr/ADR-018-in-chat-booking-write-path.md)** (CAM-696) — read it before building any story below.

## Why

Round 1 (epic CAM-630) took the camper from a question to a complete booking summary and then handed them off to the camp page with the values prefilled. The last step is the one that converts, and it is the one we still make the camper leave the conversation for. Round 2 closes it: the summary becomes a real confirm, the chat POSTs through the existing deterministic write path, and the camper sees a booking that actually exists.

**KPI:** a camper completes a booking end to end inside the chat panel, and the Booking row's recorded total equals the total shown on the success card exactly (CAM-702's localhost AC verify; CAM-704's e2e proves it in a real browser against the CI seeded DB).

## Scope

**In**

- The summary step gains a real confirm; the chat writes through `POST /api/bookings` via `bookingAPI.create`, with `source:'CHAT'` as a code constant (ADR-018 D1/D2).
- Success, submitting, and failure states — including the `409` rewind and the check-first-then-retry reconcile (ADR-018 D6).
- **Multi-night** stays, priced on the real night count (owner decision 2026-08-06).
- **Per-pitch camps get an in-chat pitch step** rather than a handoff (owner decision 2026-08-06).
- Two live quoting defects that must close before the confirm is real: the per-person price unit (CAM-698) and the hardcoded 1-night summary (CAM-699). See the ordering rule below.
- A guest who taps confirm is asked to log in right there, losing nothing they chose (CAM-703).
- The two items CAM-640 deferred from the CAM-637 brief: the pre-summary live availability check and step-transition focus management (CAM-647).
- Absolute Thai dates (`15 ส.ค.`), which the shipped copy already promises (CAM-645).

**Out**

- **Payment.** Still deferred to M7.5 per ADR-016 §6. A booking created here is `PENDING` with no payment and no host acceptance.
- **Server-side idempotency key.** This round ships a client reconcile heuristic with a stated residual risk → **CAM-706** (schema change, own migration, own G2).
- **The camp-visibility predicate on `POST /api/bookings`.** A hidden or soft-deleted camp is bookable by uuid today → **CAM-705** (found during this round's exploration; see ADR-018 R5 for the sequencing question).
- **Host acceptance / quote / hold.** Epic **CAM-289** still owns the "a `PENDING` booking is a promise the platform cannot enforce" gap (ADR-016 RISK-2, restated as ADR-018 R6).
- **Any model-callable write tool.** Permanently out (ADR-018 D4). The tool registry stays write-free and ADV-40 stays a blocking guardrail case.

## Stories

| # | Ticket | Title | Role | Depends on |
|---|---|---|---|---|
| S1 | CAM-696 | ADR-018 — the chat commits through the existing deterministic write path | architect | — |
| S2 | CAM-697 | Design brief v2 — confirm, success, failure, nights and pitch steps | ux-designer | — |
| S3 | CAM-698 | The chat quotes the price the camp actually charges, per person when it is per person | frontend | — (ship first) |
| S4 | CAM-699 | A camper picks how many nights, and the chat prices the real stay | frontend | S2 |
| S5 | CAM-700 | A camper picks their pitch inside the chat on a per-pitch camp | frontend | S2 |
| S6 | CAM-701 | The booking summary becomes a real confirm, with success and failure states (presentation only) | frontend | S2 |
| S7 | CAM-647 | The chat summary is checked against live availability before it is shown | frontend | S2 |
| S8 | CAM-702 | Tapping confirm books for real — the chat writes the booking and shows the recorded total | frontend | S1, S3, S4, S6 |
| S9 | CAM-703 | A guest who confirms is asked to log in right there, and nothing they chose is lost | frontend | S8 |
| S10 | CAM-704 | Prove in a real browser that a chat booking lands in the database | qa | S5, S8, S9 |
| S11 | CAM-645 | A camper can name an explicit date, not only a relative one | backend | — (fully parallel) |

## Sequencing

**The hard rule (ADR-018 D8): CAM-698 and CAM-699 must land before CAM-702.** The chat currently hardcodes `nights: 1` (`components/ai-chat/booking-view.ts:247`) and passes a null price unit (`components/ai-chat/AiChatDetailCard.tsx:283`), while the write path prices the real nights and the real unit. That divergence is invisible while the chat writes nothing; the moment the confirm is real it becomes *"the number I agreed to is not the number I was charged"* — visible one frame later, because the success card shows the server-recorded total. These two are correctness prerequisites, not parallel improvements.

Everything else follows the dependency column above. CAM-701 lands the view shapes first (presentation only, nothing wires — the CAM-638 pattern), so CAM-702 wires against a settled surface.

## Two-writer schedule

*Derived from the ticket dependency graph plus a file-overlap read of the booking module; the owner's standing rule is max **two** code-writers, in worktrees, over partitioned files.*

The honest finding: **this round parallelises far less than its story count suggests.** CAM-699, CAM-700, CAM-647, CAM-702 and CAM-703 all mutate the same three files — `components/ai-chat/booking-flow.ts`, `components/ai-chat/booking-view.ts`, `components/ai-chat/use-ai-chat.ts` — so they cannot be partitioned against each other. Only two stories are genuinely disjoint.

| Track | Stories | Files | Notes |
|---|---|---|---|
| **A — the booking module (strictly serial)** | CAM-697 → CAM-701 → CAM-699 → CAM-700 → CAM-647 → CAM-702 → CAM-703 → CAM-704 | `components/ai-chat/*`, `locales/translations.json` | One writer at a time. Merges serial. |
| **B — disjoint, runs alongside A** | CAM-698, then CAM-645 | `AiChatDetailCard.tsx` + `lib/read-models/ai-camp-card.ts`; then `lib/ai/date-phrases.ts` | Second writer. CAM-645 touching `lib/ai` fires the real-model CI gate (~USD 0.0064/run). |

Track B holds only two stories; once both land, Track A continues single-writer. Docs-only S1 (CAM-696) and S2 (CAM-697) ran in parallel ahead of both tracks and touch no code files.

> If the CAM-695 planning session recorded a different wave chart, that chart wins over this table — this one is derived from the tickets and the file overlap, not transcribed from the plan.

## Live status

Rollup lives on `/status` + `docs/specs/INDEX.md` (generated by `node scripts/ticket-sync.mjs index`) — not hand-maintained here.

## Links

`../feature.md` · [ADR-018](../../../adr/ADR-018-in-chat-booking-write-path.md) (this round's decisions) · [ADR-016](../../../adr/ADR-016-camper-direct-booking-and-in-chat-completion.md) §5 (the deferred decision point this round answers) · [ADR-005](../../../adr/ADR-005-booking-snapshot.md) · [ADR-006](../../../adr/ADR-006-booking-atomic-inventory-lock.md) · [ADR-014](../../../adr/ADR-014-pricing-unit.md) · round 1 = `../in-chat-guided-booking/` (epic CAM-630) · Master-Plan item (`docs/project/master-plan.md`)

## Changelog

- v1 (2026-08-06) — epic scoped; ADR-018 authored (CAM-696); ordering rule and two-writer tracks recorded.
