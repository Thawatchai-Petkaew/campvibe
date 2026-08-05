# ADR-017 — Host-recorded stays reuse `Booking`; `BookingSource` is NOT the discriminator

**Status:** PROPOSED — awaiting owner decision at G1/G2 (CAM-686 Discovery) · **Epic:** HostOS · Ops Board & Stays (CAM-290) · **Date:** 2026-08-06
**Supersedes:** [ADR-012](ADR-012-hostos-data-model.md) §6 (the `enum BookingSource { PLATFORM, MANUAL }` design and the "every MANUAL Booking carries a `leadId`" invariant) and ADR-012 Alternatives (a). Everything else in ADR-012 — `HostLead`, `LeadConversation`, `Quote`/`QuoteLine`, `DepositRecord`, `InternalHold`, the deferred sketches — stands unchanged.

---

## Context

ADR-012 (Accepted 2026-07-04) designed six HostOS models and declared all six "Ships in M1.2-core: Yes". Thirteen months of delivery later, the verified state of the repo is:

| ADR-012 model | Reality (read 2026-08-06) |
|---|---|
| `InternalHold` | **Shipped**, `prisma/schema.prisma:926`, migration `20260704080358_cam302_internal_hold` — but as a **reduced slice**: `schema.prisma:911-915` records that `leadId`/`quoteId`/`bookingId` were deliberately omitted "until CAM-311". `HoldStatus.CONVERTED` (`:921`) is therefore unreachable today. |
| `HostLead` · `LeadConversation` · `Quote` · `QuoteLine` · `DepositRecord` | **Do not exist.** Spec only. |
| ManualStay (`Booking` extension) | **Does not exist.** No `source = MANUAL`, no nullable `userId`, no `leadId`. |

Two facts have changed since ADR-012 was accepted, and both bear directly on its §6 decision:

**1. The `source` column ADR-012 wanted is already taken, with a different meaning.**
CAM-642 shipped `enum BookingSource { WEB, CHAT }` (`schema.prisma:115-118`) for chat attribution, and pinned its semantics in the schema itself (`:644-646`):

> `source BookingSource @default(WEB)` — "where this booking was created from. **Attribution only — never an authz/pricing/capacity input**."

That invariant is not decorative. `app/api/bookings/route.ts` never reads `source` for anything, `lib/validations/booking.ts:38` pins `z.enum(['WEB','CHAT'])`, and `__tests__/cam-642-booking-source.test.ts` asserts the round-trip. ADR-012's `{ PLATFORM, MANUAL }` design cannot land on this column without either renaming shipped values or overloading a column that is documented as non-load-bearing.

**2. Camper booking has shipped and is live** (`docs/project/platform-blueprint.md:11`, ADR-016). ADR-012:454 rested its low-risk migration window on "no real production platform-booking data at stake" and explicitly flagged that assumption for re-checking. The re-check is below (Consequences → Migration).

**3. `BookingStatus` has no `NO_SHOW` and there is no state machine.** `schema.prisma:103-109` lists `PENDING · CONFIRMED · PAID · CANCELLED · COMPLETED`. `app/api/bookings/[id]/route.ts:89-92` is a bare `prisma.booking.update({ where: { id }, data: { status } })` — `CANCELLED → PENDING` and `PENDING → COMPLETED` are both permitted, and no `AuditLog` row is written. This is a real, currently-shipped defect on the camper path, independent of HostOS. It is **not** in scope of this ADR; it is named as its own story in Consequences → Sequencing.

The question this ADR answers: **when a host records a stay that never went through the website (walk-in, LINE, phone), what row is written, and what field says so?**

### The seam this must not fork

`lib/campsite-availability.ts` is the single place that answers "how much room is left". Every reader was read directly (not assumed) and **none of them filters by who created the booking** — all five filter on `status` alone:

| Reader | Line | Predicate |
|---|---|---|
| `getCampSiteDailyAvailability` (host calendar, public availability) | `:214` | `status: { in: ['CONFIRMED','PENDING'] }` |
| `computeBatchedNightlyOccupancy` (catalog badge + AI card) | `:514` | `status: { in: ['CONFIRMED','PENDING'] }` |
| `checkDateAvailabilityInTx` (the booking/hold **write gate**) | `:996` | `status: { in: ['CONFIRMED','PENDING'] }` |
| `getSpotBookingsForRange` (per-pitch read) | `:818` | `status: { not: 'CANCELLED' }` |
| `isSpotBookedForStay` (per-pitch write gate) | `:921` | `status: { not: 'CANCELLED' }` |

