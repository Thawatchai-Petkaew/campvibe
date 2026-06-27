---
linear: CAM-190
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: tech
owner: architect
status: In Progress
version: v1
updated: 2026-06-26
---
# Tech — AVAIL-1 GET availability counts BlockedDate (CAM-190)

## Boundary

```
guest browser
  └─ GET /api/campsites/[id]/availability?startDate=…&endDate=…
  └─ GET /api/campgrounds/[id]/availability?startDate=…&endDate=…
        └─ getCampSiteDailyAvailability (lib/campsite-availability.ts)   ← extend here
        └─ getBlockedDatesForRange (NEW helper, same file)               ← add here
              └─ prisma.blockedDate.findMany  (read-only, no tx needed)
```

Client → `/api/*` route → service (`lib/campsite-availability.ts`) → Prisma only.
No DB call from the client. No business logic in the route handler beyond
merging the two result sets and writing the response.

---

## Data model

No migration. `BlockedDate` already exists in `prisma/schema.prisma` (line 647–664):

```
model BlockedDate {
  id         String    @id @default(uuid())
  campSiteId String
  spotId     String?               -- null = whole-camp block
  startDate  DateTime  @db.Date
  endDate    DateTime  @db.Date
  reason     String?
  deletedAt  DateTime?             -- soft-delete guard
  ...
  @@index([campSiteId])
  @@index([spotId])
  @@index([startDate, endDate])
}
```

Classification: Public (no PII/Financial/Geo fields touched by this story).

Fields read by this story — Resolution Boundary test (all pass, no split needed):

| Field      | Type     | Classification | Use |
|------------|----------|----------------|-----|
| campSiteId | String   | Public         | filter to camp |
| spotId     | String?  | Public         | camp-level vs spot-level block |
| startDate  | DateTime | Public         | overlap predicate |
| endDate    | DateTime | Public         | overlap predicate |
| deletedAt  | DateTime?| Public         | soft-delete guard |
| reason     | String?  | Public         | optional — surfaced as `blockedReason` in output |

---

## BlockedDate predicate — exact match to write path (AC-1, Rules)

The booking write path defines the canonical BlockedDate filter at
`app/api/bookings/route.ts` lines 93–104:

```ts
// SOURCE OF TRUTH — app/api/bookings/route.ts lines 93–104 (CAM-57 / ADR-006)
const blockedDateFilter: Prisma.BlockedDateWhereInput = {
  campSiteId: data.campSiteId,
  deletedAt: null,
  OR: [
    { spotId: null },
    ...(data.spotId ? [{ spotId: data.spotId }] : []),
  ],
  AND: [
    { startDate: { lte: checkOut } },
    { endDate:   { gte: checkIn  } },
  ],
};
const blocked = await tx.blockedDate.findFirst({ where: blockedDateFilter });
```

The GET read path MUST use the IDENTICAL predicate shape.
The only difference: GET scans the full requested date range in one query
(not per-day), and does NOT run inside a Serializable transaction (GET is
read-only; the write-path tx is for conflict prevention on writes only).

**New helper — `getBlockedDatesForRange` in `lib/campsite-availability.ts`:**

```ts
/**
 * Returns BlockedDate rows that overlap [startDate, endDate] for the given
 * campSiteId, applying the IDENTICAL predicate used by the booking write path
 * (app/api/bookings/route.ts lines 93–104, CAM-57 / ADR-006).
 *
 * spotId: when provided, also includes spot-level blocks for that spot.
 * When omitted (campsite-level availability), only whole-camp blocks (spotId null) are returned.
 */
export async function getBlockedDatesForRange(
  campSiteId: string,
  startDate: Date,
  endDate: Date,
  spotId?: string
): Promise<{ startDate: Date; endDate: Date; reason: string | null }[]> {
  return prisma.blockedDate.findMany({
    where: {
      campSiteId,
      deletedAt: null,
      OR: [
        { spotId: null },
        ...(spotId ? [{ spotId }] : []),
      ],
      AND: [
        { startDate: { lte: endDate } },
        { endDate:   { gte: startDate } },
      ],
    },
    select: { startDate: true, endDate: true, reason: true },
  });
}
```

**Merge logic — extend `getCampSiteDailyAvailability`:**

After building the existing `availability` map from bookings, call
`getBlockedDatesForRange` for the same range and mark any day that falls
inside a BlockedDate row as `blocked: true`:

