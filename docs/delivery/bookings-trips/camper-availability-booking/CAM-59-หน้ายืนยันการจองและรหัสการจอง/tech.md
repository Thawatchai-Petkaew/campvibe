---
linear: CAM-59
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
artifact: tech
owner: frontend
status: Done
version: v1
updated: 2026-06-23
---
# Tech — หน้ายืนยันการจองและรหัสการจอง (CAM-59)

## Files Touched

| File | Change |
|---|---|
| `lib/booking-ref.ts` | New: `formatBookingRef(id)` pure util |
| `app/bookings/[id]/confirmation/page.tsx` | New: async server component (auth + Prisma fetch + authz) |
| `app/bookings/[id]/confirmation/BookingConfirmationClient.tsx` | New: client component (language-aware UI) |
| `app/bookings/[id]/confirmation/not-found.tsx` | New: 404 not-found state for this route segment |
| `locales/translations.json` | Added 7 keys (TH + EN) under `bookings.*` |
| `components/CampgroundDetailClient.tsx` | Redirect change: `setTimeout window.location.href` → `router.push` to confirmation page |

## Data Fetch + Authz

`page.tsx` (server component):

1. `const session = await auth()` — if no `session.user.id` → `redirect('/login')` (AC#6).
2. `prisma.booking.findFirst({ where: { id, userId: session.user.id }, select: {...} })` — ownership-scoped query. Returns `null` for wrong-owner AND non-existent id. Both map to `notFound()` (HTTP 404). No 403. No existence leak (AC#5, AC#7).
3. Fields selected: `id, status, checkInDate, checkOutDate, guests, totalPrice`, relation `campSite { nameTh, nameEn, nameThSlug }`.
4. Dates serialized to ISO strings (`.toISOString()`) and `totalPrice` coerced to `Number()` before passing to the client component — avoids Prisma `Decimal` and `Date` object serialization mismatch.

## formatBookingRef

```ts
// lib/booking-ref.ts
export function formatBookingRef(id: string): string {
  return "CAMP-" + id.slice(0, 8).toUpperCase();
}
```

Pure function, zero imports. Rule: first 8 chars of UUID, uppercased, prefixed "CAMP-". Example input `"a1b2c3d4-..."` → `"CAMP-A1B2C3D4"`. QA can unit-test without a render environment. CAM-61 can import and reuse.

## SSR i18n Approach

The app uses a client-side `LanguageContext` (reads `localStorage`, default `'en'`). Server components cannot call `useLanguage()`.

Pattern followed (matching `app/campgrounds/[slug]/page.tsx`):
- `page.tsx` is a pure async server component; it fetches data and session, passes a plain serialized object to `BookingConfirmationClient`.
- `BookingConfirmationClient` is `"use client"` and calls `useLanguage()` to get the current language, format currency, and select `campSite.nameTh` vs `campSite.nameEn`.
- The `not-found.tsx` file uses `getTranslations('th')` (the same SSR-only helper used in `app/campgrounds/[slug]/page.tsx`) for the default Thai render, as it is a fallback error state with no language toggle needed.
- New i18n keys are added to `locales/translations.json` under `bookings` for both `en` and `th`.

## Redirect Change (CampgroundDetailClient.tsx)

Before (CAM-59 removed):
```ts
// After successful booking POST:
toast.success(t.newCampground.bookingReservedSuccess);
setTimeout(() => window.location.href = "/bookings", 1500);
```

After:
```ts
// Immediate redirect to the confirmation page (no toast, no delay).
router.push(`/bookings/${data.id}/confirmation`);
```

- Added `import { useRouter } from "next/navigation"` to the file imports.
- Added `const router = useRouter()` inside the component body.
- `data.id` is the booking id: the POST response is `apiSuccess(booking, 201)` which returns `NextResponse.json(booking)` directly (no `{data}` wrapper), so `data.id` is correct.
- Failure-path toast (`toast.error(...)`) is unchanged.

## Security

- Authz: `where: { id, userId: session.user.id }` — owner-scoped. Another user's booking returns `null` → `notFound()`. No 403, no existence check split, no data leaked.
- The `userId` is read from the NextAuth session server-side only; never from URL params or request body.
- Page sets `robots: { index: false }` (auth-gated user page, per `.claude/rules/seo.md §8`).

## Changelog

- v1 (2026-06-23) — created