This is the decisive, checkable fact of the whole decision: **a host-recorded row written into `Booking` at `status: CONFIRMED` is counted by all five readers with zero lines of code changed.** A separate `ManualStay` table would add a sixth inventory source to keep in lock-step forever, in the exact function that has already shipped four "a query path forgot a source" bugs (CAM-190, CAM-267, CAM-400, CAM-665).

---

## Decision

### D1 — Host-recorded stays reuse `Booking`. No new model. (Re-affirms ADR-012 §6's conclusion on new evidence.)

The first slice adds **zero tables**. It adds three nullable columns and one enum + column (D2):

```prisma
model Booking {
  // ...all existing fields unchanged...

  userId String?  // CHANGED: was `String` (required). Null ⟺ no CampVibe account exists
  user   User?    @relation(fields: [userId], references: [id])  // CHANGED: was required

  // NEW — the guest identity a walk-in has. Not a "snapshot" of another row:
  // these Pixels ORIGINATE here (nothing upstream to copy from), exactly like
  // a paper check-in register entry. When HostLead ships, `leadId` becomes the
  // link and these stay as what the host actually wrote that day (ADR-005
  // crystallization: the document holds the value, the FK holds the trace).
  guestName    String?  // [PII] as written by the host
  guestContact String?  // [PII] free text — phone / LINE id / FB handle

  origin BookingOrigin @default(CAMPER_SELF_BOOKED) // NEW — see D2

  @@index([origin])  // NEW — "show me the stays I entered" is a first-class host query
}
```

`totalPrice` (NOT NULL) is the host-typed agreed amount. Crystallization (ADR-005) is honoured but honest: write `snapshotTotalAmount`, `snapshotCurrency`, `snapshotNights`, `snapshotCampName`/`snapshotCampNameEn`, `snapshotSpotName`, `snapshotCheckInTime`/`snapshotCheckOutTime`/`snapshotTimezone`; leave `snapshotUnitAmount`/`snapshotSubtotalAmount`/`snapshotTaxRate`/`snapshotTaxAmount`/`snapshotVatInclusive`/`snapshotPricingUnit`/`snapshotQuantity` **NULL** — a LINE deal has no computed unit breakdown and inventing one would assert a fact that was never true.

### D2 — The discriminator is a NEW column `origin` on a NEW enum. `BookingSource` is left alone.

```prisma
// Who the counterparty is and who entered the row — orthogonal to `source`
// (which UI surface created it). CAMPER_SELF_BOOKED ⟹ userId is non-null.
enum BookingOrigin {
  CAMPER_SELF_BOOKED // a camper created it through their own account (every row today)
  HOST_RECORDED      // a host entered it on a guest's behalf (walk-in / LINE / phone)
}
```

**Why not add `MANUAL` to `BookingSource` (the obvious cheap move):**

- It mixes two axes in one column. `WEB`/`CHAT` answer *"which surface did the request come from"*; `MANUAL` answers *"is there a camper account behind this row"*. A host recording a stay through the host web UI is truthfully `WEB` **and** manual — the fact that both are simultaneously true is the tell that they are different Pixels. Cramming both into one column is precisely the "never pack several facts into one field" rule (`.claude/rules/architecture.md` §1).
- It silently breaks a shipped, tested invariant. `source` is documented at `schema.prisma:644-646` as *"never an authz/pricing/capacity input"*. `MANUAL` would be load-bearing: it is the only thing legitimising `userId = null`, and it would gate guest-name resolution in four dashboard call sites. A column cannot be both a free-text label and a correctness discriminator.
- **It is the only one of the three options that is genuinely irreversible.** `ALTER TYPE "BookingSource" ADD VALUE 'MANUAL'` cannot be undone — Postgres has no `DROP VALUE`; reversal means recreating the type and rewriting every column that uses it.

**Correcting the framing in CAM-686's brief:** "whichever way this goes, it is one-way" is true only of Option A. A **new** enum + a **new** column is fully reversible — `DROP COLUMN "origin"; DROP TYPE "BookingOrigin";` touches nothing else, because nothing else uses that type. The one-way risk is avoidable, and this decision avoids it.

**Why not derive it from `userId IS NULL` and add no column at all (the leanest option):**
Sufficient for the first slice, and rejected anyway, on two grounds: (a) it makes a nullable-FK artifact carry a business fact, so every reader would encode `userId == null` as business logic — a boundary leak into four dashboard files and every future report; (b) it cannot express a host-recorded stay for a guest who *does* have an account (a repeat camper who phones in), and once a few hundred rows exist, adding the column later requires a backfill that **guesses**. Adding it now costs one column and backfills exactly (`@default` covers 100% of existing rows).

