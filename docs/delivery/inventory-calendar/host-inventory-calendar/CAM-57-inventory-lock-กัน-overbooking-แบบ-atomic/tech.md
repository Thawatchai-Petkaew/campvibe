---
linear: CAM-57
feature: inventory-calendar
epic: host-inventory-calendar (CAM-22)
artifact: tech
owner: architect
status: Backlog
version: v1
updated: 2026-06-23
---

# Tech spec — Inventory lock กัน overbooking แบบ atomic (CAM-57)

## Chosen approach: (a) Serializable isolation with bounded retry

**One-line rationale:** Serializable isolation is the only Prisma-native, pgBouncer-safe option that eliminates the race without raw SQL and without locking unrelated bookings.

See ADR-006 (`docs/adr/ADR-006-booking-atomic-inventory-lock.md`) for the full trade-off analysis against options (b) advisory lock and (c) CampSite-row FOR UPDATE.

---

## Trade-off table

| Criterion | (a) Serializable + retry | (b) Advisory lock | (c) CampSite FOR UPDATE |
|---|---|---|---|
| Eliminates overbooking race | Yes | Yes | Yes |
| Prisma-native (no raw SQL) | Yes | No — needs `$queryRaw` | No — needs `$queryRaw` |
| pgBouncer transaction-mode safe | Yes | **No** — session lock lost if backend reassigned | Yes (row-level, not session) |
| Granularity | Per-overlapping-date set | Per campsite+date key | Per campsite (coarse) |
| Retry needed | Yes (bounded, 3x) | No | No |
| Raw SQL maintenance risk | None | Yes (`hashtext`, collision) | Yes (`SELECT FOR UPDATE`) |
| Blocking unrelated bookings | No | No (if keyed correctly) | Yes — all dates |
| Under 50-concurrent load (p95 target) | Conflict path ~500ms max (retry); happy path minimal overhead | Deterministic but incompatible with pgBouncer | High contention on hot campsite row |

---

## Transaction shape (pseudo-code for backend)

Backend implements this in `app/api/bookings/route.ts`. Do NOT change `lib/validations/booking.ts`.

```
POST /api/bookings handler:

1. requireAuth() → session or return 401
2. bookingSchema.safeParse(body + { userId: session.user.id }) → parsed or return 400
3. Run withBookingTransaction(parsed) → result
4. On result.type === 'conflict'  → return apiError('Dates not available', 409, result.detail)
                                      OR apiError('Capacity exceeded', 409, result.detail)
                                      OR apiError('Dates not available', 409, result.detail)  [BlockedDate]
   On result.type === 'not_found' → return apiError('Camp site not found', 404)
   On result.type === 'error'     → return apiError('Failed to create booking', 500, result.cause)
   On result.type === 'ok'        → return apiSuccess(serializeDecimals(result.booking), 201)


async function withBookingTransaction(data, attempt = 1): Promise<Result> {
  try {
    return await prisma.$transaction(async (tx) => {

      // --- Check 1: Spot overlap (only if spotId provided) ---
      if (data.spotId) {
        const overlap = await tx.booking.findFirst({
          where: {
            campSiteId: data.campSiteId,
            spotId: data.spotId,
            status: { not: 'CANCELLED' },
            AND: [
              { checkInDate: { lt: checkOut } },
              { checkOutDate: { gt: checkIn } },
            ],
          },
        });
        if (overlap) {
          return { type: 'conflict', detail: 'Selected dates overlap with an existing booking.' };
        }
      }

      // --- Check 2: Daily capacity (for each day in range) ---
      for each day d from checkIn to checkOut (exclusive) {
        const capacityResult = await checkDateAvailabilityInTx(
          tx,
          data.campSiteId,
          d,
          data.guests,
        );
        if (!capacityResult.available) {
          return { type: 'conflict', detail: `Date ${d}: ${capacityResult.reason}` };
        }
      }

      // --- Check 3: BlockedDate (conditional — guard with try/catch or feature flag) ---
      // BlockedDate model exists in schema (confirmed in prisma/schema.prisma).
      // Guard: only run this check; if tx.blockedDate is unavailable at runtime, skip.
      const blocked = await tx.blockedDate.findFirst({
        where: {
          campSiteId: data.campSiteId,
          deletedAt: null,
          AND: [
            { startDate: { lte: checkOut } },
            { endDate:   { gte: checkIn  } },
          ],
          // spotId: data.spotId ?? undefined  ← optionally tighten to spot-level blocks
        },
      });
      if (blocked) {
        return { type: 'conflict', detail: 'Selected dates are blocked by the host.' };
      }

      // --- Fetch campSite for pricing (inside tx for snapshot consistency) ---
      const campSite = await tx.campSite.findUnique({
        where: { id: data.campSiteId },
        include: { spots: true, location: { include: { countryRel: true } } },
      });
      if (!campSite) return { type: 'not_found' };

      // --- Price computation (unchanged logic from existing handler) ---
      // ... resolveUnitPrice, computeBookingPrice, etc. (identical to current code) ...

      // --- Create booking ---
      const booking = await tx.booking.create({ data: { ...all fields as today... } });

      return { type: 'ok', booking };

    }, { isolationLevel: 'Serializable' });  // <-- the key change

  } catch (err) {
    // Postgres serialization failure: error code P2034 / Postgres code 40001
    if (isPrismaSerializationError(err) && attempt <= 3) {
      await sleep(50 * attempt);  // 50ms, 100ms, 150ms
      return withBookingTransaction(data, attempt + 1);
    }
    // All other errors (timeout, network, etc.) → let the outer handler catch and 500
    throw err;
  }
}

function isPrismaSerializationError(err: unknown): boolean {
  // Prisma wraps PG error code 40001 as P2034
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2034'
  );
}
```

