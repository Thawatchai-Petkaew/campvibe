# ADR-016: Campers book directly; the assistant completes the booking in chat (CAM-631)

Status: Accepted — owner-ratified in chat 2026-07-28 · **Epic:** CAM-630 (In-chat guided booking) · **Supersedes in part:** ADR-011 (BookingReadinessGate as a camper-CTA gate) · **§5 decided 2026-08-06 by [ADR-018](ADR-018-in-chat-booking-write-path.md)** (CAM-696, epic CAM-695 — see the dated note in §5; nothing here is retracted)

## Context

Asked whether booking should still be built through the AI chat, the owner decided on 2026-07-28: **booking completes inside the chat** is the destination. Round 1 ships a guided flow (dates → party size → summary) that hands off to the existing camp booking page **prefilled**; the chat writes nothing itself in round 1.

That decision collides with three documents that currently disagree with each other and with the code:

1. `docs/project/platform-blueprint.md` §4 guardrail **2** — "AI ไม่เขียนเงิน/availability โดยไม่ผ่าน host ยืนยัน" — and guardrail **4** — until a campsite passes `BookingReadinessGate`, every book-like CTA must read สอบถาม/ขอราคา/ส่งคำขอ.
2. `docs/adr/ADR-011-strategy-pivot-hostos-first.md` — defers public booking to M7.5 behind that same gate.
3. `docs/research/ai-chat/campvibe-conversation-to-booking-research.md` §3–4 — "booking = state machine ใน code, LLM เป็นคน 'คุย' ไม่ใช่คน 'ถือเงิน'"; its tool contract exposes only `createBookingDraft(...) → deep-link prefilled (ไม่ write จริง)`.

### What the code actually does today (verified 2026-07-28, load-bearing)

These four facts are the reason this ADR ratifies reality rather than changing behaviour. Each was grepped in this repo, not recalled:

- **`BookingReadinessGate` does not exist in code.** `readiness|canBook|bookingEnabled|isBookable` across `*.ts|*.tsx|*.prisma` returns hits only in `docs/` and in an unrelated 3D-renderer readiness flag (`app/status/map/campsite-scene.tsx`). There is no per-campsite flag of any kind gating the camper CTA. **The guardrail has been documented and unenforced since the day it was written.**
- **Direct camper booking already works today, and always has.** `components/CampgroundDetailClient.tsx:1412` renders `t.common.reserve` = `จอง` → `POST /api/bookings` → a real `PENDING` Booking (`app/api/bookings/route.ts:165`) → a confirmation page headed `การจองสำเร็จแล้ว` with a `ยอดชำระทั้งหมด` row.
- **No payment exists anywhere.** `prisma.payment` / `prisma.payout` have zero call sites; `PAID` is unwritable through the API — `app/api/bookings/[id]/route.ts:11-20` deliberately excludes it from the PATCH allowlist.
- **The host is never told.** `lib/email/templates.ts` defines `bookingConfirmationEmail` (:87), `bookingCancelledEmail` (:121) and the host new-booking notification (:140); **nothing outside `__tests__/` calls any of them.**

So the platform has been letting campers book directly the whole time, with no payment, no host acceptance, and no host notification — while three documents said otherwise. This ADR closes that gap in the documents' direction, and names the real hole the code has (host notification) instead of leaving it implied.

## Decision

**1. Campers book directly. No `BookingReadinessGate` on the camper CTA.**
The camper-facing `จอง` CTA and `POST /api/bookings` stay as they are. Booking is not gated per campsite.

**2. Guardrail 4 (CTA wording rule) is RETIRED.**
The rule required every book-like CTA to read สอบถาม/ขอราคา/ส่งคำขอ until a campsite passed the gate. It was never enforced in code and the gate it depends on was never built. Retiring it **ratifies the behaviour that has always shipped**; it changes no runtime behaviour. Recorded here so the retirement is a decision, not a silent drift.

**3. Guardrail 2 (AI never writes money/availability) is NARROWED, not dropped.**
What survives, and becomes the binding rule for every booking path including the chat:

> **The model never writes money or availability.** The write stays a deterministic code path, triggered by the camper's own explicit final confirm. The research doc's `confirm จริง = โค้ด ไม่ใช่โมเดล` survives intact.

What changes, stated plainly: **a *host* confirmation is no longer required for a camper booking.** The original guardrail bundled two different things — "the model must not commit a write" (kept, and it is the load-bearing half) and "a human host must approve first" (dropped for the camper booking path). The HostOS-side guardrails 1 and 3 are untouched: AI still never auto-publishes a host's map, and ledger/availability/state-transition/daily-close math stays deterministic.

**4. Round 1 writes nothing from the chat.**
The assistant collects dates and party size, shows a summary, and hands off to the existing booking page prefilled. No new write path, no new endpoint, no schema change. This is exactly the research doc's `createBookingDraft(...) → deep-link prefilled (ไม่ write จริง)` contract.

**5. Committing the booking inside the chat is a LATER decision point, not decided here.**
When round 2 is proposed it needs its own ADR covering at minimum: which deterministic code path performs the write, what the camper's explicit final confirm looks like, and how availability is re-checked at confirm time.