### D3 — `HostLead` is NOT a prerequisite for the first slice. ADR-012 §6's "every MANUAL Booking carries a `leadId`" invariant is dropped.

ADR-012 §6 asserted that even a walk-in gets a `HostLead` row first, and therefore treated `leadId` as service-required whenever `source = MANUAL`. That single invariant is what puts three unbuilt models (`HostLead`, `Quote`, `DepositRecord`) on the critical path of a capability that needs none of them: a walk-in stay needs a camp, dates, a guest count, a name, and an amount.

Dropped. `Booking.leadId String?` is added **later** (CAM-306, when `HostLead` exists) as a purely additive nullable FK, and is the trace when a stay did come from a lead. A host-recorded stay with no lead is a legitimate, permanent shape, not a temporary gap.

### D4 — No state machine, no `NO_SHOW`, in the first slice.

A host-recorded stay is created at `status: CONFIRMED` (the schema default at `:642` is `PENDING`; the platform route sets it explicitly, so the manual writer sets `CONFIRMED` explicitly too). No transition occurs in slice 1, so slice 1 needs no state machine.

The missing state machine and the missing `NO_SHOW` value are real and are **named as their own story**, not folded in silently — see Consequences → Sequencing, S2. Note the contrast with D2: adding `NO_SHOW` to `BookingStatus` **is** the right use of an irreversible `ADD VALUE`, because it is on-axis (a genuine new lifecycle state of an existing business enum), whereas `MANUAL` on `BookingSource` is off-axis.

### D5 — Concurrency reuses the existing pattern verbatim; no new capacity math anywhere.

The write reuses `checkDateAvailabilityInTx` per night inside a `Serializable` transaction with bounded `P2034` retry — the shape already implemented twice, at `app/api/campsites/[id]/holds/route.ts:43` (`withHoldTransaction`) and `app/api/bookings/route.ts:51` (`withBookingTransaction`). `withHoldTransaction` is the closer template: same per-night loop, same 3-attempt/50-100-150ms backoff, same conflict→409. This satisfies CAM-313 BR-1/BR-2 and AC-3 without a line of new capacity logic.

---

## Alternatives considered

### (a) Add `MANUAL` to the existing `BookingSource`
Covered in D2. Rejected on three grounds (axis-mixing, breaks a shipped documented invariant, irreversible). **What it would have avoided, fairly stated:** one column and one enum type, and any "why are there two source-ish columns" confusion for a reader skimming the schema. That confusion is real and is mitigated only by naming plus the schema comment — this is the honest cost of D2 and is why it is raised as an open trade-off rather than presented as free.

### (b) Derive "host-recorded" from `userId IS NULL`, add no column
Covered in D2. Rejected: pushes a business fact into a nullable-FK artifact, leaks into every reader, and is lossy for the phoned-in-repeat-camper case. It is the cheapest option today and the most expensive to correct later.

### (c) A separate `ManualStay` model (ADR-012 Alternatives (a), re-examined on today's facts)
ADR-012 rejected this; the evidence for rejecting it is **stronger** now than it was then, not weaker:

- The availability seam has grown from 2 readers to **5** since ADR-012 was written (`getSpotBookingsForRange` and `isSpotBookedForStay` are CAM-665 additions; `computeBatchedNightlyOccupancy` is CAM-344/CAM-427). A separate table means teaching all five about a sixth source — and the repo has now shipped **four** bugs from exactly this failure mode (CAM-190, CAM-267, CAM-400, CAM-665), not two.
- The unified-list argument is unchanged and still correct: no single `ORDER BY … LIMIT/OFFSET` across two heterogeneous tables, so every "all stays for this camp" screen pays an application-level merge forever.
- The 17-column crystallized-snapshot set would be duplicated wholesale.

**What it would have avoided (fairly stated):** the nullable `userId` and its 4-file display ripple (enumerated in Consequences). That is a real, bounded, one-time cost against a permanent, unbounded one.