**Important:** The retry is a tail-recursive / looped call. It must NOT be an infinite loop. Cap is exactly 3 attempts (attempts 1, 2, 3). On the 4th call path (attempt 4 > 3), throw and let the outer handler return 500. The 3-attempt cap is conservative — in practice a serialization failure on an un-conflicting booking will succeed on retry 1. If after 3 retries it still fails, it IS a real conflict (same campsite+dates, heavy contention) → 409 is the correct outcome.

---

## `lib/campsite-availability.ts` change (backward-compatible)

The existing `checkDateAvailability` and `getCampSiteDailyAvailability` functions use the top-level `prisma` client directly. They cannot be called inside a `$transaction` block because the `tx` client is a different object — any query using `prisma` instead of `tx` will run OUTSIDE the serializable transaction and defeat the lock.

**Required change:** Extract a new inner function `checkDateAvailabilityInTx` (or refactor via an optional `client` parameter) that accepts a Prisma transaction client.

### Option A — new `InTx` function (preferred, minimal risk)

```typescript
// lib/campsite-availability.ts

// EXISTING functions unchanged — callers on GET availability still work.
export async function getCampSiteDailyAvailability(...) { /* unchanged */ }
export async function checkDateAvailability(...) { /* unchanged */ }

// NEW: transactional variant used only inside prisma.$transaction
// tx is Prisma.TransactionClient (the type Prisma passes into the $transaction callback)
export async function checkDateAvailabilityInTx(
  tx: Prisma.TransactionClient,
  campSiteId: string,
  date: Date,
  requestedGuests: number,
  requestedTents?: number,
): Promise<{ available: boolean; reason?: string }> {
  const campSite = await tx.campSite.findUnique({
    where: { id: campSiteId },
    select: { maxGuestsPerDay: true, maxTentsPerDay: true },
  });
  if (!campSite) return { available: false, reason: 'Camp site not found' };

  const dateKey = date.toISOString().split('T')[0];
  // Replicate getCampSiteDailyAvailability logic inline using tx:
  const bookings = await tx.booking.findMany({
    where: {
      campSiteId,
      status: { in: ['CONFIRMED', 'PENDING'] },
      AND: [{ checkInDate: { lte: date } }, { checkOutDate: { gte: date } }],
    },
    select: { checkInDate: true, checkOutDate: true, guests: true },
  });

  let bookedGuests = 0;
  let bookedTents  = 0;
  for (const b of bookings) {
    // Date arithmetic identical to getCampSiteDailyAvailability
    const d = new Date(b.checkInDate);
    while (d < new Date(b.checkOutDate)) {
      if (d.toISOString().split('T')[0] === dateKey) {
        bookedGuests += b.guests;
        bookedTents  += Math.ceil(b.guests / 2);
      }
      d.setDate(d.getDate() + 1);
    }
  }

  if (campSite.maxGuestsPerDay && bookedGuests + requestedGuests > campSite.maxGuestsPerDay) {
    return {
      available: false,
      reason: `Exceeds maximum guests per day (${campSite.maxGuestsPerDay})`,
    };
  }
  if (campSite.maxTentsPerDay && requestedTents) {
    const estimatedTents = Math.ceil(requestedGuests / 2);
    if (bookedTents + estimatedTents > campSite.maxTentsPerDay) {
      return {
        available: false,
        reason: `Exceeds maximum tents per day (${campSite.maxTentsPerDay})`,
      };
    }
  }
  return { available: true };
}
```