```ts
// After existing booking-based availability map is built:
const blockedRanges = await getBlockedDatesForRange(campSiteId, startDate, endDate);

for (const block of blockedRanges) {
  const cur = new Date(block.startDate);
  const blockEnd = new Date(block.endDate);
  while (cur <= blockEnd && cur <= endDate) {
    const dateKey = cur.toISOString().split('T')[0];
    if (availability[dateKey]) {
      availability[dateKey].blocked = true;
      availability[dateKey].blockedReason = block.reason ?? null;
    }
    cur.setDate(cur.getDate() + 1);
  }
}
```

The `availability` map entry type expands from:
```ts
{ bookedGuests: number; bookedTents: number }
```
to:
```ts
{
  bookedGuests:   number;
  bookedTents:    number;
  blocked:        boolean;         // new — host has blocked this day
  blockedReason:  string | null;   // new — optional host reason (may be null)
}
```

**Merged availability rule (the definition of "unavailable"):**

```
available = false  when:
  (maxGuestsPerDay && bookedGuests >= maxGuestsPerDay)
  OR (maxTentsPerDay && bookedTents >= maxTentsPerDay)
  OR blocked === true
```

---

## API contract

### `GET /api/campsites/[id]/availability`
### `GET /api/campgrounds/[id]/availability`

Both routes are structurally identical — the same change applies to both.

| Aspect | Value |
|--------|-------|
| Auth | Public for public campsites; authenticated (operator/admin) for non-public — existing logic unchanged (lines 45–50 of each route) |
| Input (query) | `startDate: ISO date string` · `endDate: ISO date string` — unchanged |
| Cache directive | `Cache-Control: no-store` — **add explicit header** (see below) |

**Output shape change — `availability[]` items gain two new fields:**

```ts
// Each day entry in the availability[] array
{
  date:             string;          // "YYYY-MM-DD"
  bookedGuests:     number;
  bookedTents:      number;
  maxGuests:        number | null;
  maxTents:         number | null;
  available:        boolean;         // false when full OR blocked
  remainingGuests:  number | null;   // unchanged — null when blocked (no capacity meaning)
  remainingTents:   number | null;   // unchanged
  // NEW:
  blockedByHost:    boolean;         // true when a BlockedDate covers this day
  blockedReason:    string | null;   // host's reason string, may be null
}
```

`available: false` is the single signal the calendar reads. `blockedByHost: true`
allows the UI to show a distinct visual state (e.g. "host has blocked this day")
vs capacity-full. Both are `available: false`; the distinction is in the
`blockedByHost` field — the calendar component decides what label to render.

**No Thai i18n key is needed in the API response.** The response carries the
`blockedByHost: boolean` signal; the UI layer maps it to the appropriate copy
(e.g. `t("availability.blocked")` vs `t("availability.full")`). If the backend
needs to expose a reason string to the guest, it reads `blockedReason` from the
DB row. No new i18n key is introduced by the API contract itself.

**Error codes:**

| Code | Meaning |
|------|---------|
| 400  | Missing / invalid `startDate` or `endDate` |
| 401  | N/A — public endpoint for public campsites |
| 403  | N/A — non-public campsites return 404 (no information-disclosure) |
| 404  | Campsite not found, or non-public campsite the session cannot view |
| 409  | N/A — read-only endpoint |
| 500  | Internal — generic message only; detail logged server-side |

Error shape (unchanged): `{ error: string }` from `apiError` in `lib/api-utils.ts`.

---

## No-store cache directive (AC: "availability always live")

`apiSuccess` in `lib/api-utils.ts` (line 23–27) sets **no** `Cache-Control` header.
Without an explicit directive, Next.js App Router may cache GET route responses
at the framework level, and a future CACHE-1 work could accidentally apply
caching to these routes.

**Change: add `export const dynamic = 'force-dynamic'` to both route files.**

This is the Next.js App Router mechanism that:
1. Opts the route out of static generation / build-time caching.
2. Ensures every request runs the handler live (equivalent to `Cache-Control: no-store`
   at the framework level).
3. Is explicit and grep-able — a future CACHE-1 story sees it immediately and
   knows not to cache this route.

Additionally, add a `Cache-Control: no-store` response header directly on
the `apiSuccess` call for the availability response, so the HTTP contract
is explicit regardless of any future framework wrapper:

```ts
// In both route files — replace the final apiSuccess call:
const response = apiSuccess({ campSiteId: id, availability: formatted, limits: { ... } });
response.headers.set('Cache-Control', 'no-store');
return response;
```

