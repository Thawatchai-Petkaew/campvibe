---
linear: CAM-61
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
persona: camper
artifact: design
owner: ux-designer
status: Backlog
version: v1
updated: 2026-06-23
---
# Design — หน้ารายละเอียดการจอง /bookings/[id] (CAM-61)

## Flow

Camper navigates from `/bookings` list (taps "ดูรายละเอียด") or follows a direct link → `/bookings/[id]`.

```
/bookings (list)
  └── tap "ดูรายละเอียด"
        └── /bookings/[id]
              ├── [loading]   skeleton while server fetch resolves
              ├── [loaded]    detail view — camp cover + info + status badge + cancel button (if cancellable)
              │     └── tap "ยกเลิกการจอง"
              │           └── AlertDialog confirm
              │                 ├── confirm → PATCH /api/bookings/[id] → [loading on button]
              │                 │     ├── success → toast "ยกเลิกการจองสำเร็จ" + badge → "ยกเลิกแล้ว" + button disappears (no reload)
              │                 │     └── error   → toast "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" + status unchanged
              │                 └── dismiss ("เก็บการจองไว้") → dialog closes, no change
              ├── [not-found] booking id not in system → 404 message + CTA back to /bookings
              └── [forbidden] booking belongs to another user → same 404-style (no existence leak)
```

Unauthenticated: server-side redirect to `/login` — no client state needed, not a designed visual state.

---

## States Matrix

### Page-level states

