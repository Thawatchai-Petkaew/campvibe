# CAM-646 — tech

Two agents worked this independently 2026-08-06. The diagnosis survived challenge; the first plan did not. What follows is the settled version — the orchestrator's decisions are in §Decisions and are not open.

## Confirmed facts

- `app/api/bookings/route.ts:222` — `tx.booking.create` inside `prisma.$transaction(…, {isolationLevel: Serializable})` (`:60-263`) with a recursive retry at `:267` (up to 4 attempts). Returns at `:355`. No audit write. The CAM-681 notification hook is post-commit at `:343-354`.
- `app/api/bookings/[id]/route.ts:90-93` — a bare `prisma.booking.update({where:{id}, data:{status}})`. **No transaction, no status precondition, no audit.** The booking was read at `:44`, outside any transaction. The CAM-682 hook is at `:100-118`.
- `AuditLog` (`prisma/schema.prisma:817-834`) is deployed (migration `20260621113624`) — **no migration needed**. `ipAddress`/`userAgent` are tagged `[PII]`. Ledgers are append-only with no soft-delete (`:726`).
- Writers today: exactly three (`holds/route.ts:88` in-tx, `zones/[zoneId]/route.ts:49` in-tx, `holds/[holdId]/route.ts:38` post-commit). **Readers: zero** — no `auditLog.find*`/`count`/`groupBy` anywhere in `app`, `lib`, `components`, `scripts`. The table currently holds **0 rows against 2,619 bookings**.
- Booking mutation surface is exactly these two routes (`booking.(create|update|updateMany|delete|deleteMany|upsert)` plus raw SQL, swept over `app/` and `lib/`). `app/api/operator/bookings/route.ts` is read-only.
- Booking carries **no free-text guest field** — the PII-free-by-construction argument holds.

## The finding that reshaped this story

The first plan proposed `prisma.$transaction([update, auditCreate])` on PATCH. **That writes an audit row that can be false.** The booking is read outside any transaction, the batch runs at the connection default (Read Committed, no `isolationLevel` passed), and the update has no status precondition. Two concurrent PATCHes both read `PENDING`, both commit, and `AuditLog` gets two append-only rows each claiming `from: 'PENDING'` for a transition that did not start there.

`AuditLog` has no soft-delete and no reader, so a wrong row can never be corrected or even noticed. For a story whose entire purpose is a trustworthy trail, that is worse than the gap being closed.

This is also a **real latent lost-update bug** independent of audit: today two concurrent status changes silently overwrite each other.

The repo already ships the correct idiom twice — `holds/[holdId]/route.ts` (`updateMany where {id, campSiteId, status:'ACTIVE'}`) and `zones/[zoneId]/route.ts` (`updateMany … deletedAt: null`).

## Decisions (orchestrator, 2026-08-06 — settled)

1. **PATCH only. The create side is OUT of scope**, carded separately. Reason: on POST nothing is destroyed — the Booking row already carries the actor (`userId`), the time (`createdAt`), the channel (`source`) and the full frozen price snapshot, and no app code hard-deletes it. A create-side audit row is near-duplicate metadata, yet it drives ~10 test-fixture rewrites and introduces a brand-new failure mode (an audit insert failure fails a camper's booking) on the hot money path inside a Serializable window. On PATCH, by contrast, `Booking.status` is overwritten **in place** — the previous status and the identity of whoever changed it are gone forever and recorded nowhere else. That is the defect.
2. **Compare-and-swap is required**, not optional. `updateMany({ where: { id, status: <the status read at :44> }, data: { status } })`; a count of 0 means someone else moved it → **409**. This is what makes the recorded `from` true. It is an additive contract change (a new error code), which `api.md` §12 permits.
3. **A no-op transition (`from === to`) returns 409 and writes nothing.** Recording it honestly was the alternative, but PATCH has **no rate limit** (POST has `booking:create` 20/min at `route.ts:295`), so honest recording turns an authenticated endpoint into unbounded append-only write amplification into a table with no reader, no retention job and no erasure path — any camper owning one booking could inflate it indefinitely.
4. **Also add a rate limit to PATCH**, as defence rather than as the only control.
5. **`actorRole` precedence is `admin` > `host` > `camper`**, matching CAM-682's established semantics: a host who booked their own camp satisfies `isCamper` AND `canHostUpdate`, and cancelling is a **host** action. That exact case is the single load-bearing test in `__tests__/cam-682-notify-host-on-cancel.test.ts`.
6. **No money in `metadata`.** It is `{from, to, campSiteId, actorRole}` — nothing else. This sidesteps the Decimal-into-Json trap entirely rather than managing it.
7. **`ipAddress` and `userAgent` stay null.** `AuditLog` is append-only with no erasure path; populating them would create an un-erasable PII store. Deliberate and dated.
8. **The audit write goes INSIDE the same transaction as the CAS update.** A trail that can be lost when the process dies between commit and write is not a trail. This is the deliberate inverse of the notification contract (CAM-681 returns 201 even when notification fails) — say so in the test name so a reader can see the difference is intended.

## Blast radius — corrected in both directions

**Needs NO change** (the first plan named them; they are wrong): `__tests__/cam-618-booking-status-paid.test.ts` has zero `vi.mock` calls, never imports PATCH at runtime, and is source-inspection only. `__tests__/cam-61-booking-detail.test.ts` imports the route but invokes GET only.

**Breaks totally**: `__tests__/cam-682-notify-host-on-cancel.test.ts`. Its prisma mock (`:58-67`) is deliberately minimal — `{booking:{findUnique,update}, campSiteTeamMember, notification}` — so `prisma.$transaction` is `undefined` → TypeError → the route's outer catch → 500 → every runtime test in the file goes red as a fake "route bug". It also pins the route's literal source at `:357` with `/if\s*\(status === 'CANCELLED' && isCamper && !canHostUpdate\)/`; hoisting an `actorRole` computation into that condition fails a source assertion inside a file named "notify-host-on-cancel". **Both must be handled in this PR.**

## Scope fence

`CAM-64` (Backlog) routes `COMPLETED`/`NO_SHOW` through **this same endpoint** (its AC-3/AC-5) and adds `GET /api/operator/bookings?status=NO_SHOW` (AC-10). **CAM-646 owns the endpoint's write shape** (CAS + the new 409). CAM-64's ACs describe the pre-change endpoint and must be re-authored — recorded on that ticket.

## Verification has no UI

`AuditLog` has zero readers, and `npm run db:sync-from-staging` is one-way staging→dev so it would not carry rows written on localhost. Self-verify must name the literal read command, or "verified" silently degrades to "the tests passed".
