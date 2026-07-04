---
linear: CAM-60
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
artifact: tech
owner: frontend
status: Done
version: v1
updated: 2026-06-23
---
# Tech — Status label การจองแปลเป็นภาษาไทย (CAM-60)

## Files touched

| File | Change |
|---|---|
| `app/globals.css` | Added `--warning`, `--warning-foreground`, `--info`, `--info-foreground` tokens to `:root` (light) and `.dark`; added `--color-warning`, `--color-warning-foreground`, `--color-info`, `--color-info-foreground` entries to `@theme inline` block |
| `components/ui/badge.tsx` | Added `warning` and `info` variants to `badgeVariants` cva following the existing `success`/`destructive` 10%-fill pattern |
| `lib/booking-status.ts` | New pure TS util — exports `getBookingStatusMeta`, `BookingStatus`, `BadgeVariant`, `BookingStatusMeta` |
| `locales/translations.json` | Added 4 keys to `en.bookings` and `th.bookings`: `statusPending`, `statusConfirmed`, `statusCancelled`, `statusCompleted` |
| `app/bookings/page.tsx` | Removed `statusVariant()` + local `BookingStatus` type; imported `getBookingStatusMeta` from `lib/booking-status`; replaced Badge render to use `variant` from util + localised label from `t.bookings[labelKey]` (raw `booking.status` as fallback when `labelKey` is null) |
| `DESIGN.md` | Added two token rows (`warning`/`warning-foreground` and `info`/`info-foreground`) to §2 Color table |

## New tokens

### Light (`:root`)

| CSS custom property | OKLCH value |
|---|---|
| `--warning` | `oklch(0.769 0.188 70.08)` |
| `--warning-foreground` | `oklch(0.148 0.004 228.8)` |
| `--info` | `oklch(0.511 0.130 237.0)` |
| `--info-foreground` | `oklch(0.984 0.014 180.72)` |

### Dark (`.dark`)

| CSS custom property | OKLCH value |
|---|---|
| `--warning` | `oklch(0.879 0.169 91.605)` |
| `--warning-foreground` | `oklch(0.148 0.004 228.8)` |
| `--info` | `oklch(0.637 0.143 237.0)` |
| `--info-foreground` | `oklch(0.148 0.004 228.8)` |

## Badge variants added

Both variants follow the existing `success`/`destructive` pattern (10% fill, foreground color text, 30% border, `focus-visible` ring at 20%/40% dark, hover tint for anchor context):

```
warning: "bg-warning/10 text-warning-foreground border-warning/30 focus-visible:ring-warning/20 dark:bg-warning/20 dark:focus-visible:ring-warning/40 [a]:hover:bg-warning/20"
info:    "bg-info/10 text-info border-info/30 focus-visible:ring-info/20 dark:bg-info/20 dark:focus-visible:ring-info/40 [a]:hover:bg-info/20"
```

## `getBookingStatusMeta` API

```ts
// lib/booking-status.ts
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
export type BadgeVariant = "warning" | "success" | "muted" | "info";

export interface BookingStatusMeta {
  labelKey: string | null; // null = unknown status, caller renders raw value
  variant: BadgeVariant;
}

export function getBookingStatusMeta(status: string): BookingStatusMeta
```

Mapping table:

| `status` | `labelKey` | `variant` |
|---|---|---|
| `PENDING` | `statusPending` | `warning` |
| `CONFIRMED` | `statusConfirmed` | `success` |
| `CANCELLED` | `statusCancelled` | `muted` |
| `COMPLETED` | `statusCompleted` | `info` |
| unknown | `null` | `muted` |

No React or i18n import — pure TS, safe to unit-test without a render environment. CAM-61 (booking detail page) imports this util to avoid duplicating the mapping.

## i18n keys added

Section `bookings` in both `en` and `th` objects in `locales/translations.json`:

| key | en | th |
|---|---|---|
| `statusPending` | Pending | รอยืนยัน |
| `statusConfirmed` | Confirmed | ยืนยันแล้ว |
| `statusCancelled` | Cancelled | ยกเลิกแล้ว |
| `statusCompleted` | Completed | เข้าพักแล้ว |

## Self-verify results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS (0 errors) |
| `npm run lint` (touched files) | PASS (0 errors; pre-existing `any` warning on `useState<any[]>` at L40 is out-of-scope) |
| `npm run check:palette` | PASS (0 violations) |
| `npm run check:ds` | PASS (0 violations) |

## CWV scorecard

| Metric | Result |
|---|---|
| LCP | not measured |
| CLS | not measured (badge is `absolute`-positioned; no layout shift risk per design.md) |
| INP | not measured |

No new client JS added. The badge is a display-only `<span>`; no interactive island added.

## What QA should target

- AC#1–4: each of the 4 known statuses renders the correct Thai label + correct badge color (warning/success/muted/info) in Thai locale.
- AC#5–8: same 4 statuses render the correct English label in English locale.
- AC#9: a booking with an unknown `status` value renders the raw string in a `muted` badge without crashing.
- Unit tests for `getBookingStatusMeta` in `lib/booking-status.ts` — cover all 4 known statuses + at least one unknown value fallback (5 cases total, covers the ≥80% new-code threshold).
- Regression: CANCELLED badge is now `muted` (gray), not `destructive` (red). Verify the old destructive render is gone.