### (d) Ship `HostLead` first (OS1) and reach the stay ledger fourth
This is the blueprint's numbering and ADR-012's implicit order. Rejected as the *first* slice: a lead inbox with no quote, no hold link and no stay is a second place for the host to type things they already have in LINE — it changes no number the host or the camper sees. The stay ledger changes the one number that is currently **wrong**: today a host who sold three pitches over LINE can express that only as a `BlockedDate` (no guest, no money, no count) or an `InternalHold` (temporary, expires) — neither records that someone is actually staying, so the public availability the camper sees overstates the camp. Full sequencing argument in Consequences → Sequencing. Flagged as an owner-overturnable trade-off (Open trade-off #1).

---

## Consequences

### Positive

- **Zero new tables, zero new capacity code.** The five availability readers count a host-recorded stay correctly the moment the row exists, because none of them filters on who created it. That property is verified against the real file, not asserted.
- **The public calendar stops lying** the day this ships — the platform's single differentiating number becomes true for hosts who sell off-platform, which is most of them.
- **`BookingSource`'s shipped contract is untouched.** CAM-642's tests, `lib/validations/booking.ts`, and the "attribution only" invariant all keep holding, unmodified.
- **The whole migration is reversible** (see below) — no `ADD VALUE` on any existing enum.
- **Later HostOS stories get an attachment point.** `DepositRecord.bookingId`, `InternalHold.bookingId`, POS lines, and Daily Close all need a stay row to point at; building the stay first means each of them lands additively.

### Negative / risks

- **`Booking.userId` required → nullable is a real ripple.** Grepped (`booking.user`, `booking.userId`, `user: { select`) — four files read `booking.user.*` without a null guard and will throw on the first host-recorded row that reaches them:
  `app/dashboard/page.tsx:282,284` · `app/dashboard/bookings/page.tsx:118,235,381,384,385` · `app/api/operator/dashboard/route.ts:83` (include) · `app/api/operator/bookings/route.ts:~86` (include).
  Fix is mechanical and must ship in the **same** story: one shared resolver, `booking.user?.name ?? booking.guestName ?? 'ผู้เข้าพัก'`, and both `include`s must also `select` `guestName`/`guestContact`.
- **Two source-ish columns on one table.** `source` (surface) and `origin` (counterparty) sit next to each other and read similarly. Mitigation is naming plus a schema comment on both; there is no structural fix. Raised as Open trade-off #2.
- **A host can now consume camper-visible capacity by typing.** A typo'd stay blacks out nights for real campers. Mitigated by the same capacity gate everything else passes through, and by cancel-and-re-enter; there is no edit path in slice 1 (an edit re-opens the capacity race and needs its own transaction design).
- **PII lands on `Booking`.** `guestName`/`guestContact` are PII on a row that previously carried none directly. They must never appear on a public or camper-facing response; the host-side read is already gated by `requireCampSitePermission(campSiteId, 'BOOKING_UPDATE')`.

### Migration — reversible, and the ADR-012:457 caveat re-examined honestly

```
1. CREATE TYPE "BookingOrigin" AS ENUM ('CAMPER_SELF_BOOKED','HOST_RECORDED');
2. ALTER TABLE "Booking" ADD COLUMN "origin" "BookingOrigin" NOT NULL DEFAULT 'CAMPER_SELF_BOOKED';
   -- every existing row is correct by the default; NO backfill logic
3. ALTER TABLE "Booking" ADD COLUMN "guestName" TEXT, ADD COLUMN "guestContact" TEXT;
4. ALTER TABLE "Booking" ALTER COLUMN "userId" DROP NOT NULL;   -- no data movement
5. CREATE INDEX ON "Booking"("origin");
down: DROP INDEX; DROP COLUMN guestContact, guestName, origin; DROP TYPE "BookingOrigin";
      ALTER COLUMN "userId" SET NOT NULL;
```

**Re-examining ADR-012:457's caveat on today's facts.** ADR-012 said the rollback is safe only while "no real production platform-booking data is at stake", and flagged it for re-check now that camper booking has shipped. The re-check produces a **correction to how that risk was framed**: the two halves were conflated.

- *Going up* — `DROP NOT NULL` never destroys or rewrites a row. It is safe at **any** volume of existing bookings. Existing-row volume is irrelevant to the forward migration.
- *Going down* — `SET NOT NULL` fails against any row with `userId = null`. Those rows are exclusively **new host-recorded stays**, which this feature creates and which we therefore control. Rollback rule: `DELETE FROM "Booking" WHERE "userId" IS NULL` (or re-point them) before the down migration. That is a stated, executable precondition, not an unbounded risk.

So ADR-012's caveat still holds in substance, but it is a caveat about the *rows this feature creates*, not about pre-existing camper bookings. **Not measured** (deliberately, by CAM-686's read-only constraint): the actual `Booking` row counts on dev/staging/prod. Independent context that bounds it anyway: production is still gated by `COMING_SOON=1` (`.claude/ENV-CONFIG.md:34`), so production carries no real camper booking traffic today. Prove up→down→up on the local dev DB before the promote, per `.claude/rules/ops.md` §3.

