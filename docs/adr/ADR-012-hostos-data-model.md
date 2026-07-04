# ADR-012 — HostOS core data model: lead → quote → hold → deposit → manual stay

**Status:** Accepted — owner approved 2026-07-04 (G2, PR #306) · **Epic:** HostOS core (M1.2) · **Date:** 2026-07-04

## Context

Blueprint v6 (owner-ratified 2026-07-04, ADR-011 in PR #302 — pending merge) pivots CampVibe **HostOS-first**: public booking/payment is deferred behind a `BookingReadinessGate` (M7.5), and the near-term product is an operational tool that carries a host's real workflow — **Lead → Quote → Manual Hold → Deposit Record → Manual Stay → POS/Rental → Daily Close** — end to end. The economic stance is explicit and load-bearing for every model below: **the host handles money; the platform is a ledger/workflow layer only** (no payment gateway custody in this epic). The stated guardrails: the core (ledger/availability/state) must be **deterministic** — any future AI-assist layer may read and suggest, but must never write money or availability without a host confirming — and **every money-affecting edit emits an `AuditLog` row** (the existing model, unchanged).

This ADR designs the M1.2-core slice of that funnel — `HostLead`, `LeadConversation`, `Quote`/`QuoteLine`, `InternalHold`, `DepositRecord`, and the **ManualStay** decision — directly in the **product schema** (`prisma/schema.prisma`), not a delivery-style separate schema (see Alternatives (e) for why that separation, correct for the internal delivery-ticket tooling in ADR-010, does not apply here: leads/quotes/deposits are first-class **product** data — camp inventory, guest money-adjacent records, host-operational history — not internal dev-ops metadata).

Three pieces of existing product code are the load-bearing integration surface this design must not fork:

- **`lib/campsite-availability.ts`** — `getCampSiteDailyAvailability` (sums `Booking.guests` per day + applies `BlockedDate` coverage) and `getRemainingCapacity` (CAM-267 PREP-1, the single shared "how much room is left" answer, already combining Booking + BlockedDate with zero double-query risk). Every new inventory-consuming concept (`InternalHold`, eventually `ManualStay`) must be read by *this* function, not a parallel one — the codebase has already paid for two "forgot a source" bugs here (CAM-190 BlockedDate reason-leak, CAM-267 BlockedDate-excluded-from-search) and a third would repeat exactly the failure mode ADR-009 rejected for search (a merged/duplicated data path that silently drifts from the live source).
- **`app/api/bookings/route.ts`** (`withBookingTransaction`) — the ADR-006 serializable-transaction + bounded-retry pattern that makes the overbooking race impossible. `InternalHold` creation must reuse this exact concurrency strategy, not invent a second one.
- **`prisma/schema.prisma` `Booking`** — an existing, non-trivial model (crystallized snapshot per ADR-005, `BookingStatus` state, `spotId?` optional spot-level booking, `userId` currently **required**) that the ManualStay decision below must either extend or duplicate.

Everything designed here traces back to the eight items in the dispatch brief; no migration is written — this ADR is the G2 design artifact the owner reviews before any Prisma change lands.

## Decision

### 0. Model map (traceability)

| Funnel stage / brief item | Model(s) | Ships in M1.2-core? |
|---|---|---|
| 1. Lead | `HostLead` | Yes |
| 2. Conversation timeline | `LeadConversation` | Yes |
| 3. Quote | `Quote`, `QuoteLine` | Yes |
| 4. Manual Hold | `InternalHold` | Yes |
| 5. Deposit Record | `DepositRecord` (+ `Image` extended) | Yes |
| 6. Manual Stay | `Booking` extended (`source`, nullable `userId`, `leadId`) — **recommended**, see §6 + Alternatives (a) | Yes |
| 7. Guest profile | `GuestProfile` | **Deferred** — sketch only, §7 |
| 8. POS / Rental / Daily Close | — | **Deferred** — one-paragraph sketches, §8 |

Field classification tags below follow `.claude/rules/architecture.md` §11: **[PII]** / **[Financial]** / **[Geo]** / **[Public]** (untagged = Public).

### 1. HostLead

```prisma
enum LeadChannel {
  LINE
  FACEBOOK
  PHONE
  WALK_IN
  WEB
}

enum LeadStatus {
  NEW
  CONTACTED
  QUOTED
  HOLD
  WON
  LOST
}

model HostLead {
  id String @id @default(uuid())

  channel      LeadChannel
  guestName    String  // [PII]
  guestContact String  // [PII] free text (phone / LINE id / FB handle) — see Resolution Boundary note below
  submitterIp  String? // [PII] set only when channel = WEB; abuse/spam-cluster triage only, never shown to host UI as "the guest's IP"

  guests Int  @default(1)
  tents  Int?
  pets   Int? @default(0)

  preferredCheckInDate  DateTime? @db.Date
  preferredCheckOutDate DateTime? @db.Date
  needsNote             String?

  status LeadStatus @default(NEW)

  campSiteId String
  campSite   CampSite @relation(fields: [campSiteId], references: [id])

  assignedToId String?
  assignedTo   User?   @relation("LeadAssignee", fields: [assignedToId], references: [id])

  conversations LeadConversation[]
  quotes        Quote[]
  holds         InternalHold[]
  deposits      DepositRecord[]
  stays         Booking[] // MANUAL Booking rows created from this lead (see §6)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // soft-delete (business Set)
  version   Int       @default(1)

  @@index([campSiteId])
  @@index([status])
  @@index([assignedToId])
  @@index([channel])
  @@index([createdAt])
}
```

**Resolution Boundary applied to `guestContact`:** kept as one free-text Pixel, not split into `contactType`/`contactValue`. No M1.2 use case filters/sorts by the sub-parts of a contact string (nobody queries "all leads with a 9-digit LINE id"); `channel` already carries the closest thing to a "contact medium" signal. If a future story needs to *validate* a phone vs. a LINE id differently, that is a form-validation concern (`.claude/rules/ux.md`), not a schema split.

**`submitterIp` passes the test:** differs in classification (restricted, abuse-review only vs. host-operational) and is genuinely queried on its own ("all leads from this IP in the last hour" — a spam-cluster investigation), so it is a separate Pixel rather than folded into `guestContact`.

**Web-inquiry ingestion boundary** (the "source of web-inquiry" requirement): a future `POST /api/hostos/leads` is **public, unauthenticated** (no login — matches a guest browsing the public camp page with no account). It must, at minimum: (a) zod-validate the body; (b) rate-limit by IP using the existing `lib/rate-limit.ts` `checkRateLimit` primitive, keyed `lead:web:<ip>` — a concrete starting budget of 5 requests / 15 min per IP is suggested here but is Security's call to tune, not locked by this ADR; (c) write exactly one `HostLead{channel: WEB, submitterIp}` row and, if the form carries free-text ("what are you looking for"), one `LeadConversation{senderType: GUEST}` row — no other write. `assignedToId` stays `null` until a host claims it. **Spam/abuse mitigation beyond IP rate-limiting (captcha/honeypot) is not decided here** — see Open trade-off #6.

**`HostLead.status` is a stored Pixel, not derived-on-read**, even though `QUOTED`/`HOLD`/`WON` each correlate with a child row existing (a sent `Quote`, an active `InternalHold`, a converted `Booking`). This is a deliberate exception to architecture rule #12 ("compute-on-the-fly, never cache as sole source of truth"), reasoned through explicitly because that rule exists to prevent a *duplicated* fact from drifting from its source — but `NEW`/`CONTACTED`/`LOST` carry information that **exists nowhere else in the schema** (a host's own judgment that they've made contact, or that the guest went cold) — there is no Pixel to derive them from, so a derive-only design cannot represent the whole machine. For the three states that *do* have a correlated child row, `status` is written **transactionally in the same service call** that mutates the child (mirrors ADR-010's `DeliveryPulse`/ticket-state precedent: one authoritative write, not a read-time recomputation), which also makes the common host-facing query ("show me every `HOLD` lead") a single indexed `WHERE status = 'HOLD'` instead of a join+aggregate per row.

**Transition table** (validated in a service layer per the ADR-010 precedent — no DB-level state machine):

| From | To | Trigger | Side effect |
|---|---|---|---|
| *(none)* | `NEW` | `HostLead.create()` | assign id; `status = NEW`; optionally write the first `LeadConversation` (see ingestion boundary above) |
| `NEW` | `CONTACTED` | `markContacted()` (explicit host verb) | host has made first contact; **not** implicitly inferred from a `LeadConversation` row existing — kept as a distinct, deliberate host action so the timeline (many notes) and the funnel stage (one milestone) don't silently couple |
| `NEW` / `CONTACTED` | `QUOTED` | side effect of `Quote.send()` for a `Quote` on this lead | **advance-only** — never regresses a lead already at `HOLD`/`WON`/`LOST` if a corrected quote is later (re)sent (see §3 `reviseSend()`) |
| `QUOTED` | `HOLD` | side effect of `InternalHold.create(leadId)` succeeding | the funnel's inventory is now provisionally reserved |
| `HOLD` | `WON` | side effect of the ManualStay `Booking` being created from this hold (deposit recorded + stay confirmed, §6) | terminal |
| `NEW` / `CONTACTED` / `QUOTED` / `HOLD` | `LOST` | `markLost(reason?)` (host verb, any point) | terminal — **no reopen**; a returning guest gets a brand-new `HostLead` row (consistent with ADR-010's `DONE`/`CANCELED` "reopen is scoped, not universal" precedent, and with the "one atomic story, no silent state resurrection" pattern already used for the delivery tracker) |

### 2. LeadConversation

```prisma
enum ConversationSender {
  HOST
  GUEST
  SYSTEM
}

model LeadConversation {
  id String @id @default(uuid())

  leadId String
  lead   HostLead @relation(fields: [leadId], references: [id])

  channel    LeadChannel        // reuses HostLead's enum — the channel THIS note happened on, may differ from the lead's origin channel over its life
  senderType ConversationSender
  text       String             // [PII] free text; a host may paste a guest's phone/LINE id into a note

  createdAt DateTime @default(now())

  @@index([leadId, createdAt])
}
```

A flat append-only timeline per lead — no edit/delete verb, matching how conversation history should behave (a note, once written, is a record of what was said, not an editable field). `SYSTEM` sender covers auto-generated entries (e.g. "quote sent", "hold created") if a future story wants the timeline to also show milestone events inline; not built by this story.

### 3. Quote / QuoteLine

```prisma
enum QuoteStatus {
  DRAFT
  SENT
  ACCEPTED
  EXPIRED
}

model Quote {
  id String @id @default(uuid())

  leadId String
  lead   HostLead @relation(fields: [leadId], references: [id])

  campSiteId String   // ID copied from lead.campSiteId at creation — a lead's camp is immutable, this is a link, not a duplicated fact
  campSite   CampSite @relation(fields: [campSiteId], references: [id])

  status     QuoteStatus @default(DRAFT)
  version    Int         @default(1)
  shareToken String?     @unique // minted only at send() — see security note below; NULLs distinct (multiple DRAFT rows unaffected, same pattern as Payment.providerRef)

  previousVersionId String? @unique
  previousVersion   Quote?  @relation("QuoteRevision", fields: [previousVersionId], references: [id])
  nextVersion       Quote?  @relation("QuoteRevision")

  validUntil DateTime?

  currency       String   @default("THB") // [Financial] ISO 4217 — set at creation like every other money-bearing model
  subtotalAmount Decimal? @db.Decimal(12, 2) // [Financial] NULL while DRAFT (computed live from lines); frozen at send()
  taxRate        Decimal? @db.Decimal(5, 4)  // [Financial] NULL while DRAFT; frozen at send() (source: Country.vatRate, ADR-005 pattern)
  taxAmount      Decimal? @db.Decimal(12, 2) // [Financial] NULL while DRAFT; frozen at send()
  totalAmount    Decimal? @db.Decimal(12, 2) // [Financial] NULL while DRAFT; frozen at send()

  lines QuoteLine[]

  acceptedAt   DateTime?
  acceptedById String?   // host user who recorded the guest's acceptance — see Open trade-off #1
  acceptedBy   User?     @relation("QuoteAcceptedBy", fields: [acceptedById], references: [id])

  holds    InternalHold[]
  deposits DepositRecord[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([leadId])
  @@index([campSiteId])
  @@index([status])
  @@index([validUntil])
}

model QuoteLine {
  id String @id @default(uuid())

  quoteId String
  quote   Quote  @relation(fields: [quoteId], references: [id])

  description String
  spotId      String?
  spot        Spot?   @relation(fields: [spotId], references: [id])

  quantity   Int
  unitAmount Decimal @db.Decimal(12, 2) // [Financial] sourced from Spot.pricePerNight / CampSite.priceLow at draft time, host-editable
  lineTotal  Decimal @db.Decimal(12, 2) // [Financial] quantity × unitAmount, recomputed on every DRAFT edit
  sortOrder  Int     @default(0)

  @@index([quoteId])
}
```

**Crystallization (learned from ADR-005) applied to Quote, not just Booking:** while `DRAFT`, `subtotalAmount`/`taxAmount`/`totalAmount`/`taxRate` are **not stored** — the host's live preview is a Buffet computed from `QuoteLine.lineTotal` + the camp's current `Country.vatRate` at read time (architecture rule #12 — compute-on-the-fly, no cached "draft total" to keep in sync). Exactly at the `send()` transition, these fields are **written once** from that instant's line totals and never mutated again — a guest who opens the share link a week later must see the price they were actually quoted, not a price recomputed from whatever the host's spot pricing has become since. This is the identical shape of guarantee ADR-005 gives a confirmed Booking, applied one funnel stage earlier.

**version-on-edit vs. immutable-resend — decided: immutable-resend (new version row), justified:** a `SENT` `Quote` is **never mutated in place**. If the host needs to change price/lines after sending, the service creates a **new** `Quote` row (`version = previous.version + 1`, same `leadId`/`campSiteId`, fresh `QuoteLine`s, a **new** `shareToken`) via `reviseSend()`, and flips the **old** row's `status` from `SENT` to `EXPIRED` with `nextVersion` pointing forward. Rejected: mutating the `SENT` row's totals in place — a guest who already opened the original share link would see the price silently change under them with no record of what they were first shown, which is exactly the trust failure the crystallization principle exists to prevent (a sent quote is a legally-adjacent document once a deposit conversation starts, not a live view). The cost of immutable-resend is a small amount of `Quote` row multiplication per lead (bounded — quotes are re-sent rarely, not per page view) and the disambiguation noted in Open trade-off #2 (`EXPIRED` is reused for both "time ran out" and "superseded by a revision" — the `previousVersion`/`nextVersion` chain is what a host-facing Buffet uses to tell those apart, not a new stored enum value, to stay within the exact 4-status contract given for this story).

**Share-token security note:** `shareToken` must be minted from a cryptographically random source at `send()` time (e.g. `crypto.randomBytes(24).toString('base64url')`), **never** the row's own `id` or a sequential value — exposing the DB id as the public token would let a guest enumerate other quotes by guessing adjacent ids/uuids (an IDOR-adjacent information-disclosure risk per `.claude/rules/security.md`). The public read route (`GET /api/hostos/quotes/[shareToken]`, a future story, not designed here) must look up by `shareToken` only, never by `id`, and return a Buffet view (camp name, dates, lines, total) — not a raw row dump (no `leadId`/`campSiteId`/internal ids in the public response).

**Quote `ACCEPTED` authority is not decided here** — see Open trade-off #1.

**No explicit `REJECTED` Quote status** — see Open trade-off #2.

**Transition table:**

| From | To | Trigger | Side effect |
|---|---|---|---|
| *(none)* | `DRAFT` | `Quote.create(leadId)` | `version = 1`; lines empty |
| `DRAFT` | `DRAFT` | edit `QuoteLine` rows | totals stay `NULL`, computed live for preview |
| `DRAFT` | `SENT` | `send()` | crystallize totals + currency; mint `shareToken`; advance `HostLead.status` (see §1) |
| `SENT` | `ACCEPTED` | `accept()` (host-recorded, Open trade-off #1) | terminal for this row |
| `SENT` | `EXPIRED` | lazy: `validUntil < now()` at read time (see §4's identical lazy-expiry decision) | no write occurs until the row is next read/listed |
| `SENT` | *(new `DRAFT` row, `version + 1`)* | `reviseSend()` | old row: `status → EXPIRED`, `nextVersion` set; new row gets its own `shareToken` |
| `ACCEPTED` / `EXPIRED` | — | — | terminal in this Quote's own machine; a further correction is a new `Quote` row via `reviseSend()` |

### 4. InternalHold

```prisma
enum HoldStatus {
  ACTIVE
  RELEASED
  CONVERTED
}

model InternalHold {
  id String @id @default(uuid())

  campSiteId String
  campSite   CampSite @relation(fields: [campSiteId], references: [id])
  spotId     String?
  spot       Spot?    @relation(fields: [spotId], references: [id]) // null = whole-camp hold; mirrors Booking/BlockedDate camp-or-spot duality

  startDate DateTime @db.Date
  endDate   DateTime @db.Date // EXCLUSIVE checkout day — identical semantics to Booking.checkOutDate / BlockedDate.endDate, do not reinterpret as inclusive
  guests    Int      @default(1) // reserved capacity, summed into availability math exactly like Booking.guests

  note String?

  status    HoldStatus @default(ACTIVE)
  expiresAt DateTime   // lazily compared at read time — no cron ever flips this row (see justification below)

  leadId  String?
  lead    HostLead? @relation(fields: [leadId], references: [id])
  quoteId String?
  quote   Quote?    @relation(fields: [quoteId], references: [id])

  createdById String
  createdBy   User   @relation("HoldCreatedBy", fields: [createdById], references: [id]) // always a real host session — this route is never public

  bookingId String?  @unique // set once CONVERTED into a ManualStay Booking (§6)
  booking   Booking? @relation(fields: [bookingId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // no deletedAt: RELEASED/CONVERTED already capture "no longer active" without deleting the audit row

  @@index([campSiteId, startDate, endDate])
  @@index([spotId])
  @@index([status])
  @@index([leadId])
  @@index([quoteId])
}
```

**Availability integration — the concrete diff to `lib/campsite-availability.ts`:** `getCampSiteDailyAvailability` gains one additional per-day query, run the same way the existing `Booking` query and `getBlockedDatesForRange` call already are (no N+1, one query for the whole range):

```ts
// additive — same shape as the existing bookings query just above it
const holds = await prisma.internalHold.findMany({
  where: {
    campSiteId,
    status: 'ACTIVE',
    expiresAt: { gt: new Date() }, // lazy-expiry: an expired hold silently drops out of every read here — see justification below
    AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }],
  },
  select: { startDate: true, endDate: true, guests: true },
});
// same per-day accumulation loop as the Booking loop, writing into a NEW field:
//   availability[dateKey].heldGuests += hold.guests   (kept separate from bookedGuests — see below)
```

`availability[dateKey]` gains `heldGuests: number` **as a separate field from `bookedGuests`**, not merged into it — a host dashboard legitimately wants to show "5 confirmed + 2 on hold" as two numbers, and merging them would throw away information a real user-visible screen needs (this is exactly the same reasoning that already keeps `blockedByHost` as its own boolean next to `bookedGuests`/`bookedTents` in the existing shape). `getRemainingCapacity`'s bottleneck-night math changes from `capacity - bookedGuests` to `capacity - (bookedGuests + heldGuests)` — the *combined* number still drives what remains bookable, only the returned shape keeps the two counts separately labeled. This is a real code change for the M1.2 backend story, called out explicitly here so it isn't missed (Consequences, Negative).

**Lazy vs. cron expiry — decided: lazy, justified:** this codebase has **no existing scheduled-job infrastructure** (`vercel.json` has no `crons` entry, no cron precedent anywhere in the repo — confirmed by direct search, not assumed) — introducing one purely to flip a status column is new operational surface (a job to write, monitor, and alert on) for a solo-owner, pre-launch, "Lean" project (`CLAUDE.md` Iron Rule #6). Because `expiresAt` is read inside the **same query that already has to run** (availability, and any "list active holds" host view), the lazy predicate (`status = 'ACTIVE' AND expiresAt > now()`) costs nothing extra to compute and is **always correct at read time** — there is no window where a stale hold is wrongly counted, because nothing that counts holds ever omits the timestamp check. The cost: an `ACTIVE` hold whose `expiresAt` has passed sits in the table forever showing `status = ACTIVE` until (if ever) something re-reads it — a "zombie" row, cosmetically stale but functionally inert (excluded everywhere it matters). This is flagged explicitly as Open trade-off #3 rather than silently accepted, because a host looking directly at a raw export/report (not through the app's own queries) could be confused by an `ACTIVE` row that is actually expired.

**Double-hold prevention (ADR-006 lock semantics, reused, not reinvented):** `InternalHold.create()` must run inside a `prisma.$transaction(..., { isolationLevel: Serializable })` with the identical bounded-retry-on-`P2034` pattern `withBookingTransaction` already implements — reading **both** overlapping `Booking` rows and overlapping `InternalHold` rows for the target camp/spot/date range inside the transaction boundary before writing the new hold. This requires a transaction-scoped twin of `checkDateAvailabilityInTx` that also reads `InternalHold` (a real, scoped code addition for the M1.2 backend story — not a new concurrency *strategy*, the same one, extended to read one more table). Without this, two hosts (or, once M7.5 ships, a host racing a real platform booking) could both pass an unlocked read-check and double-reserve the same capacity — exactly the race ADR-006 closed for `Booking` alone.

**Transition table:**

| From | To | Trigger | Side effect |
|---|---|---|---|
| *(none)* | `ACTIVE` | `InternalHold.create()` | Serializable tx + bounded retry, as above |
| `ACTIVE` | `RELEASED` | `release()` (host cancels an unwanted hold) | terminal; stops counting immediately (no lazy delay needed — this is an explicit write) |
| `ACTIVE` | `CONVERTED` | side effect of the ManualStay `Booking` being created from this hold (§6) | terminal; `bookingId` set; stops counting — the real `Booking` row now occupies that capacity in the *same* query path, so there is no double-count window as long as both writes happen in one transaction (see §6) |
| `ACTIVE` (past `expiresAt`) | *(no write)* | lazy exclusion | see justification above; Open trade-off #3 |

### 5. DepositRecord

```prisma
enum DepositMethod {
  TRANSFER
  CASH
  PROMPTPAY_DIRECT
}

model DepositRecord {
  id String @id @default(uuid())

  // Flexible attachment across the funnel — not every deposit has all three;
  // service-layer rule: at least one of leadId/quoteId/holdId must be set at creation
  // (a walk-in still gets a HostLead row per the WALK_IN channel — see §1 — so in
  // practice leadId is close to always present, but the FK stays optional at the
  // schema level so a future edge case is never blocked by a NOT NULL).
  leadId String?
  lead   HostLead? @relation(fields: [leadId], references: [id])
  quoteId String?
  quote   Quote?    @relation(fields: [quoteId], references: [id])
  holdId  String?
  hold    InternalHold? @relation(fields: [holdId], references: [id])

  bookingId String?  // set once the ManualStay Booking is created (deposit usually precedes the stay row — see §6 funnel order)
  booking   Booking? @relation(fields: [bookingId], references: [id])

  amount    Decimal       @db.Decimal(12, 2) // [Financial]
  currency  String        @default("THB")    // [Financial] ISO 4217
  method    DepositMethod
  reference String?                          // [Financial] bank/transfer/PromptPay reference — free text, host-entered

  proofImages Image[] // reuses the existing polymorphic Image model + app/api/upload path verbatim — see extension below

  verifiedAt   DateTime?
  verifiedById String?
  verifiedBy   User?     @relation("DepositVerifiedBy", fields: [verifiedById], references: [id])

  voidedAt   DateTime?
  voidReason String?
  voidedById String?
  voidedBy   User?     @relation("DepositVoidedBy", fields: [voidedById], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // append-only ledger (mirrors Payment/Payout/AuditLog's documented convention in schema.prisma:
  // "Ledgers ... are append-only → NO soft-delete") — deliberately NO deletedAt

  @@index([leadId])
  @@index([quoteId])
  @@index([holdId])
  @@index([bookingId])
  @@index([verifiedById])
  @@index([voidedAt])
}
```

**Image reuse (no new upload path):** `app/api/upload` already returns a validated, size/magic-byte-checked blob URL and writes nothing itself — every existing consumer (`CampSite`, `Spot`, `Review`) then creates its own `Image` row pointing at that URL via a nullable FK **on `Image`**, never the other way around. `DepositRecord` follows the identical, already-proven convention: add one more nullable FK to the existing polymorphic `Image` model —

```prisma
model Image {
  // ...existing fields unchanged...
  depositRecordId String?
  depositRecord   DepositRecord? @relation(fields: [depositRecordId], references: [id], onDelete: Cascade)
  // ...existing relations unchanged...
  @@index([depositRecordId])
}
```

— rather than inventing a parallel proof-image mechanism. This also means a `DepositRecord` can carry more than one proof photo (front/back of a transfer slip) for free, with zero special-casing.

**No platform money custody — by design, no `Payment`/`Payout` linkage.** `DepositRecord` is deliberately **not** a row in the existing `Payment` ledger (which models money the *platform* processes through a gateway) — the host receives the money directly (bank transfer to the host's own account, cash in hand, or a PromptPay QR that pays the host, not the platform). `DepositRecord` is a **bookkeeping record of what the host says they received**, not a financial transaction the platform executes. This is a real, cross-cutting distinction worth stating once clearly: `PaymentMethod.PROMPTPAY` (existing enum, `Payment` model, gateway-custody, still deferred to M7.5) and `DepositMethod.PROMPTPAY_DIRECT` (new enum, `DepositRecord`, host-custody, live now) name the same rail but two different economic realities — do not merge these enums later without re-litigating the custody question.

**Void path — decided: append-only with a void-flag, not a `Payment`-style reversal row, justified:** `Payment` handles a real refund with a **separate reversing row** (`refundOfId` self-relation, `net = sum(charges) − sum(refunds)`) because a refund is itself a genuine money-movement event worth its own ledger line. A `DepositRecord` void is different in kind: it is a **correction to a bookkeeping entry** (the host mistyped the amount, chose the wrong method, or the "proof" turns out to be fraudulent) — no money actually moves back through the platform to reverse, because the platform never had it. Modeling a void as a second `DepositRecord` row pointing back at the first (mirroring `Payment.refundOfId`) would force every void to invent a fictitious matching amount/method just to "cancel it out," which is not atomic — it is a workaround stretched to fit a pattern that doesn't match the fact being recorded. Instead: the **original row is never edited or deleted** (true append-only, same as `Payment`/`Payout`/`AuditLog`'s documented rule) — the `amount`/`method`/`reference` a host originally entered stay forever as entered — and a mistake is recorded as an explicit **flip**: `voidedAt` + `voidReason` + `voidedById`. A voided row is excluded from any "confirmed deposits total" report by the query predicate `voidedAt IS NULL`, exactly the same shape as `deletedAt IS NULL` elsewhere in this schema, but semantically distinct (a void is a business fact — "this entry doesn't count" — not a housekeeping soft-delete). If the host needs to log the *correct* amount, they create a **new** `DepositRecord` row — never mutate the voided one.

**Audit:** every `DepositRecord` create and void must emit an `AuditLog{action: "deposit.recorded" | "deposit.voided", entityType: "DepositRecord", entityId, actorId, metadata}` row — the existing `AuditLog` model is already generic enough (`metadata Json?`) and needs no schema change.

### 6. ManualStay — reuse `Booking(source = MANUAL)` (recommended) vs. a separate model

**Recommendation: reuse `Booking`, adding a `source` discriminator, a nullable `userId`, and a nullable `leadId`.** Full comparative reasoning is in Alternatives (a); this section states the chosen design and its migration/rollback plan.

```prisma
enum BookingSource {
  PLATFORM
  MANUAL
}

model Booking {
  // ...all existing fields unchanged...

  source BookingSource @default(PLATFORM) // NEW

  userId String? // CHANGED: was `String` (required) — now nullable; null only when source = MANUAL
  user   User?   @relation(fields: [userId], references: [id]) // CHANGED: was `User` (required)

  leadId String?   // NEW — set only when source = MANUAL; traces the funnel origin
  lead   HostLead? @relation(fields: [leadId], references: [id])

  // ...all existing relations unchanged (campSite, spot, payments)...
  deposits DepositRecord[] // NEW back-relation — deposits recorded against this stay
  hold     InternalHold?   // NEW back-relation — the hold this stay converted from, if any

  // ...all existing timestamps/soft-delete/version unchanged...

  @@index([source]) // NEW
  @@index([leadId]) // NEW
  // ...all existing indexes unchanged...
}
```

**Why this requires almost no new *behavior*, only new *columns* — verified against the real code, not assumed:**

- **Availability math needs zero changes.** `getCampSiteDailyAvailability`'s `Booking` query already filters only on `status: { in: ['CONFIRMED', 'PENDING'] }` — it has no `source` predicate to add or forget. A `MANUAL` row created at `status: CONFIRMED` (see below) is summed into `bookedGuests` automatically, the moment it exists, with no code change to this function at all. This is the single strongest argument for reuse: the exact query this whole ADR is careful not to fork *cannot* fork here, because there is nothing source-specific to add to it.
- **The status default already fits.** `Booking.status` already defaults to `BookingStatus.CONFIRMED` in `schema.prisma` (line 475) — the platform POST route explicitly *overrides* this to `PENDING` at creation; a manual-stay service simply does **not** override it, and the row lands at `CONFIRMED` — matching the real-world fact that a manual stay backed by a recorded deposit is already host-confirmed, with no online-payment "pending" state to wait through. No enum change needed.
- **The crystallized snapshot fields are source-agnostic.** Every `snapshot*` column (ADR-005) is a frozen number/string with no structural assumption about *how* it was computed — a `MANUAL` stay populates the identical fields from the accepted `Quote`'s already-crystallized totals (or a host-typed override for a walk-in with no quote) instead of `computeBookingPrice`/`resolveUnitPrice`. The shape is reused verbatim; only the origin of the numbers differs, which is a service-layer concern, not a schema one.
- **`spotId?` is already optional** and needs no change — a manual stay against a specific spot or a whole-camp stay both already fit.

**What genuinely breaks, enumerated honestly (not glossed over):**

- **`Booking.userId` required → nullable is a real, traceable ripple**, not a free change. Grepped call sites that read `booking.user.<field>` directly and assume it is never `null`: `app/dashboard/page.tsx:281,283` and `app/dashboard/bookings/page.tsx:118,235,381,384,385` (the operator dashboard + bookings list), fed by `app/api/operator/dashboard/route.ts:74` (`include: { user: { select: { name: true, email: true } } }`) and the equivalent `include` in `app/api/operator/bookings/route.ts`. Every one of these must be updated to fall back through the guest identity available on a `MANUAL` row (e.g. a shared `resolveGuestDisplayName(booking)` helper: `booking.user?.name ?? booking.lead?.guestName ?? "ผู้เข้าพัก"`) — a bounded, mechanical fix (roughly 6–8 call sites, all cosmetic name/email display), but a real one that must ship as part of the same story that adds the column, not discovered later as a production `TypeError`.
- **Guest identity for a `MANUAL` row comes from `HostLead.guestName`/`guestContact` via `leadId`, not from a duplicated field on `Booking` itself.** Because `WALK_IN` is itself a `LeadChannel` value (§1), the funnel's own design intends that *even a walk-in gets a `HostLead` row first* — there is no "pure walk-in with zero funnel steps" case in this story's scope, so `leadId` being populated for every `MANUAL` `Booking` is a safe, service-enforced invariant (nullable at the schema level, because `PLATFORM` rows never have one; required-by-service-rule when `source = MANUAL`, the same "conditionally required, DB-nullable" pattern already implicit elsewhere in this schema). A host retroactively back-filling a historical stay with no lead at all is out of scope for M1.2 and not designed here.
- **`BookingStatus` semantics still technically "work," but the meaning of `PENDING` diverges by source** (online-payment-pending for `PLATFORM` vs. essentially unused for `MANUAL`, which starts at `CONFIRMED`) — worth a code comment at the point of creation, not a schema change.

**What a separate `ManualStay` model would have cost instead (the honest converse, expanded in Alternatives (a)):** a second, independent inventory source in `getRemainingCapacity` (a *third* leg, on top of the `InternalHold` leg this same ADR is already adding) — and, more concretely, a host-facing **unified stay calendar/dashboard mixing manual and (eventually) platform guests would require an application-level merge-sort across two Prisma models**, since Postgres/Prisma cannot do a single `ORDER BY createdAt LIMIT/OFFSET` across two heterogeneous tables — every future list/paginate/sort feature over "all stays" would carry this tax forever. Reuse avoids that tax entirely: one table, one query, one pagination path, for the price of the bounded ripple above.

**Migration plan (reversible; assessed for staging → prod per `.claude/rules/ops.md`):**

1. Add `enum BookingSource { PLATFORM, MANUAL }`.
2. Alter `Booking.userId` from `String` to `String?` (`ALTER COLUMN "userId" DROP NOT NULL`) — no data movement; every existing row already has a non-null `userId`.
3. Add `Booking.source BookingSource @default(PLATFORM)` — every existing row gets `PLATFORM` via the column default; **no backfill logic needed**.
4. Add `Booking.leadId String?` FK → `HostLead(id)` — ordering note: this migration must run in the same `prisma migrate dev` pass as the `HostLead` table creation (Prisma sequences `CREATE TABLE` before the FK-adding `ALTER TABLE` automatically within one migration; no manual ordering needed).
5. Add `@@index([source])`, `@@index([leadId])`.
6. **Low-stakes migration window:** because public/platform booking is itself deferred behind `BookingReadinessGate` (M7.5), there is **no real production platform-booking data at stake** for this change today — Staging may hold seed/test rows only. This is a materially safer time to take this schema risk than after real guest bookings exist.
7. **Rollback path:** drop `leadId`/`source` columns and re-add `SET NOT NULL` to `userId` — reversible **only if zero `MANUAL` rows exist at rollback time** (a `NOT NULL` re-add would fail against any row with `userId = null`). This caveat must be checked before any rollback is executed, and is the one place this migration is not unconditionally reversible — flagged explicitly rather than glossed over, per the architecture standard's migration-assessment requirement.
8. Test up → down → up on Staging before promoting, per `.claude/rules/ops.md`.

### 7. GuestProfile — deferred

**Decision: does not ship in M1.2-core.** The core funnel (`Lead → Quote → Hold → Deposit → Stay`) is fully expressible without it: guest identity for one visit lives on `HostLead.guestName`/`guestContact`, and `Booking.leadId` (§6) is the trace back to it — nothing in the M1.2 AC set requires recognizing the *same* guest across multiple separate visits/leads. Building `GuestProfile` now, with no confirmed consumer, would be exactly the premature-abstraction anti-pattern the architecture standard warns against (`.claude/rules/architecture.md` — "Lean > complete").

**One-paragraph sketch for the follow-up story that would ship it:** `GuestProfile { id, name String [PII], phone String? [PII], lineId String? [PII], tags String[], repeatCount Int, createdAt, updatedAt }`, with `repeatCount` **computed-on-the-fly** (COUNT of linked `HostLead`/`Booking` rows for this profile, cached with a derivation trail per architecture rule #12 — never a bare stored counter with no source), and an additive, nullable `HostLead.guestProfileId String?` linking a lead to a longer-lived identity once a host wants to say "this is the same person who came in March." Nothing in this ADR's design forecloses adding this later — the join point (`HostLead`) already exists and would only gain one nullable FK.

### 8. Deferred: POS, Rental, Daily Close (one-paragraph sketch each — not built this story)

**POS (point-of-sale).** A lightweight on-site sales ledger for firewood/gear/snacks sold independent of any `Lead`/`Booking` (a pure walk-up purchase with no stay attached). Sketch: `PosSale { id, campSiteId, lines PosSaleLine[], totalAmount, currency, method, soldById → User, createdAt }` + `PosSaleLine { id, saleId, description, quantity, unitAmount, lineTotal }`. Deferred because M1.2-core has no point-of-sale workflow yet (YAGNI); the append-only-ledger + Decimal/currency + `actorId` shape `DepositRecord` establishes in this ADR is exactly the pattern POS will inherit, so nothing here needs to be redesigned to accommodate it later.

**Rental.** Equipment (tents, chairs, coolers) checked out against a stay. Sketch: `RentalItem { id, campSiteId, name, dailyRateAmount, currency, quantityAvailable }` + `RentalAssignment { id, bookingId?, leadId?, rentalItemId, quantity, startDate, endDate, returnedAt? }`. Deferred; the `startDate`/`endDate` exclusive-checkout window shape already established for `Booking`/`BlockedDate`/`InternalHold` in this ADR is directly reusable, so a future `RentalAssignment` needs no new date-range convention invented.

**Daily Close.** An end-of-day cash/deposit reconciliation the host runs. Sketch: `DailyClose { id, campSiteId, closeDate @db.Date, expectedTotalAmount, countedTotalAmount, currency, varianceAmount, closedById → User, note, createdAt }` — deliberately a **snapshot** Set (a point-in-time "closing the books" document), not a live aggregate, because a daily close is itself a legitimate frozen record of a reconciliation event, unlike a cached rating average. Deferred; it will sum over exactly the ledger this ADR designs (`SUM(DepositRecord.amount) WHERE voidedAt IS NULL AND createdAt::date = closeDate`), which is precisely why the void-flag design (§5) — rather than delete or a fictitious reversal row — matters now: a future Daily Close's arithmetic is only trustworthy if voided entries are excluded by a clean predicate rather than physically missing or double-counted.

## Alternatives considered

### (a) ManualStay as a wholly separate model (`ManualStay`, not `Booking(source=MANUAL)`)

Considered seriously, given the task's own instruction to evaluate honestly rather than default to reuse. A dedicated `ManualStay { id, campSiteId, spotId?, leadId, checkInDate, checkOutDate, guests, status, snapshot* fields duplicated, ... }` model would avoid nullable `userId` entirely and keep the `Booking` table purely platform-shaped.

**Rejected, on balance, because:**

- **A third inventory-counting source, in the exact function this ADR is already careful not to fork twice.** `getRemainingCapacity` would need to read `Booking` (existing) + `InternalHold` (new, this ADR) + `ManualStay` (new, this alternative) — three sources to keep in lock-step forever, in a codebase that has already shipped two bugs from exactly this failure mode (CAM-190, CAM-267 — both "a query path forgot to check a second inventory source"). Reuse keeps it at two (`Booking` unified across sources + `InternalHold`).
- **No single, efficiently-paginated "all stays for this camp" view.** A host-facing operational calendar — the entire point of HostOS — wants one chronological, sortable, paginated list of stays regardless of origin. Two Prisma models cannot be `ORDER BY`/`LIMIT`/`OFFSET`'d together at the database level; every such feature would fetch-and-merge in application code, which does not scale past a small row count and is itself a second place "did we merge both sources correctly" bugs can hide.
- **The crystallized-snapshot column set would be duplicated wholesale** onto a second model for no behavioral gain (§6 already shows the snapshot shape is source-agnostic).

**What it would have avoided (fairly stated):** no nullable `userId` on the shared `Booking` table, and no ~6–8 call-site ripple for guest-name display fallbacks. This is real cost on the reuse side, acknowledged in §6, and is why this is flagged as an Open trade-off consideration (§ Open trade-offs, item 4) rather than a silent, unqualified win.

### (b) Quote: mutate-in-place vs. version-on-edit (immutable-resend)

Covered in full in §3. Rejected: mutate-in-place breaks the crystallization guarantee this exact ADR establishes for the same model one paragraph earlier — a `SENT` quote's price must not change under a guest who already opened the link, for the same reason a `CONFIRMED` booking's price must not change under ADR-005.

### (c) Ship `GuestProfile` in M1.2-core now

Rejected for now (§7) — no confirmed M1.2 AC consumer of cross-visit guest recognition; would be built speculatively. The join point is deliberately left open (`HostLead.guestProfileId`, additive) so this is cheap to add the moment a real story needs it.

### (d) Cron-based expiry for `InternalHold` (and, by the same reasoning, `Quote`)

Rejected for M1.2 (§4) — no existing scheduled-job infrastructure in this repo to build on; the lazy-read predicate is free (it rides on a query every consumer already has to run) and is always correct at the moment it matters, at the cost of a cosmetically stale row sitting inert until next read. Revisit if a host-facing "why does this still say ACTIVE" support complaint actually materializes (see Open trade-off #3).

### (e) HostOS models in a separate schema (delivery-ticket style, ADR-010 precedent)

Rejected — and deliberately not re-litigated at length, since the dispatch brief locks this: HostOS entities (`HostLead`, `Quote`, `DepositRecord`, the `ManualStay` extension) are genuine **product** data — guest-facing money-adjacent records and camp inventory — not internal dev-ops tooling metadata. ADR-010's strict-separation argument turns on delivery tickets being *internal* pipeline data with a different retention/compliance shape than customer data; HostOS data is customer/host-facing data by definition, so it belongs in the same compliance boundary (PDPA-scoped) as the rest of the product schema, not split out of it.

## Consequences

**Positive:**

- The single most correctness-sensitive piece of this codebase — "how much room is left" — gains exactly one new inventory source (`InternalHold`) and zero new sources for manual stays, because `ManualStay` is not a new table; both integrate through the one function (`getCampSiteDailyAvailability`) this ADR was written to protect from forking.
- The crystallization discipline ADR-005 established for `Booking` is extended, not reinvented, to `Quote` — a guest-facing price, once sent, cannot silently change, at the funnel stage where trust is arguably most fragile (a quote is the guest's first real number).
- `DepositRecord`'s append-only + void-flag design gives Daily Close (§8, deferred) a trustworthy sum to close the books against, without needing to be built now.
- Reuses three already-hardened pieces of infrastructure verbatim: the Image polymorphism + `/api/upload` path (proof images), the ADR-006 serializable-transaction pattern (double-hold prevention), and the existing generic `AuditLog` model (no schema change needed there at all).
- No new operational surface (no cron, no second database, no second Prisma client) — stays inside the existing product schema and the existing Lean 3-env flow.

**Negative / risks:**

- `Booking.userId` → nullable is a real, if bounded, ripple: ~6–8 grepped call sites (`app/dashboard/page.tsx`, `app/dashboard/bookings/page.tsx`, `app/api/operator/dashboard/route.ts`, `app/api/operator/bookings/route.ts`) must adopt a guest-display fallback before this ships, or they will throw on the first `MANUAL` row that reaches them.
- `getCampSiteDailyAvailability`/`getRemainingCapacity` need a real, scoped code change to add the `InternalHold` leg (§4) — not automatic, must be built and tested by the M1.2 backend story, with the exact same rigor (Serializable tx, bounded retry) ADR-006 required for `Booking`.
- `Quote`'s immutable-resend design means a lead with several corrected quotes accumulates several `Quote` rows — bounded in practice (quotes are revised rarely per lead), but a host-facing "history" view should filter to the current (`nextVersion == null`) row by default, or a lead's quote list will look cluttered.
- Lazy expiry (both `InternalHold.expiresAt` and `Quote.validUntil`) means a raw DB export or an ad-hoc report can show a stale `ACTIVE`/`SENT` row past its real expiry — cosmetically confusing outside the app's own queries, never a correctness bug inside them.
- `DepositRecord`'s flexible optional attachment (`leadId`/`quoteId`/`holdId`/`bookingId` all nullable) relies on a **service-layer** rule ("at least one must be set") rather than a DB constraint — a bug in that validation could create an orphaned deposit with no funnel trace; this is a known, accepted trade-off of keeping the FKs individually optional rather than forcing a rigid required chain that would block the legitimate walk-in-with-partial-history case.

## Open trade-offs — for the human to choose at G2

1. **Who is authorized to mark a `Quote` `ACCEPTED`?** This ADR defaults to **host-only** (the host records the guest's verbal/LINE/phone confirmation) rather than a guest self-service action on the public share-token link — safer (no new public-write endpoint, no IDOR-adjacent surface on an unauthenticated route) but slower for the guest and dependent on the host actually logging it promptly. If the owner wants a guest-facing "ยอมรับใบเสนอราคา" button on the public share view, that is a real, additive public-write endpoint with its own authz/abuse questions — confirm before T-2 builds either path.
2. **`Quote.EXPIRED` is overloaded** to mean both "time ran out" and "superseded by a `reviseSend()`", disambiguated only by the `previousVersion`/`nextVersion` chain at read time, to stay within the exact 4-status contract given for this story. If the owner wants a distinct 5th status (e.g. `SUPERSEDED`) for host-facing clarity, that is a one-value additive enum change — flagged now rather than silently decided.
3. **Lazy expiry (§4) vs. a future cron** for `InternalHold`/`Quote`. Default here is lazy (no new infra, always-correct-when-read). If the owner anticipates hosts directly inspecting raw data/reports (outside the app's own screens) and finds a stale-looking `ACTIVE`/`SENT` row confusing in that context, a lightweight cron to flip the status explicitly is a small, additive follow-up — not required for correctness, only for report-legibility.
4. **The `ManualStay`-as-`Booking(source=MANUAL)` recommendation itself (§6/Alternatives (a)).** This ADR recommends reuse and shows the concrete ripple (nullable `userId`, ~6–8 call-site guest-name fallbacks) as a bounded, one-time cost against the alternative's ongoing cost (a permanent second inventory-and-listing source). If the owner weighs the "keep `Booking` purely platform-shaped" value higher than this ADR does, a separate `ManualStay` model is the fallback path — flagged explicitly as a real choice, not a foregone conclusion, given the honesty this task specifically asked for.
5. **`GuestProfile` deferred (§7).** The task named `repeatCount` explicitly as a field it should carry; deferring it means M1.2-core hosts cannot yet see "this guest has stayed here before" anywhere. Confirm the owner is comfortable losing that signal for the M1.2 launch window before treating this as settled.
6. **Public web-inquiry abuse mitigation beyond IP rate-limiting** (captcha/honeypot/other) is not decided in this ADR (§1) — a security/product call, not a data-model one; flagged so it isn't silently skipped before the public `POST /api/hostos/leads` route ships.
7. **`DepositRecord`'s optional, non-enforced-at-DB attachment chain** (Consequences, Negative) — accepted here as the right trade-off for flexibility over rigidity, but the owner should be aware the guarantee "every deposit traces to a funnel stage" is a service-layer promise, not a schema-enforced one, and ask QA to specifically test the orphaned-deposit case before this ships.

## Links

- Blueprint v6 ratification: ADR-011 (PR #302, pending merge) — the HostOS-first pivot this ADR builds the data model for.
- Reuse points verified by direct read (not assumed): `lib/campsite-availability.ts` (`getCampSiteDailyAvailability`, `getRemainingCapacity`, `getBlockedDatesForRange`), `app/api/bookings/route.ts` (`withBookingTransaction`, `checkDateAvailabilityInTx`), `app/api/upload/route.ts` (image validation, no Prisma write of its own), `lib/rate-limit.ts` (`checkRateLimit`).
- `ADR-002-money-decimal-currency.md` — money = Decimal(12,2) + ISO-4217 currency, applied to `Quote`/`QuoteLine`/`DepositRecord`.
- `ADR-005-booking-snapshot.md` — crystallization pattern, extended to `Quote.send()` in §3.
- `ADR-006-booking-atomic-inventory-lock.md` — serializable-transaction + bounded-retry pattern, reused for `InternalHold.create()` in §4.
- `ADR-010-self-hosted-delivery-tickets.md` — state-machine-in-service-layer precedent (mirrored for `HostLead`/`Quote`/`InternalHold`); "no reopen of a terminal record, start a new one" precedent (mirrored for `HostLead.LOST`).
- `.claude/rules/architecture.md` — Atomic Data Framework (Pixel · Set · Buffet), Resolution Boundary test, compute-on-the-fly rule (§1's `HostLead.status` doubt-driven review; §3's Quote DRAFT-total handling).
- `.claude/rules/security.md` — share-token entropy/IDOR note (§3); public-endpoint rate-limiting (§1).
- `.claude/rules/ops.md` — reversible-migration + Staging-before-prod standard applied in §6's migration plan.