**Why Option A and not a shared `client` param on the existing function:**
Changing the signature of `checkDateAvailability` (adding a required `client` param) would break `getCampSiteDailyAvailability`'s callers and any GET-availability routes that currently call it. Option A is strictly additive — the existing exports remain byte-for-byte identical and their callers are unaffected. The new `InTx` variant is used only inside the POST transaction.

---

## HTTP mapping (unchanged contract — AC-5)

The response body shape and HTTP status codes are **byte-for-byte backward compatible**. No field added or removed from the 201 success body. Error strings are the same strings the frontend already reads:

| Condition | HTTP | Error string (existing, unchanged) |
|---|---|---|
| Spot overlap detected inside tx | 409 | `'Dates not available'` · detail: `'Selected dates overlap with an existing booking.'` |
| Capacity exceeded inside tx | 409 | `'Capacity exceeded'` · detail: `'Date YYYY-MM-DD: Exceeds maximum guests per day (N)'` |
| BlockedDate detected inside tx | 409 | `'Dates not available'` · detail: `'Selected dates are blocked by the host.'` |
| Camp not found inside tx | 404 | `'Camp site not found'` |
| All 3 retries exhausted on P2034 | 409 | `'Dates not available'` · detail: `'Selected dates are unavailable (conflict). Please try again.'` |
| Any other unhandled error | 500 | `'Failed to create booking'` |
| Validation failed | 400 | `'Validation Error'` + zod field errors |
| Not authenticated | 401 | (from `requireAuth`) |
| (403 not applicable to this POST — no ownership on create) | — | — |

Note on 409 vs 500 after retry exhaustion: Returning 409 (not 500) after 3 retries is correct. A serialization failure after 3 attempts means a genuine conflict existed for those dates. 500 would imply a server fault; 409 correctly signals that the client should choose different dates.

---

## BlockedDate check — conditional guard

The `BlockedDate` model is confirmed present in `prisma/schema.prisma` (lines 634–651). The check is unconditional — no feature flag needed. The `spotId` filter on BlockedDate is optional; the check as designed catches whole-camp blocks (`spotId IS NULL`) and, if `data.spotId` is provided, the backend should also match spot-level blocks:

```
OR: campSiteId = data.campSiteId AND (spotId IS NULL OR spotId = data.spotId)
    AND overlap dates
    AND deletedAt IS NULL
```

Prisma equivalent:

```typescript
await tx.blockedDate.findFirst({
  where: {
    campSiteId: data.campSiteId,
    deletedAt: null,
    OR: [
      { spotId: null },
      { spotId: data.spotId ?? undefined },
    ],
    AND: [
      { startDate: { lte: checkOut } },
      { endDate:   { gte: checkIn  } },
    ],
  },
});
```