Both mechanisms together (route-level `force-dynamic` + explicit header) satisfy
the Rules requirement "ตั้ง no-store ชัดเจน" and are independently verifiable by QA
(check the `Cache-Control` header in the HTTP response).

---

## Concurrency verification (AC-2)

AC-2 ("สองคนจองช่องเต็มพร้อมกัน → คนหนึ่งสำเร็จ อีกคนเห็นว่าเต็มแล้ว") is a
**staging verification requirement**, not new code.

The booking write path already has:
- Serializable transaction wrapping all three checks + `booking.create`
  (`app/api/bookings/route.ts`, `withBookingTransaction`, `isolationLevel: Serializable`)
- P2034 retry with bounded backoff (up to 3 attempts)
- BlockedDate check inside the same transaction
- See ADR-006 (`docs/adr/ADR-006-booking-atomic-inventory-lock.md`)

AVAIL-1 adds no new concurrency code. AC-2 is satisfied by running the
staging concurrency test: two simultaneous POST /api/bookings requests for
the same campsite + overlapping dates where only one slot remains →
expected: one 201, one 409.

Backend must document the staging test result in the PR description.
QA asserts the 409 response body and the single DB row.

---

## Query strategy (no N+1)

`getCampSiteDailyAvailability` issues one `prisma.booking.findMany` for the
full date range — not one query per day. `getBlockedDatesForRange` issues one
additional `prisma.blockedDate.findMany` for the full range. Total: **2 Prisma
queries** per availability GET (plus the existing `prisma.campSite.findUnique`
= 3 queries total per request). No per-day loop at the DB layer.

Existing index `@@index([campSiteId])` + `@@index([startDate, endDate])` on
`BlockedDate` covers the new query. No new index needed.

---

## Migration

No migration. `BlockedDate` model exists with all required fields and indexes.
Reversibility: n/a (no schema change).

---

## ADRs

ADR-006 (`docs/adr/ADR-006-booking-atomic-inventory-lock.md`) — the Serializable
transaction strategy for the write path. Status: PROPOSED. This story does not
supersede it; AC-2 relies on it.

No new ADR required: the decision here (mirror the write-path predicate on the
read path; add `force-dynamic` + `no-store`) is straightforward with no viable
alternatives requiring a trade-off decision.

---

## Open questions / trade-offs for G2

None that block build. One informational note:

**`blockedReason` exposure to guests** — The `BlockedDate.reason` field is a
host-authored free-text string. Surfacing it directly in the API response
(`blockedReason: string | null`) means it could contain operator-internal notes
not intended for guests. If the product owner wants to hide the reason from
guests, the API should return `blockedReason: null` always (or omit the field).
Current design: expose it as-is (the field is already `Public` classification;
no PII). If the owner wants to hide it, the backend can null it out in the
response formatter with no schema change.

This is an **Info** — it does not block build. Raise with the owner if the
calendar UI wants to show the reason string to guests.

---

## Self-verify checklist (architect)

- [x] Compared against `prisma/schema.prisma` — no conflict; `BlockedDate` model exists at line 647
- [x] Every field traced to AC-1 (blocked days visible) and Rules (matching predicate)
- [x] No migration needed — model and indexes already exist
- [x] API contract: 2 routes updated; error codes complete; `available` field merges both signals
- [x] Authz: unchanged — existing visibility gate (lines 45–50 each route) covers both public/non-public
- [x] No N+1: 2 queries per request (booking range + blocked range), using existing indexes
- [x] No new ADR required; ADR-006 cited for AC-2
- [x] `force-dynamic` + `Cache-Control: no-store` header satisfies "no-store ชัดเจน" (Rules)
- [x] BlockedDate predicate is IDENTICAL to `app/api/bookings/route.ts` lines 93–104
- [x] AC-2 concurrency: staging verification, no new code

---

## Links

`story.md` (CAM-190) · `prisma/schema.prisma` lines 647–664 (BlockedDate) ·
`lib/campsite-availability.ts` (extend here) ·
`app/api/campsites/[id]/availability/route.ts` (add `force-dynamic` + `no-store`) ·
`app/api/campgrounds/[id]/availability/route.ts` (add `force-dynamic` + `no-store`) ·
`app/api/bookings/route.ts` lines 93–104 (predicate source) ·
`docs/adr/ADR-006-booking-atomic-inventory-lock.md`

---

## Changelog

- v1 (2026-06-26) — created (G2 technical design, architect)
