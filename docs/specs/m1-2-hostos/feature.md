---
artifact: feature
feature: m1-2-hostos (M1.2 HostOS)
personas: [host]
status: active
version: v2
updated: 2026-08-06
---
# M1.2 HostOS

## Overview

The back-office a Thai camp host actually runs the camp from: leads that arrive over LINE / Facebook / phone / walk-in, quotes, holds, deposits, stays, and a daily close — as one deterministic ledger rather than a notebook and a group chat. ↑ Master-Plan: `docs/project/master-plan.md` (HostOS-first is strategic pillar 3) · Blueprint: `docs/project/platform-blueprint.md` §2–3, exit criterion "host closes lead → stay → daily close as a full loop **without needing the AI parser**".

Economic stance, load-bearing for every model here: **the host handles the money; the platform is a ledger and workflow layer only.** No gateway custody in this feature.

**State as of 2026-08-06 (verified by reading the repo, not by reading the plan):** 12 stories across two epics, 1 done. The only thing ADR-012 actually shipped is `InternalHold`, and as a reduced slice — `prisma/schema.prisma:911-915` records that its `leadId`/`quoteId`/`bookingId` FKs were deliberately omitted, which leaves `HoldStatus.CONVERTED` (`:921`) unreachable. `HostLead`, `LeadConversation`, `Quote`, `QuoteLine`, `DepositRecord` and the ManualStay extension do not exist.

## Architecture overview

