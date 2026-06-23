# ADR-006 — Booking atomic inventory lock: concurrency-control strategy

**Status:** PROPOSED · **Story:** CAM-57 · **Date:** 2026-06-23

## Context

`POST /api/bookings` currently runs three separate, unlocked queries:
1. `prisma.booking.findFirst` — overlap check for spot-level bookings.
2. `checkDateAvailability` (in a per-day loop) — capacity check via `getCampSiteDailyAvailability` (summing guest counts from `Booking` rows).
3. `prisma.booking.create` — write.

Because these run as independent round-trips with no transaction or lock, two concurrent requests for the same campsite and date window can both pass the read checks before either write lands — producing a double booking (overbooking race condition). This is the canonical read-modify-write race.

The capacity invariant (`maxGuestsPerDay`) has NO single inventory row to lock; the available capacity is derived at query time by summing `guests` across all active `Booking` rows for the target date range. There is no counter column to do a `SELECT FOR UPDATE` on.

The Vercel runtime is serverless (stateless, ephemeral functions) and the database is Postgres (Neon, likely in pgBouncer transaction-mode pooling). This constrains the advisory-lock option significantly (see Alternatives).

AC perf target: POST /api/bookings p95 < 1000ms at 50 concurrent requests (KPI from CAM-57).

## Decision

**Approach (a): Serializable isolation with bounded retry.**

Wrap all three checks plus the create in a single `prisma.$transaction(async (tx) => { ... }, { isolationLevel: 'Serializable' })`. On a Postgres serialization failure (error code `40001`, Prisma error code `P2034`), retry the entire transaction up to **3 times** with exponential backoff (50ms, 150ms, 300ms). After 3 failed retries, return HTTP 409 with the standard "Dates not available" error body so the caller retries or picks another date.

All three availability reads (`tx.booking.findFirst` for overlap, the adapted `checkDateAvailability(tx, ...)` for capacity, `tx.blockedDate.findFirst` for BlockedDate) execute inside the transaction boundary, reading a consistent snapshot. A concurrent transaction that commits a conflicting write will cause a serialization failure on the later transaction's commit — Postgres guarantees no phantom reads at this isolation level, which is exactly the invariant needed.

## Alternatives

### (b) Postgres advisory lock: `pg_advisory_xact_lock`

At transaction start, call `SELECT pg_advisory_xact_lock(hashtext($campSiteId || ':' || $checkIn))` via `tx.$queryRaw` to serialize all bookings for the same campsite+date key. Deterministic, no retries needed.

**Rejected for this story** because:
- Neon (the likely Postgres host) uses pgBouncer in **transaction-mode pooling** by default. Transaction-mode pgBouncer does not guarantee that sequential statements in a single session land on the same backend connection. Postgres advisory locks are session-scoped: if the advisory lock statement and the subsequent DML land on different backend connections (pgBouncer reassigns between statements), the lock has no effect. The Prisma `$transaction` interactive-transaction API holds a single connection for the duration, but this is documented to be incompatible with pgBouncer transaction mode — it requires either statement mode or a direct (non-pooled) connection URL. Using a direct URL for this single operation complicates the connection model without clear benefit over serializable isolation.
- The raw SQL call (`tx.$queryRaw`) in an otherwise Prisma-only codebase is an API surface that needs maintenance and documentation; the hash-collision risk on `hashtext` (though low) is a correctness concern.
- If the Postgres host is ever migrated or pooling mode changed, the advisory-lock path silently becomes no-op rather than failing safely.

Serializable isolation is handled entirely by Postgres without any raw SQL, and Prisma has first-class support for it.

### (c) `SELECT ... FOR UPDATE` on the CampSite row

Lock the CampSite row inside the transaction as a surrogate serialization point. Requires `tx.$queryRaw` (`SELECT id FROM "CampSite" WHERE id = $1 FOR UPDATE`). Simple but rejected because:
- It is maximally coarse: serializes ALL bookings for a campsite regardless of date, even bookings on completely non-overlapping date ranges.
- At 50 concurrent requests this creates a hot-row bottleneck directly proportional to overall booking volume, not just conflicting-date volume. This likely breaks the p95 < 1000ms target under contention.
- Requires raw SQL for a pattern that serializable isolation handles correctly without it.

## Consequences

**Positive:**
- Eliminates the overbooking race: Postgres guarantees that two concurrent transactions reading and writing the same `Booking` rows for overlapping dates cannot both commit — one will receive `40001` and be retried or rejected.
- No schema change (no migration). No new dependency.
- Prisma-native: no raw SQL, fully typed, works with any Postgres host regardless of pgBouncer mode (serializable isolation uses standard Postgres MVCC, not session state).
- Backward-compatible: HTTP status codes and response shapes are unchanged (409 on conflict, 201 on success).
- BlockedDate check is included in the same transaction — atomicity covers all three invariants.

**Negative / risks:**
- Retry adds latency on the conflicting path (up to ~500ms of backoff on the third retry before the 409 is returned). The non-conflicting happy path has no retry and the additional transaction overhead is a single round-trip Postgres context switch — expected well within the 1000ms p95 target.
- Serializable isolation increases lock overhead slightly versus `READ COMMITTED`. Under sustained high contention (many bookings for the same campsite on the same date), throughput will be lower than advisory locks — but this is the correct behavior (only one can succeed) and the retry budget caps the delay.
- The retry loop must be bounded and the final-attempt error must be correctly mapped to 409 (conflict), not 500 (server error), to avoid confusing the client.
- If Prisma changes its `P2034` error code, the retry guard must be updated. This is an implementation detail backend must test explicitly.
