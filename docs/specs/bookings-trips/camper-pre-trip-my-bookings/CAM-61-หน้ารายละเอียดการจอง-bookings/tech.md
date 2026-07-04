---
linear: CAM-61
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
persona: camper
artifact: tech
owner: backend-engineer
status: In Progress
version: v1
updated: 2026-06-23
---
# Tech — หน้ารายละเอียดการจอง /bookings/[id] (CAM-61)

## GET /api/bookings/[id]

### Path + Method

```
GET /api/bookings/[id]
```

### Auth

`requireAuth()` — returns `401` if no valid session.

### Authorization + owner-scope (no existence leak)

The handler calls `getOwnedBooking(id, session.user.id)` which runs:

```prisma
booking.findFirst({ where: { id, userId } })
```

If the booking does not exist **or** belongs to a different user the query returns `null`.
The handler maps `null → 404` in both cases — the same error shape and status code in both cases.
There is no `403` on this endpoint: a split `403` vs `404` would reveal to the caller
that a booking with that id exists. (CAM-61 AC#7 / Rules "no existence leak".)

Operator and admin access to other users' booking detail is **out of scope** for this story.

### Request

No request body. `id` is the route param.

### Response — 200 OK

`apiSuccess(booking)` wraps the result in `serializeDecimals` (via `apiUtils.apiSuccess`)
so `totalPrice` (Prisma `Decimal`) is serialized as a `number`.

```ts
{
  id: string
  checkInDate: Date
  checkOutDate: Date
  guests: number
  totalPrice: number        // Decimal serialized → number
  currency: string          // ISO 4217
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
  createdAt: Date
  userId: string
  campSite: {
    nameTh: string
    nameEn: string | null
    checkInTime: string
    checkOutTime: string
    phone: string | null
    lineId: string | null
    images: { url: string; sortOrder: number }[]   // ordered by sortOrder ASC
    location: { province: string | null }
  }
  spot: {
    name: string
    zone: string | null
  } | null
}
```

### Error-code set

| Code | Condition |
|------|-----------|
| `401` | No valid session (`requireAuth` returns error) |
| `404` | Booking not found **or** booking belongs to another user (same response, no existence leak) |
| `500` | Unexpected server error (safe generic message; details logged server-side only) |

---

## Shared helper — `getOwnedBooking`

### Location

`/lib/bookings.ts`

### Signature

```ts
async function getOwnedBooking(
  id: string,
  userId: string
): Promise<OwnedBookingResult | null>
```

Where `OwnedBookingResult` is inferred from the Prisma `select` (booking fields + campSite
subselect + spot subselect). Returns `null` when the booking does not exist or `userId`
does not match.

### Why it is a separate helper

- **Single definition of authz + includes** — the GET route handler and the Server Component
  SSR fetch both use exactly the same query. No risk of the page bypassing ownership or
  missing a relation.
- **Pure data, no `NextResponse`** — the function has no dependency on `next/server`, making
  it directly callable from a Next.js Server Component (`app/bookings/[id]/page.tsx`) without
  wrapping in `fetch`.

### Frontend must reuse this helper

The Server Component page (`app/bookings/[id]/page.tsx`) **must call `getOwnedBooking`
directly** rather than fetching its own endpoint via `fetch`, so the authz + include
definitions stay in one place. Pattern:

```ts
// app/bookings/[id]/page.tsx (Server Component — illustrative, not authored here)
import { getOwnedBooking } from '@/lib/bookings';
import { auth } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const booking = await getOwnedBooking(params.id, session.user.id);
  if (!booking) notFound();   // renders the not-found / forbidden 404-style state

  return <BookingDetailClient booking={booking} />;
}
```

---

## Cancel flow

Cancellation uses the **existing** `PATCH /api/bookings/[id]` endpoint — no new endpoint
needed. The Client Component sends:

```ts
PATCH /api/bookings/[id]
{ status: 'CANCELLED' }
```

The PATCH handler already validates that a Camper can only set status to `CANCELLED`.

---

## Migration

None — no schema changes. This story is read-only backend work (GET handler + helper).

---

## No-N+1 confirmation

`getOwnedBooking` issues a single `findFirst` query with nested `select` for `campSite`
(including `images` and `location`) and `spot`. No per-row loops.

---

## QA targets

- GET 200: authenticated Camper, own booking → full response shape with campSite + spot relations.
- GET 404 (not found): valid auth, booking id does not exist → `{ error: "Booking not found" }`.
- GET 404 (no-leak): valid auth, booking exists but belongs to another user → same `404` as above.
- GET 401: no session → `{ error: "Unauthorized" }`.
- Decimal serialization: `totalPrice` in the response is a `number`, not a Prisma Decimal string.

## Security targets

- Ownership check: confirm `where: { id, userId: session.user.id }` is the actual DB filter
  (not a post-fetch JS check).
- No existence leak: confirmed same 404 for missing vs wrong-owner booking.
- No PII in error responses: 404/500 messages are generic; details logged server-side only.
- No PATCH handler touched: existing authz logic unchanged.

---

## Frontend — SSR-i18n Island (CAM-61, added 2026-06-23)

### Files

| File | Role |
|---|---|
| `app/bookings/[id]/page.tsx` | Server Component; calls `auth()` + `getOwnedBooking`; serializes Decimal/Date; passes props to `BookingDetailClient` |
| `app/bookings/[id]/BookingDetailClient.tsx` | `"use client"` island; renders full detail card, cancel AlertDialog, and toast feedback; reads i18n via `useLanguage()` |
| `app/bookings/[id]/loading.tsx` | Next.js loading segment; skeleton matching detail-card layout (AC#9) |
| `app/bookings/[id]/not-found.tsx` | `"use client"` 404-style page; handles both missing id (AC#10) and wrong-owner (AC#7) — same UI, no existence leak |

### SSR fetch — why `getOwnedBooking` directly

The Server Component calls `getOwnedBooking(id, session.user.id)` from `lib/bookings.ts` directly (no HTTP `fetch`).
This keeps the authz + include definitions in one place (backend helper) and avoids an extra network round-trip.
Pattern mirrors `app/bookings/[id]/confirmation/page.tsx` (CAM-59) which also calls Prisma inside a Server Component.

### Serialization contract

`Date` fields → `.toISOString()` · `Decimal totalPrice` → `Number(...)`.
The client component (`BookingDetailClient`) receives plain serializable types only — no Prisma `Decimal` or `Date` objects cross the Server→Client boundary.

### Cancel flow

1. Camper taps "ยกเลิกการจอง" → `AlertDialog` opens.
2. Confirm tap → `PATCH /api/bookings/[id]` `{ status: 'CANCELLED' }`.
3. **Success**: `toast.success(t.bookings.bookingCancelledSuccess)` + `setBooking(prev => ({ ...prev, status: 'CANCELLED' }))` → badge updates to "ยกเลิกแล้ว" + cancel button disappears (no page reload, AC#5).
4. **Error**: `toast.error(t.bookings.errorOccurred)` + status unchanged (AC#6).
5. During PATCH: button shows `Loader2` spinner + is `disabled` (prevents double-submit).

### Thai พ.ศ. date format

`new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })`
Produces "5 ม.ค. 2568" (Buddhist Era). `language === 'th' ? 'th-TH' : 'en-US'` read from `LanguageContext` (AC#11).
All date values carry `tabular-nums` class.

### New i18n keys (added to `locales/translations.json`, both TH + EN)

| Key | TH | EN |
|---|---|---|
| `bookings.detail.pageTitle` | รายละเอียดการจอง | Booking details |
| `bookings.detail.backToBookings` | กลับไปยังการจองของฉัน | Back to my bookings |
| `bookings.detail.guests` | คน | guests |
| `bookings.detail.spot` | ลาน | Spot |
| `bookings.detail.contact` | ข้อมูลติดต่อ | Contact |
| `bookings.detail.forbidden` | ไม่พบข้อมูลการจอง หรือคุณไม่มีสิทธิ์เข้าถึง | Booking not found or you do not have access |

### QA targets (frontend)

- Render detail card for all 4 statuses; cancel button present for PENDING/CONFIRMED, absent for CANCELLED/COMPLETED.
- Cancel success: badge → "ยกเลิกแล้ว", button gone, toast "ยกเลิกการจองสำเร็จ" — no reload.
- Cancel error (PATCH non-ok): toast "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", status unchanged.
- Not-found: `/bookings/bad-id` → 404 page with CTA "กลับไปยังการจองของฉัน".
- Forbidden: booking owned by other user → same 404 page (no existence leak).
- Unauthenticated: redirect to `/login`.
- Loading skeleton renders while fetch resolves.
- Thai locale: dates render as "5 ม.ค. 2568".
- `data-testid` assertions: `btn--booking-cancel`, `badge--booking-status`, `img--booking-cover`, `booking-cancel-dialog`.

### Security targets (frontend)

- Page only receives serialized display fields; no other users' data is passed to the client.
- Cancel PATCH goes to `/api/bookings/[id]` — the existing endpoint enforces its own authz.
- No secrets or raw session data in client component props.