---

## Migration

**None.** This change is entirely in application code (`app/api/bookings/route.ts`, `lib/campsite-availability.ts`). No new columns, no new tables, no Prisma schema change. `npx prisma migrate dev` produces an empty migration — backend should confirm this before opening the PR.

---

## Performance note

- **Happy path (no conflict):** The additional cost is a single Postgres serializable transaction context. Postgres MVCC handles serializable reads with predicate locks (not pessimistic row locks), so non-conflicting concurrent bookings for different date ranges on the same campsite do NOT block each other. Expected overhead: negligible (<5ms per request) on the non-conflicting path.
- **Conflict path:** At most 3 retries × ~50–150ms backoff = ~300–500ms before 409 is returned. This is within the 1000ms p95 target because the conflict path is expected to be a small minority of traffic.
- **Serialization abort rate:** Under 50 concurrent requests for the same campsite+date window, most will succeed on first attempt (only one succeeds per window) or immediately abort on the read phase (no wasted write round-trip). This is efficient.
- **Query within tx:** The campSite fetch (for pricing) moves inside the transaction in the redesigned handler. This is one additional query per transaction — not a new N+1, as it replaces the existing outer `prisma.campSite.findUnique` call.
- **N+1 note:** `checkDateAvailabilityInTx` runs one `tx.booking.findMany` per day in the booking range. For a 7-night booking this is 7 queries inside the transaction. This is unchanged from the current behavior (the existing code also loops per day). Future optimization (batching all days into a single query grouped by date) is out of scope for this story.

---

## QA concurrency test guidance

QA must verify that two concurrent requests for the same campsite+spot+dates produce exactly one 201 and one 409, with no double booking in the database.

**Deterministic simulation method:**
1. Seed a campsite with `maxGuestsPerDay = 2` and a spot.
2. Fire two simultaneous HTTP POST requests (e.g. with `Promise.all` or `k6`/`wrk`) to `POST /api/bookings` with identical `campSiteId`, `spotId`, `checkInDate`, `checkOutDate`, `guests: 2`.
3. Assert: exactly one response is `201` and exactly one is `409`.
4. Query the database: `SELECT COUNT(*) FROM "Booking" WHERE "campSiteId" = $1 AND status != 'CANCELLED'` — must equal 1.
5. Repeat 10 times to confirm no flakiness (race windows are narrow; a non-atomic implementation will pass occasionally by luck).

**Unit test (retry path):** Mock `prisma.$transaction` to throw `PrismaClientKnownRequestError` with `code: 'P2034'` on the first two calls and succeed on the third. Assert the booking is created on attempt 3. Assert that a throw on all three calls results in HTTP 409, not 500.

**Integration test (BlockedDate):** Create a BlockedDate for the campsite covering the booking dates. Assert POST returns 409 (not 201). Assert no Booking row is created.

---

## Files backend must change

| File | Change |
|---|---|
| `app/api/bookings/route.ts` | Wrap all checks + create in `prisma.$transaction(..., { isolationLevel: 'Serializable' })`; add bounded retry on `P2034`; call `checkDateAvailabilityInTx` instead of `checkDateAvailability`; move campSite fetch inside tx; add BlockedDate check inside tx |
| `lib/campsite-availability.ts` | Add new exported function `checkDateAvailabilityInTx(tx, campSiteId, date, requestedGuests, requestedTents?)` — additive only, no changes to existing exports |

**Do not change:** `lib/validations/booking.ts` (per AC Rules), `schema/api-schema.json` response shape, existing error strings.

---

## ADR reference

`docs/adr/ADR-006-booking-atomic-inventory-lock.md` — PROPOSED, CAM-57, 2026-06-23.

---

## Implementation (backend, 2026-06-23)

### Final transaction shape

All five logical steps execute inside a single `prisma.$transaction(async (tx) => { ... }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })` call, extracted into the helper `withBookingTransaction(data, checkIn, checkOut, userId, attempt)`:

1. Spot-overlap check: `tx.booking.findFirst({ where: { campSiteId, spotId, status: { not: 'CANCELLED' }, AND: [{ checkInDate: { lt: checkOut } }, { checkOutDate: { gt: checkIn } }] } })` — returns `{ type: 'conflict', message: 'Dates not available', detail: 'Selected dates overlap with an existing booking.' }` on hit.
2. Daily capacity loop: for each day from `checkIn` to `checkOut` (exclusive), calls `checkDateAvailabilityInTx(tx, campSiteId, date, guests)` — returns `{ type: 'conflict', message: 'Capacity exceeded', detail: 'Date YYYY-MM-DD: Exceeds maximum guests per day (N)' }` on first failed day.
3. BlockedDate check: `tx.blockedDate.findFirst({ where: { campSiteId, deletedAt: null, OR: [{ spotId: null }, { spotId: data.spotId }], AND: [{ startDate: { lte: checkOut } }, { endDate: { gte: checkIn } }] } })` — returns `{ type: 'conflict', message: 'Dates not available', detail: 'Selected dates are blocked by the host.' }` on hit.
4. `campSite` fetch (for pricing): `tx.campSite.findUnique(...)` inside the transaction (moved from pre-tx outer query) — returns `{ type: 'not_found' }` if absent.
5. `tx.booking.create(...)` with all snapshot fields identical to the previous handler — returns `{ type: 'ok', booking }`.

### Bounded retry

```typescript
} catch (err) {
  if (isSerializationError(err) && attempt <= 3) {
    await sleep(50 * attempt); // 50ms, 100ms, 150ms
    return withBookingTransaction(data, checkIn, checkOut, userId, attempt + 1);
  }
  if (isSerializationError(err)) {
    // All 3 retries exhausted → genuine conflict → 409, not 500
    return { type: 'conflict', message: 'Dates not available', detail: 'Selected dates are unavailable (conflict). Please try again.' };
  }
  throw err; // any other error → outer catch → 500
}
```

`isSerializationError` checks `err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034'`. Cap is exactly 3 attempts (attempt 1, 2, 3); after exhaustion the function returns a `conflict` result (409), not an unhandled throw.

### `checkDateAvailabilityInTx` signature

```typescript
export async function checkDateAvailabilityInTx(
  tx: Prisma.TransactionClient,
  campSiteId: string,
  date: Date,
  requestedGuests: number,
  requestedTents?: number
): Promise<{ available: boolean; reason?: string }>
```

Added to `lib/campsite-availability.ts` as a strictly additive export. The existing `getCampSiteDailyAvailability` and `checkDateAvailability` exports are byte-for-byte unchanged — all GET-availability callers are unaffected.

### Response contract confirmation (AC#5)

- `201` success: `apiSuccess(serializeDecimals(result.booking), 201)` — identical body shape, all snapshot fields.
- `409` conflict: `apiError(result.message, 409, result.detail)` — same three detail strings the frontend already shows.
- `404` not found: `apiError('Camp site not found', 404)` — unchanged.
- `400` validation: `apiError('Validation Error', 400, validation.error.format())` — unchanged.
- `401` unauthenticated: unchanged (from `requireAuth` and `userId` guard).
- `500` other error: `apiError('Failed to create booking', 500, error)` — unchanged.
No field added or removed from the 201 body.

### BlockedDate guard

The `BlockedDate` model is confirmed present in `prisma/schema.prisma` (lines 634–651). The check is unconditional (no feature flag). The `OR: [{ spotId: null }, { spotId: data.spotId }]` filter catches whole-camp blocks and spot-level blocks for the requested spot.

### Migration

None — no schema change. `npx prisma migrate dev` produces an empty migration (confirmed).

### Self-verify results (2026-06-23)

- `npm run lint`: pass (only pre-existing warnings in unchanged files; the GET handler `request` unused warning on line 244 is pre-existing).
- `npm run typecheck`: pass (clean, 0 errors).
- `npm test`: 40 test files, 2221 tests — all passed.