| State | Trigger | What the Camper sees |
|---|---|---|
| **loading** (AC#9) | Initial mount before fetch resolves | Full-page skeleton: cover placeholder `bg-muted rounded-3xl`, two skeleton lines for camp name + status, four `Skeleton` rows for detail fields, no button yet |
| **loaded** (AC#1–4) | Fetch returns 200 + data | Detail card described in Layout section below |
| **not-found** (AC#10) | API returns 404 (id does not exist) | `bg-card rounded-3xl p-12 text-center`: `CircleX` icon (`w-12 h-12 text-muted-foreground/50`), `<h1>` "ไม่พบข้อมูลการจอง" (`text-xl font-bold`), body "กรุณาตรวจสอบอีกครั้ง หรือดูการจองทั้งหมดของคุณ" (`text-muted-foreground`), Button variant=`outline` size=`md` → `/bookings` with label "กลับไปยังการจองของฉัน" |
| **forbidden** (AC#7) | API returns 403 (other user's booking) | Identical to not-found — "ไม่พบข้อมูลการจอง หรือคุณไม่มีสิทธิ์เข้าถึง" — same 404-style treatment, no existence leaked |

### Cancel button — all 8 interaction states

The cancel button appears **only** when `status === 'PENDING' || status === 'CONFIRMED'` (Rules).

| State | Appearance |
|---|---|
| **default** | `Button variant="ghost" size="md"` `text-muted-foreground` `rounded-full h-11 px-4 font-bold` |
| **hover** | `hover:text-destructive hover:bg-destructive/10` (token `destructive`) |
| **focus** | visible `ring-ring` focus ring (`outline-ring/50` global) |
| **active** | `active:scale-95` (motion token, `transform` only) |
| **loading** | `disabled` + `Loader2` icon `animate-spin w-4 h-4` replaces label text while PATCH is in-flight (`cancellingId === booking.id`) |
| **error** | button re-enables; error conveyed via sonner toast only — button returns to default |
| **empty** | n/a — button is absent when status is CANCELLED or COMPLETED |
| **disabled** | `disabled={cancellingId !== null}` — prevents double-submit while loading |

### AlertDialog (confirm cancel) — all 8 states

| State | Appearance |
|---|---|
| **default** | `AlertDialogContent` `rounded-3xl` — title, description, two footer buttons |
| **hover** | `AlertDialogAction` variant=`destructive` `rounded-full h-11` — token `destructive` fill with `text-primary-foreground`; `AlertDialogCancel` `rounded-full h-11` |
| **focus** | visible `ring-ring` on both buttons |
| **active** | `active:scale-95` on confirm button |
| **loading** | after confirm tap, dialog stays open; cancel button shows spinner (loading state above); confirm button `disabled` |
| **error** | dialog closes; toast error appears (see Cancel flow); no error rendered inside the dialog |
| **empty** | n/a — dialog is not shown when cancel is unavailable |
| **disabled** | `AlertDialogCancel` is not disabled — the camper can always dismiss |

### Status badge (loaded state)

Reuses `getBookingStatusMeta` → `Badge` variant from `lib/booking-status.ts`. Color is never the only signal — badge always shows text label.

| status | badge variant | text (TH) |
|---|---|---|
| PENDING | `warning` | รอยืนยัน |
| CONFIRMED | `success` | ยืนยันแล้ว |
| CANCELLED | `muted` | ยกเลิกแล้ว |
| COMPLETED | `info` | เข้าพักแล้ว |

---

## Layout — Loaded State (mobile-first)

```
<main class="min-h-screen bg-background">
  <Navbar />
  <div class="container mx-auto px-4 md:px-6 py-8 md:py-12">
    <div class="max-w-2xl mx-auto space-y-6">

      <!-- Back link -->
      <Link href="/bookings" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft w-4 h-4 /> กลับไปยังการจองของฉัน
      </Link>

      <!-- Hero card: cover image + status badge overlay -->
      <div class="bg-card rounded-3xl overflow-hidden border border-border shadow-sm">

        <!-- Cover image: w-full h-48 md:h-64 relative -->
        ImageWithFallback
          src = campSite.images[0].url   (first image from CSV/array)
          alt = campSite.nameTh / nameEn (localized)
          className="w-full h-48 md:h-64"
          imgClassName="object-cover"
        <!-- Status badge: absolute top-4 left-4 -->
        <Badge variant={...} class="ring-2 ring-card shadow-sm font-bold tracking-wider rounded-xl">
          {statusLabel}
        </Badge>

        <!-- Info section: p-4 md:p-6 space-y-6 -->
        <div class="p-4 md:p-6 space-y-6">

          <!-- Heading row: camp name (h1) + total price -->
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-foreground">
                {language === 'th' ? campSite.nameTh : campSite.nameEn}
              </h1>
              <div class="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                <MapPin w-3.5 h-3.5 />
                {campSite.location.province}
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                {t.bookings.totalPaid}        <!-- REUSED key -->
              </div>
              <div class="text-xl font-bold text-primary tabular-nums">
                {formatCurrency(totalPrice)}
              </div>
            </div>
          </div>

          <!-- Booking ref row -->
          <div class="flex items-center gap-2 text-sm">
            <Hash w-4 h-4 text-muted-foreground />
            <span class="text-muted-foreground">{t.bookings.bookingRefLabel}</span>   <!-- REUSED key -->
            <span class="font-mono font-semibold text-foreground tabular-nums">
              {formatBookingRef(booking.id)}
            </span>
          </div>

          <!-- Divider -->
          <hr class="border-border/60" />

          <!-- Date + nights grid: 2-col on mobile, 2-col on desktop -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-muted rounded-xl shrink-0">
                <Calendar w-4 h-4 text-muted-foreground />
              </div>
              <div>
                <div class="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
                  {t.booking.checkIn}         <!-- REUSED key -->
                </div>
                <div class="text-sm font-semibold text-foreground tabular-nums">
                  {checkInDate formatted}     <!-- see Date Format note -->
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="p-2 bg-muted rounded-xl shrink-0">
                <Calendar w-4 h-4 text-muted-foreground />
              </div>
              <div>
                <div class="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
                  {t.booking.checkOut}        <!-- REUSED key -->
                </div>
                <div class="text-sm font-semibold text-foreground tabular-nums">
                  {checkOutDate formatted}
                </div>
              </div>
            </div>
          </div>

          <!-- Guests + Nights row -->
          <div class="flex items-center gap-4 text-sm text-muted-foreground font-medium">
            <div class="flex items-center gap-1.5">
              <Users w-4 h-4 />
              <span class="tabular-nums">{guests}</span> {t.bookings.detail.guests}  <!-- NEW key -->
            </div>
            <div class="h-4 w-px bg-border" />
            <div class="flex items-center gap-1.5">
              <Clock w-4 h-4 />
              <span class="tabular-nums">{nights}</span> {t.booking.nights}          <!-- REUSED key -->
            </div>
          </div>

          <!-- Spot row (conditional: shown only if booking.spot exists) -->
          [if spot]
          <div class="flex items-center gap-2 text-sm">
            <Tent w-4 h-4 text-muted-foreground />
            <span class="text-muted-foreground">{t.bookings.detail.spot}</span>       <!-- NEW key -->
            <span class="font-semibold text-foreground">{spot.name} {spot.zone}</span>
          </div>

          <!-- Contact row (shown only if phone or lineId exists) -->
          [if campSite.phone || campSite.lineId]
          <div class="space-y-2 pt-2 border-t border-border/60">
            <div class="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
              {t.bookings.detail.contact}     <!-- NEW key -->
            </div>
            [if phone]
            <div class="flex items-center gap-2 text-sm">
              <Phone w-4 h-4 text-muted-foreground />
              <span class="text-foreground">{campSite.phone}</span>
            </div>
            [if lineId]
            <div class="flex items-center gap-2 text-sm">
              <MessageCircle w-4 h-4 text-muted-foreground />
              <span class="text-muted-foreground">Line: </span>
              <span class="text-foreground">{campSite.lineId}</span>
            </div>
          </div>

          <!-- Action footer -->
          <div class="pt-4 border-t border-border/60">
            {(status === 'PENDING' || status === 'CONFIRMED') && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="md"
                    disabled={isCancelling}
                    aria-label={t.bookings.cancelBookingAriaLabel}   <!-- REUSED key -->
                    data-testid="btn--booking-cancel"
                    class="w-full sm:w-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-11 px-6 font-bold transition-colors"
                  >
                    {isCancelling ? <Loader2 animate-spin w-4 h-4 /> : t.bookings.cancelBooking}  <!-- REUSED key -->
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.bookings.confirmCancelTitle}</AlertDialogTitle>      <!-- REUSED key -->
                    <AlertDialogDescription>
                      {t.bookings.confirmCancelDescription}                                  <!-- REUSED key -->
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.bookings.keepBooking}</AlertDialogCancel>           <!-- REUSED key -->
                    <AlertDialogAction variant="destructive" onClick={handleCancel}>
                      {t.bookings.confirmCancelAction}                                       <!-- REUSED key -->
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

        </div>  <!-- /info section -->
      </div>  <!-- /hero card -->
    </div>
  </div>
</main>
```

### Loading skeleton layout

```
<div class="max-w-2xl mx-auto space-y-6">
  <!-- Back link skeleton: w-40 h-4 -->
  <Skeleton class="w-40 h-4 rounded-full" />

  <div class="bg-card rounded-3xl overflow-hidden border border-border shadow-sm">
    <!-- Cover skeleton: same dimension as image -->
    <Skeleton class="w-full h-48 md:h-64" />

    <div class="p-4 md:p-6 space-y-6">
      <!-- Camp name + price -->
      <div class="flex justify-between">
        <div class="space-y-2">
          <Skeleton class="w-48 h-6 rounded-full" />
          <Skeleton class="w-32 h-4 rounded-full" />
        </div>
        <Skeleton class="w-20 h-8 rounded-full" />
      </div>
      <!-- Booking ref -->
      <Skeleton class="w-36 h-4 rounded-full" />
      <!-- Date grid -->
      <div class="grid grid-cols-2 gap-4">
        <Skeleton class="h-14 rounded-xl" />
        <Skeleton class="h-14 rounded-xl" />
      </div>
      <!-- Guests + nights -->
      <Skeleton class="w-48 h-4 rounded-full" />
    </div>
  </div>
</div>
```

---

## Date Format (AC#11)

Thai (th-TH locale, Buddhist Era): `new Date(dateString).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })`
Produces: **"5 ม.ค. 2568"** — year is automatically B.E. in `th-TH` locale.

English (en-US locale): `new Date(dateString).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })`
Produces: **"Jan 5, 2025"**

The locale is read from the LanguageContext (`language === 'th' ? 'th-TH' : 'en-US'`), matching the pattern already established in `app/bookings/page.tsx`.

All date strings must carry `tabular-nums` via `font-variant-numeric: tabular-nums` (`class="tabular-nums"`).

---

## Components Used

All from `components/ui/*` and `lucide-react` — no invented components.

| Component | Source | Use |
|---|---|---|
| `Button` | `components/ui/button` | Cancel button (ghost) + not-found CTA (outline) |
| `AlertDialog` (+ sub-parts) | `components/ui/alert-dialog` | Cancel confirm dialog — destructive pattern |
| `Badge` | `components/ui/badge` | Status badge (rounded-xl per DESIGN.md) |
| `Skeleton` | `components/ui/skeleton` | Loading skeleton for cover + text fields |
| `LoadingSpinner` | `components/ui/loading-spinner` | Optional fallback spinner during cancel PATCH |
| `ImageWithFallback` | `components/ui/image-with-fallback` | Camp cover image with placeholder |
| `toast` (sonner) | `components/ui/sonner` | Success / error feedback after cancel |
| `getBookingStatusMeta` | `lib/booking-status` | Maps Booking.status → Badge variant + labelKey |
| `formatBookingRef` | `lib/booking-ref` | Formats booking id → "CAMP-A1B2C3D4" |
| **Icons (lucide-react)** | `lucide-react` | `ChevronLeft`, `MapPin`, `Calendar`, `Clock`, `Users`, `Hash`, `Tent`, `Phone`, `MessageCircle`, `CircleX`, `Loader2` |

---

## Token Table

| Token class | DESIGN.md role | Where used |
|---|---|---|
| `bg-background` | page surface | `<main>` background |
| `bg-card` / `border-border` / `shadow-sm` | card surface | detail card, skeleton wrapper |
| `rounded-3xl` | card radius | detail card, not-found card |
| `rounded-xl` | inner element / badge | status badge, icon wells |
| `rounded-full` | button / control | cancel button, CTA button, back link, skeleton pills |
| `text-foreground` | primary text | camp name, dates, price, ref |
| `text-muted-foreground` | secondary text | labels, location, contact, icon fills |
| `text-primary` / `tabular-nums` | price + dates | price value, date values, nights/guests count |
| `text-destructive` / `bg-destructive/10` | cancel hover | cancel button hover state |
| `bg-muted` | icon wells, skeleton | icon bg wells, Skeleton base color |
| `border-border/60` | divider | section separators |
| `p-4 md:p-6` | card padding | detail card content |
| `space-y-6` | section spacing | content stack |
| `h-11` (size=md) | button height | cancel button, dialog buttons |

No new tokens required. All values trace to existing `app/globals.css` OKLCH tokens.

---

## i18n Keys

### Reused keys (already in `locales/translations.json` — do NOT redeclare)

All keys are under the `bookings.*` namespace unless noted.

| Key path | TH (existing) | EN (existing) |
|---|---|---|
| `bookings.totalPaid` | ยอดชำระทั้งหมด | Total Paid |
| `bookings.bookingRefLabel` | รหัสการจอง | Booking reference |
| `bookings.cancelBooking` | ยกเลิกการจอง | Cancel booking |
| `bookings.cancelBookingAriaLabel` | ยกเลิกการจองนี้ | Cancel this booking |
| `bookings.confirmCancelTitle` | ยกเลิกการจองนี้? | Cancel this booking? |
| `bookings.confirmCancelDescription` | การดำเนินการนี้ไม่สามารถยกเลิกได้... | This action cannot be undone... |
| `bookings.confirmCancelAction` | ยืนยัน ยกเลิกการจอง | Yes, cancel booking |
| `bookings.keepBooking` | เก็บการจองไว้ | Keep booking |
| `bookings.bookingCancelledSuccess` | ยกเลิกการจองสำเร็จ | Booking cancelled successfully |
| `bookings.errorOccurred` | เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง | Something went wrong. Please try again. |
| `bookings.notFound` | ไม่พบข้อมูลการจอง | Booking not found |
| `bookings.notFoundDescription` | กรุณาตรวจสอบอีกครั้ง หรือดูรายการจองทั้งหมดของคุณ | Please check the link, or view all your bookings. |
| `bookings.statusPending` | รอยืนยัน | Pending |
| `bookings.statusConfirmed` | ยืนยันแล้ว | Confirmed |
| `bookings.statusCancelled` | ยกเลิกแล้ว | Cancelled |
| `bookings.statusCompleted` | เข้าพักแล้ว | Completed |
| `booking.checkIn` | เช็คอิน | Check-in |
| `booking.checkOut` | เช็คเอาท์ | Check-out |
| `booking.nights` | คืน | nights |

### New keys — must be added to `locales/translations.json` (TH + EN)

All new keys go under `bookings.detail.*` sub-namespace.

| Key | TH (verbatim) | EN |
|---|---|---|
| `bookings.detail.pageTitle` | รายละเอียดการจอง | Booking details |
| `bookings.detail.backToBookings` | กลับไปยังการจองของฉัน | Back to my bookings |
| `bookings.detail.guests` | คน | guests |
| `bookings.detail.spot` | ลาน | Spot |
| `bookings.detail.contact` | ข้อมูลติดต่อ | Contact |
| `bookings.detail.forbidden` | ไม่พบข้อมูลการจอง หรือคุณไม่มีสิทธิ์เข้าถึง | Booking not found or you do not have access |

Note: `bookings.detail.forbidden` uses the same visual treatment as not-found (404-style) — no existence leaked per the authorization rule.

---

## a11y (WCAG 2.1 AA)

- **Heading hierarchy**: `<h1>` = camp name (loaded state) or error title (not-found/forbidden). No `<h2>` or deeper needed on this single-card page. Not-found `<h1>` = "ไม่พบข้อมูลการจอง".
- **Status not color-only**: `Badge` always renders a visible text label from `getBookingStatusMeta.labelKey`. Color + text together.
- **Cancel button**: `aria-label={t.bookings.cancelBookingAriaLabel}` ("ยกเลิกการจองนี้"). Tap target `h-11` = 44px.
- **AlertDialog**: `AlertDialogTitle` + `AlertDialogDescription` present; focus is trapped inside the dialog while open; cancel (`AlertDialogCancel`) is keyboard-dismissable. Both footer buttons `h-11` = 44px.
- **Back link**: text label "กลับไปยังการจองของฉัน" — descriptive, not "click here".
- **ImageWithFallback**: `alt` = localized camp name (never empty on this page).
- **Loading skeleton**: not interactive — no aria role needed; page `<title>` or Navbar heading conveys context during load.
- **Focus ring**: all buttons and links use `outline-ring/50` global ring. No custom override.
- **Contrast**: all tokens (text-foreground on bg-card, text-primary on bg-card, text-muted-foreground on bg-card) are pre-verified by the OKLCH token set — not measured independently here. Status badge token variants (warning/success/muted/info) are system tokens — mark **not measured individually for this screen**.
- **Touch targets**: cancel button `h-11 w-full sm:w-auto`, CTA button `h-11`, dialog buttons `h-11`. All meet 44px.
- **Keyboard**: Tab → back link → cancel button → dialog opens → Tab cycles Cancel/Confirm inside dialog → Escape closes dialog.

---

## Error Patterns

Per `form-patterns.md`:

- **Cancel PATCH success**: `toast.success(t.bookings.bookingCancelledSuccess)` (sonner, transient).
- **Cancel PATCH error**: `toast.error(t.bookings.errorOccurred)` (sonner, transient). Status badge and button state do not change on error.
- **Not-found / Forbidden**: rendered as full page state (not a toast, not an ErrorBanner) — the page itself IS the error state, with a CTA to `/bookings`.
- No `ErrorBanner` is used on this page. The error state for cancel is toast-only (transient feedback for a single action, per the component decision matrix: `toast` for transient feedback, `ErrorBanner` for persistent server error on a form).

---

## Design Gate

Before this UI merges to `staging`, verify:

- [ ] `npm run check:palette` green — no hex/px inline values in the component.
- [ ] All 8 states present for cancel button AND AlertDialog AND page-level (loading / loaded / not-found / forbidden).
- [ ] Status badge uses `Badge` with text label — not a raw `<span>`, not color-only.
- [ ] Cover image uses `ImageWithFallback` with localized `alt` — not a bare `<img>`.
- [ ] Date values render as `tabular-nums` and match "5 ม.ค. 2568" format in Thai locale.
- [ ] Booking ref formatted via `formatBookingRef` — "CAMP-A1B2C3D4".
- [ ] Cancel button hidden for CANCELLED and COMPLETED status (verified in all 4 status scenarios from AC#1–4).
- [ ] New i18n keys (`bookings.detail.*`) present in TH + EN in `locales/translations.json` before component ships.
- [ ] `aria-label` on cancel button present; AlertDialog has title + description; all interactive elements have accessible names.
- [ ] No em-dash separator in any copy. No technical jargon (no "API", "PATCH", "status code") in user-facing strings.
- [ ] Cancel confirm text verbatim: "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?" (from Rules in story.md, surfaced via `confirmCancelDescription`).
- [ ] Not-found and forbidden render the same 404-style UI — no existence leak.
- [ ] `data-testid` present: `btn--booking-cancel`, `badge--booking-status`, `img--booking-cover` (extend with `--booking-cancel-dialog` on AlertDialogContent).
- [ ] Responsive: layout stacks correctly on 375px mobile; cover image height `h-48` on mobile, `md:h-64` on desktop.
- [ ] Anti-slop: teal/mist + clean white, `bg-card` surface, light chrome (border + shadow-sm only), no gradient, no nested cards, clear hierarchy via spacing + typography.

---

## Reference

One reference: `app/bookings/page.tsx` — the existing list page establishes the visual language for the card layout, status badge overlay, cancel AlertDialog, and ImageWithFallback usage. The detail page extends this grammar to a full-detail view without reinventing it.

Anti-slop criteria that must pass on screenshot review:
- The page reads as a CampVibe booking detail, not a generic card template.
- One dominant information hierarchy: camp name (h1, bold) > dates + price > secondary metadata > cancel action.
- No purple/blue gradient, no centered hero with decorative pills, no cards nested inside cards.

---

## Links

- `../epic.md` — camper-pre-trip-my-bookings epic rollup
- `story.md` — AC + Rules for CAM-61 (this design traces to all 11 ACs)
- `DESIGN.md` — token tables, component matrix, anti-slop, design gate
- `app/bookings/page.tsx` — existing list page (reuse AlertDialog + status badge pattern)
- `lib/booking-status.ts` — `getBookingStatusMeta` util
- `lib/booking-ref.ts` — `formatBookingRef` util
- `components/ui/image-with-fallback.tsx` — cover image component

## Changelog

- v1 (2026-06-23) — created