### Sequencing (the ADR's operational consequence)

The funnel is built **backwards** — stay first, quote last — because value accrues at the stay end and each earlier stage needs somewhere to land:

| # | Story | What it unblocks |
|---|---|---|
| S1 | **Host records a stay that did not come through the site** (CAM-313, re-scoped by this ADR to drop the lead dependency) | The calendar stops overstating availability. Creates the stay row every later HostOS story attaches to. |
| S2 | **Check-in / check-out / no-show with guard rules + `AuditLog`** (CAM-64, re-scoped to carry the state machine) | CAM-290's stated exit criterion. Also closes the shipped `CANCELLED → PENDING` hole at `app/api/bookings/[id]/route.ts:89-92` for **camper** bookings. Adds `NO_SHOW` to `BookingStatus` (on-axis `ADD VALUE`). |
| S3 | **Host lead inbox** — `HostLead` + `LeadConversation`, adds `Booking.leadId` (CAM-306/307) | "Won → record the stay" now lands on a button that already exists. Makes the public inquiry form (CAM-308) worth building. |
| S4 | **Deposit record** — `DepositRecord` + `Image.depositRecordId` (CAM-312) | Attaches to a lead **or** directly to a stay (S1 gave it a stay to attach to). Daily Close's arithmetic (CAM-321). |
| S5 | **Quote builder** — `Quote` + `QuoteLine`, plus `InternalHold.leadId`/`quoteId`/`bookingId` (CAM-309/310/311) | Retires the unreachable `HoldStatus.CONVERTED` (`schema.prisma:921`). A quote is only worth building once there is a lead to build it from and a stay to convert it into. |

---

## Open trade-offs — for the human to choose

1. **Sequence: stay-ledger-first (this ADR) vs lead-inbox-first (blueprint numbering / ADR-012 order).** Recommendation: stay first, argued in Alternatives (d). Overturning it costs nothing today — it re-orders S1 and S3 — but it delays the first truthful-calendar change by roughly two stories.
2. **The discriminator: new `origin` column (recommended, D2) vs `MANUAL` added to `BookingSource` vs no column at all.** This is the one hard-to-reverse choice in the set, and only option A is actually irreversible. See D2 for the full three-way comparison.
3. **Column/enum naming.** Default: `origin` / `BookingOrigin{CAMPER_SELF_BOOKED, HOST_RECORDED}`. Alternatives the owner may prefer: `entryMode`, `counterparty`, or ADR-012's original `PLATFORM`/`MANUAL` values on the new column. Naming is cheap to change **now** and expensive after the migration lands.
4. **Guest identity on `Booking` vs waiting for `HostLead` (D3).** Recommendation: two Pixels on `Booking`, because a walk-in genuinely has no upstream Set to link to and the register entry is the document. If the owner would rather keep `Booking` free of PII, the alternative is shipping `HostLead` first — which is Open trade-off #1 by another route.
5. **Editing a host-recorded stay.** Default: no edit in slice 1 (cancel + re-enter). An edit that moves dates re-opens the capacity race and needs its own transactional design; folding it in silently would be the wrong call.

---

## Links

- [ADR-012](ADR-012-hostos-data-model.md) — the HostOS data model this ADR partially supersedes (§6 + Alternatives (a)); everything else in it stands.
- [ADR-005](ADR-005-booking-snapshot.md) — crystallization; applied honestly in D1 (write what is known, leave the unknown breakdown NULL).
- [ADR-006](ADR-006-booking-atomic-inventory-lock.md) — the Serializable + bounded-`P2034`-retry pattern reused verbatim in D5.
- [ADR-016](ADR-016-camper-direct-booking-and-in-chat-completion.md) — camper direct booking; the fact that made ADR-012:457's caveat worth re-checking.
- Verified by direct read (not assumed): `prisma/schema.prisma:103-118, 602-688, 900-955` · `lib/campsite-availability.ts:214, 514, 818, 921, 996` · `app/api/bookings/route.ts:51, 219-256` · `app/api/bookings/[id]/route.ts:20, 89-92` · `app/api/campsites/[id]/holds/route.ts:43-130` · `app/dashboard/page.tsx:282-284` · `app/dashboard/bookings/page.tsx:118,235,381-385` · `app/api/operator/dashboard/route.ts:83` · `app/api/operator/bookings/route.ts` · `lib/validations/booking.ts:38` · `.claude/ENV-CONFIG.md:34`.
- `.claude/rules/architecture.md` §1 (one field, one fact) · §15b (reader/writer sweep + single seam invariant) · §16 (ADR lifecycle).