> **DECIDED 2026-08-06 by [ADR-018](ADR-018-in-chat-booking-write-path.md)** (story CAM-696, epic CAM-695 — round 2). All three questions this paragraph asked are answered there:
>
> - **Which deterministic code path performs the write** — the existing `POST /api/bookings`, reached through the `bookingAPI.create` facade (`lib/api-client.ts:106`) with `source:'CHAT'` as a code constant at that call site. No new endpoint, no schema change, no migration (ADR-018 D1).
> - **What the explicit final confirm looks like** — the camper's own tap on ยืนยันการจอง on the summary step. Typed text never submits, and after a login the button re-labels but **never** auto-submits (ADR-018 D2).
> - **How availability is re-checked at confirm time** — by the Serializable transaction inside `POST /api/bookings` itself (`app/api/bookings/route.ts:60`–`:263`). The pre-summary live check (CAM-647) is the UX layer above it; a third GET between the tap and the POST is explicitly rejected (ADR-018 D3).
>
> ADR-018 additionally records three things this paragraph did not anticipate: the model's write-free relationship is unchanged and permanent (D4), booking blocks stay out of model history and are never restored (D5), and idempotency ships this round as a client reconcile heuristic with its residual risk stated (D6 — the server-side key is CAM-706).
>
> **Nothing above is retracted.** This paragraph stands as the record of what was deferred, and when.

**6. What is still deferred to M7.5 is PAYMENT, not booking.**
`BookingReadinessGate` remains meaningful for the payment/checkout re-entry decision (ADR-011's actual economic argument — refund/dispute/payout/fraud ops). It is retired only as a gate on the camper booking CTA. Documents that say "public booking/payment deferred" now read "public **payment** deferred".

## Alternatives considered

### (a) Keep guardrail 4 and actually build `BookingReadinessGate`
Add a per-campsite readiness flag and flip every camper CTA to สอบถาม/ขอราคา until a campsite passes. **Rejected:** it would *remove* a capability that has shipped and worked since M0, in service of a rule that was never enforced, and it routes campers into a HostOS lead inbox that is itself not built yet (epic CAM-289, Backlog). It buys a consistency that costs the only working conversion path on the site.

### (b) Chat commits the booking directly in round 1
Let the assistant call a write tool and create the Booking at the end of the conversation. **Rejected for round 1:** it puts the first camper-facing write behind a model turn before any deterministic confirm-and-re-check path exists, and the handoff-to-prefilled-page option delivers the same user outcome with zero new write surface. Revisit as decision point 5 above.

### (c) Route the chat into an inquiry/HostLead instead of a booking (the ADR-011/ai-product-roadmap C1 shape)
Keep the assistant on Discover→Inquiry and hand off to a lead. **Rejected:** the lead inbox does not exist yet (CAM-289 Backlog), so this hands campers to a dead end today, and it contradicts the owner's stated destination (booking completes in chat).

## Consequences

**Positive:**
- The documents now match the code. A reader of `platform-blueprint.md` no longer designs around a gate that does not exist.
- Round 1 needs no schema change, no new endpoint, and no new write path — it reuses `POST /api/bookings` through the existing page.
- The half of guardrail 2 that actually protects correctness (the model never commits the write) is now stated as a standalone binding rule instead of being tangled with a host-approval requirement.

**Negative / risks — named, not softened:**

- **RISK-1 (top follow-up): hosts currently receive no signal that a booking happened.** The host-notify template exists and is called by nothing outside tests. Shipping *more* paths into an unnotified booking makes this gap worse, not better — a chat handoff plausibly increases booking volume against a notification path that is wired to nowhere. **This is the top follow-up and should be closed before or alongside round 1 ships**, not after. Not currently ticketed.
- **RISK-2: a `PENDING` booking with no payment and no host acceptance is a promise the platform cannot keep.** A camper sees `การจองสำเร็จแล้ว` and a `ยอดชำระทั้งหมด` total; nothing behind that screen obliges the host to honour it or the camper to pay. The side expected to close this is the **HostOS lead/quote/hold flow (epic CAM-289, `Backlog`)** — where the host accepts, quotes, and records a deposit. **It remains open.** This ADR does not close it and does not claim to.
- **RISK-3: `PENDING` has no defined expiry or reconciliation.** With no payment and no acceptance, nothing ages out an abandoned `PENDING` row. Not measured (no production booking volume data reviewed for this ADR).
- ADR-011's strategic argument survives on payment; only its camper-CTA gating is superseded. Anyone reading ADR-011 alone will get the retired rule — hence the dated superseded-in-part note added to it in this same PR.
- Guardrail count in `platform-blueprint.md` §4 stays at 4 entries, but entry 4 is now a retirement record rather than an active rule. A future reader must not re-derive the retired rule from the numbering.

## Confirmation

There is no CI check that can prove this decision, because the decision is mostly the *removal* of a rule that was never mechanized. What can be checked:

- `grep -rniE "สอบถาม/ขอราคา" docs/project/platform-blueprint.md` returns no surviving unqualified instruction (only text that points at this ADR).
- `grep -rn "BookingReadinessGate" docs/` returns only hits that are payment-scoped, historical, or point at this ADR.
- The camper CTA stays `จอง` (`common.reserve` in `locales/translations.json`) — a change back to สอบถาม/ขอราคา would contradict this ADR.

## Links

- `docs/project/platform-blueprint.md` §1 · §3 (M7.5) · §4 guardrails 2 and 4 — amended in this PR.
- `docs/adr/ADR-011-strategy-pivot-hostos-first.md` — superseded in part (dated note added in this PR).
- `docs/research/ai-chat/campvibe-conversation-to-booking-research.md` §3–4 — the `createBookingDraft` contract round 1 implements, and the `confirm จริง = โค้ด ไม่ใช่โมเดล` rule this ADR makes binding.
- Epic **CAM-630** (In-chat guided booking) · story **CAM-631** (this record) · epic **CAM-289** (HostOS Leads & Quotes — owns RISK-2).
- `docs/adr/ADR-005-booking-snapshot.md`, `docs/adr/ADR-006-booking-atomic-inventory-lock.md` — no longer dormant on the camper path; they govern the booking this ADR keeps live.