- **Entities today:** `InternalHold` (shipped, reduced) linking to `CampSite`, `Spot`, `User`. Everything else in ADR-012 is spec only.
- **Entities in the first slice (CAM-313):** no new table. `Booking` gains `guestName`/`guestContact` (`[PII]`, the walk-in's identity, which has no upstream Set to link to), `origin` (`enum BookingOrigin`, who the counterparty is), and a nullable `userId`. Detail: `docs/adr/ADR-017-*.md` and `.../CAM-313-*/tech.md`.
- **Entities later, in sequence:** `HostLead` + `LeadConversation` (adds `Booking.leadId`) → `DepositRecord` (+ `Image.depositRecordId`) → `Quote` + `QuoteLine` (+ the three deferred `InternalHold` FKs). All additive; nothing in the first slice forecloses any of them.
- **The one seam everything must go through:** `lib/campsite-availability.ts` is the single answer to "how much room is left". It has **five** readers (`:214` daily · `:514` batched catalog/AI · `:996` write gate · `:818` per-pitch read · `:921` per-pitch write gate), and **none of them filters on who created a booking** — they filter on `status` alone. That is why a host-recorded stay lands in `Booking` rather than a new table: it is counted by all five with zero code changed. Adding a sixth inventory source to that function is the failure mode that has already produced CAM-190, CAM-267, CAM-400 and CAM-665.
- **Concurrency:** one pattern, already implemented twice — `Serializable` transaction + bounded `P2034` retry (3 attempts, 50/100/150 ms). Templates: `app/api/campsites/[id]/holds/route.ts:43`, `app/api/bookings/route.ts:51`. Never invent a second one.
- **API surface:** `POST|GET /api/campsites/[id]/holds` (shipped) · `POST /api/campsites/[id]/stays` (first slice) · `/api/hostos/leads`, `/api/hostos/quotes/[shareToken]` (later, ADR-012 §1/§3).
- **ADRs:** [ADR-011](../../adr/ADR-011-strategy-pivot-hostos-first.md) (the pivot) · [ADR-012](../../adr/ADR-012-hostos-data-model.md) (the model set — §6 superseded in part) · [ADR-017](../../adr/ADR-017-host-recorded-stay-and-booking-discriminator.md) (host-recorded stays + the discriminator) · [ADR-005](../../adr/ADR-005-booking-snapshot.md) · [ADR-006](../../adr/ADR-006-booking-atomic-inventory-lock.md) · schema: `prisma/schema.prisma`

## Design overview

Host-facing only in the first slice, and deliberately **no new screen**: the record-a-stay form and the resulting row live on the existing `/dashboard/bookings` page and the existing host month calendar (CAM-55). Reuse the existing dashboard shell, `components/ui/*` primitives and `DESIGN.md` tokens; a new screen is a G2 conversation for the lead inbox (CAM-307), not for this. The guest-facing surface in this feature is one public inquiry form (CAM-308), later.

## Appetite

2 owner review-rounds for the first slice (G1 on this Discovery plus ADR-017's open trade-offs; G3 on the build packet). G2 is expected to be standard-class for CAM-313 (no new screen, no new token). Blowing the appetite means cutting the slice further — the named split point is the form UI — not extending it.

## No-gos

- No payment gateway and no platform money custody, anywhere in M1.2. A deposit is a bookkeeping record of what the host says they received.
- No AI in the deterministic core. Ledger, availability, state transitions and daily-close arithmetic never depend on a model (Blueprint guardrail 3). The AI lead parser (CAM-314) is the **last** item and is spend-gated.
- No cron / scheduled-job infrastructure. Expiry stays lazy at read time (ADR-012 §4) until a real complaint says otherwise.
- No `GuestProfile` / cross-visit guest recognition (ADR-012 §7, still deferred).
- No new inventory-counting source. Anything that occupies nights goes through `lib/campsite-availability.ts` or it does not ship.

## Discovery — 6-dimension gap list (CAM-686, 2026-08-06)

🟢 closed · 🟡 assumed, default stated, overturnable at G1 · 🔴 owner must decide (all 🔴 are batched at the end; none are spread through the specs)

**Business**

- 🟢 B1 — The first slice's value is a correctness fix, not a convenience: today a host who sold three pitches over LINE can express it only as a `BlockedDate` (no guest, no money, no head count) or an `InternalHold` (temporary, expires). The public availability a camper sees therefore overstates the camp. Recording the stay is the only thing that makes the platform's differentiating number true.
- 🔴 B2 — **Sequence: stay-ledger-first (OS7) or lead-inbox-first (OS1)?** Recommendation and full argument in Q1 below and ADR-017 Alternatives (d).
- 🟡 B3 — KPI for the slice. No baseline exists for how many stays are sold off-platform. Default: ship with no numeric target; instrument the count of host-recorded stays per week and set a target after 4 weeks of real data. Anything else would be a fabricated metric.

**Functional**

- 🟢 F1 — First slice = create one host-recorded stay, and see it in the lists that already exist. Nothing else.
- 🟢 F2 — Explicitly out: check-in/check-out/no-show (CAM-64), lead/quote/deposit links (CAM-306/309/312), the OS6 map board (CAM-316).
- 🟡 F3 — Editing a recorded stay. Default: **no edit** in slice 1; cancel and re-enter. Moving dates re-opens the capacity race and needs its own transaction design, which is a story, not a checkbox.
- 🟡 F4 — Where the price comes from. Default: **the host types the agreed total**, because a LINE deal routinely differs from the list price and the frozen amount must be what was actually agreed. The form may prefill from the camp's list price as a convenience (a design decision, not a schema one). `0` is legal — a comped stay.
- 🟡 F5 — Backdating. Default: check-in may be up to **30 days** in the past (a host catching up on the register); further back is a typo and is rejected.
- 🟡 F6 — The `วันนี้` / date-range filter on the stay list (v1's AC-4). Default: **dropped from the first slice** into its own follow-up story, to keep the PR under ~400 lines. The stay is still visible immediately in the existing list and calendar.

**Technical**

- 🟢 T1 — Minimum model set for the first slice: **zero new models**. Verified against the real schema and the real availability seam. See ADR-017 D1.
- 🔴 T2 — **The discriminator: add `MANUAL` to `BookingSource`, add a new `origin` column, or derive it from `userId IS NULL`?** The one hard-to-reverse call in the set. See Q2, with the correction that only one option is actually irreversible.
- 🟢 T3 — Concurrency: reuse `withHoldTransaction`'s shape verbatim over `checkDateAvailabilityInTx`. No new capacity math.
- 🟢 T4 — `Booking.userId` must become nullable. A synthetic "walk-in" `User` row was considered and rejected (fake PII-shaped rows, email uniqueness, and it would hand a host review rights at their own camp). Ripple enumerated: 4 files, grep-backed.
- 🟢 T5 — No state machine and no `NO_SHOW` needed for the first slice (the row is created at `confirmed` and never transitions). Both are real gaps and are named as their own story, not folded in.
- 🟡 T6 — Naming. Default: column `origin`, enum `BookingOrigin { CAMPER_SELF_BOOKED, HOST_RECORDED }`. Cheap to change now, expensive after the migration.

**UX**

- 🟡 U1 — Where the host does this. Default: a record-a-stay action on the existing `/dashboard/bookings` page — no new route, no new nav entry. Designer owns the form layout at G2.
- 🟢 U2 — Copy: real Thai written into CAM-313's AC/EC, verbatim, including the existing camper-facing `เหลือ {n} ที่` / `เต็มแล้ว` strings (`locales/translations.json:1358-1359`) so the AC asserts what actually renders.
- 🟡 U3 — Guest-name fallback. Default: a booking with an account keeps today's exact behaviour (account name, then account email); one without shows the stored guest name, then `ผู้เข้าพัก`.

**Security / Data**

- 🟢 S1 — Authz: `requireCampSitePermission(campSiteId, 'BOOKING_UPDATE')` — the identical rule holds and blocked dates already use. The camp is named in the path, never in the body.
- 🟢 S2 — PII: `guestName`/`guestContact` are the first PII to sit directly on `Booking`. Readable only through host-side, permission-gated endpoints; never on a public or camper-facing response; never in the `AuditLog` metadata.
- 🟢 S3 — A host-recorded stay must grant **no** review right to anyone. Already true (`app/api/reviews/route.ts:61` matches on the author's own account id) and pinned by a required regression test rather than left as an assumption.
- 🟡 S4 — Rate limiting. Default: **none added** — this is an authenticated, permission-gated host write with no enumeration value, the same posture as the holds route.
- 🟢 S5 — One `AuditLog` row (`stay.recorded`) inside the same transaction, ids and dates only.

**Risk**

- 🟢 R1 — Migration risk, re-examined against ADR-012:457's own flagged assumption. The two halves were conflated there: `DROP NOT NULL` is safe at any existing booking volume; the rollback caveat applies only to the **new** host-recorded rows, which this feature creates and therefore controls. Booking row counts are **not measured** (CAM-686 was read-only by dispatch constraint); production is gated by `COMING_SOON=1` (`.claude/ENV-CONFIG.md:34`) and carries no real camper traffic.
- 🟡 R2 — A host can now black out camper-visible nights by typing. Mitigated by the same capacity gate everything else passes, and by cancel-and-re-enter. Accepted.
- 🔴 R3 — **Ticket bookkeeping:** CAM-313's re-scope (its title still says "from won leads"), and whether the state-machine work rides CAM-64 or gets a new ticket. See Q3.

### The three questions for the owner (batched)

**Q1 — Where does HostOS start: the stay ledger (OS7) or the lead inbox (OS1)?**

Recommendation: **the stay ledger.** A lead inbox with no quote, no hold link and no stay is a second place to type things the host already has in LINE — it changes no number the host or the camper sees. The stay ledger changes the one number that is currently *wrong*. It is also the only piece that is valuable with zero upstream funnel: a host who has never touched a lead inbox can record today's walk-in and the calendar immediately stops lying. The dependency that made OS7 look fourth is ADR-012 §6's invariant "even a walk-in gets a `HostLead` row first" — that single line is what puts three unbuilt models on the critical path, and ADR-017 D3 drops it. The M1.2 exit criterion (the full lead → stay → daily-close loop) is unaffected: it is a milestone criterion, not a first-slice criterion, and building the funnel backwards reaches it in the same number of stories.

If no answer: default = stay ledger first. Impact of choosing OS1 instead: the first truthful-calendar change slips by roughly two stories, and CAM-306 must ship `HostLead` + `LeadConversation` before anything a camper can see changes.

**Q2 — What field says "a host entered this row"?** (the one hard-to-reverse choice)

| | Option | Cost | Reversible? |
|---|---|---|---|
| A | Add `MANUAL` to the shipped `BookingSource {WEB, CHAT}` | Cheapest. But it mixes two axes in one column (`WEB`/`CHAT` = which surface; `MANUAL` = is there an account), and it breaks that column's shipped, tested, documented contract "attribution only — never an authz/pricing/capacity input" (`schema.prisma:644-646`) | **No.** Postgres has no `DROP VALUE`; undoing it means recreating the type and rewriting every column that uses it |
| B | **New `origin` column on a new `BookingOrigin` enum** *(recommended)* | One column plus one enum type. Two source-ish columns sit next to each other and read similarly — mitigated only by naming and schema comments. Makes "platform vs host-recorded revenue" queryable, which Daily Close (CAM-321) and the revenue report (CAM-70) will need | **Yes** — `DROP COLUMN` + `DROP TYPE`; nothing else uses that type |
| C | No column; derive it from `userId IS NULL` | Free today. Pushes a business fact into a nullable-FK artifact, so every reader encodes `userId == null` as business logic; cannot express a host-recorded stay for a repeat camper who *does* have an account | Reversible only by adding the column later, with a backfill that **guesses** |

**Correction to the framing in CAM-686's brief:** "whichever way this goes, it is one-way" is true of **A only**. B avoids the one-way risk entirely. If no answer: default = **B**.

**Q3 — Ticket bookkeeping (no cost, but it is yours to say).**

(a) CAM-313 is re-specified here as "Host records a stay that did not come through the site"; its title on the board still reads "Manual stays from won leads", which is now wrong. Rename it, or open a new ticket and close CAM-313 as superseded?
(b) The booking state machine + `AuditLog` on status change + `NO_SHOW`: fold into the existing CAM-64 ("Host marks past bookings as Completed or No-show"), or a separate ticket? Note this is not only a HostOS gap — `app/api/bookings/[id]/route.ts:89-92` currently lets a **camper** booking go `CANCELLED → PENDING` or jump straight to `COMPLETED`, with no audit row. It is a shipped defect on the camper path today.

If no answer: default = rename CAM-313, and re-scope CAM-64 to carry the state machine.

## Sequencing — the next five stories, and what each unblocks

The funnel is built **backwards** (stay first, quote last), because value accrues at the stay end and every earlier stage needs somewhere to land.

| # | Story | Ticket | Adds to the schema | Unblocks |
|---|---|---|---|---|
| S1 | Host records a stay that did not come through the site | CAM-313 (re-scoped) | `Booking.guestName`, `.guestContact`, `.origin`, nullable `.userId` | The calendar stops overstating availability. Creates the stay row every later HostOS story attaches to. |
| S2 | Check-in / check-out / no-show with guard rules + `AuditLog` | CAM-64 (re-scoped) | `BookingStatus.NO_SHOW` (an on-axis `ADD VALUE`, unlike Q2 option A) | CAM-290's stated exit criterion. Also closes the shipped `CANCELLED → PENDING` hole for camper bookings. |
| S3 | Host lead inbox + lead detail with a conversation timeline | CAM-306, CAM-307 | `HostLead`, `LeadConversation`, `Booking.leadId` | "Won → record the stay" lands on a button that already exists. Makes the public inquiry form (CAM-308) worth building. |
| S4 | Record deposits taken off-platform | CAM-312 | `DepositRecord`, `Image.depositRecordId` | Attaches to a lead **or** straight to a stay, because S1 gave it one. Daily Close's arithmetic (CAM-321). |
| S5 | Quote builder + shareable read-only link | CAM-309, CAM-310, CAM-311 | `Quote`, `QuoteLine`, `InternalHold.leadId`/`.quoteId`/`.bookingId` | Retires the unreachable `HoldStatus.CONVERTED` (`schema.prisma:921`). A quote is only worth building once there is a lead to build it from and a stay to convert it into. |

## Live status

Rollup lives on `/status` + `docs/specs/INDEX.md` (generated by `node scripts/ticket-sync.mjs index`) — not hand-maintained here.

## Key decisions

- Host-recorded stays reuse `Booking`; the discriminator is a new `origin` column, not `BookingSource` — [ADR-017](../../adr/ADR-017-host-recorded-stay-and-booking-discriminator.md) (PROPOSED, awaiting the owner on its open trade-offs)
- `HostLead` is **not** a prerequisite for the stay ledger — ADR-017 D3, superseding ADR-012 §6's `leadId` invariant
- The HostOS core data model — [ADR-012](../../adr/ADR-012-hostos-data-model.md) (Accepted; §6 + Alternatives (a) superseded in part)
- HostOS-first, payment deferred behind the readiness gate — [ADR-011](../../adr/ADR-011-strategy-pivot-hostos-first.md), narrowed by [ADR-016](../../adr/ADR-016-camper-direct-booking-and-in-chat-completion.md)

## Changelog

- v2 (2026-08-06) — CAM-686 Discovery: filled the architecture overview against the real repo state, recorded the 6-dimension gap list with three batched owner questions, and added the backwards-funnel sequencing. Was a template stub until now.
- v1 (2026-07-03) — feature created
