---
linear: CAM-59
feature: bookings-trips
epic: camper-availability-booking (CAM-23)
persona: camper
artifact: design
owner: ux-designer
status: Backlog
version: v1
updated: 2026-06-23
---
# Design — หน้ายืนยันการจองและรหัสการจอง (CAM-59)

## Flow

```
จองบนหน้า camp detail
  → POST /api/bookings (success)
  → router.push("/bookings/{bookingId}/confirmation")   ← replaces the old toast + redirect
  → Server fetches booking (authz: userId === session.user.id)
    ├─ found + owner → renders Success state
    └─ not found / not owner / unauthenticated → notFound() / redirect("/login")
```

User path (AC#1 → AC#4):
1. Camper lands on `/bookings/[id]/confirmation` immediately after booking.
2. Reads the success heading, booking ref, and all booking details.
3. Taps "ดูการจองทั้งหมด" → `/bookings`, or "กลับไปดูลานแคมป์" → `/campgrounds/[slug]`.

Error paths:
- AC#5 + AC#7: wrong owner or non-existent id → server calls `notFound()` → Next.js renders the `not-found.tsx` page for this route with the message "ไม่พบข้อมูลการจอง".
- AC#6: unauthenticated → middleware/server redirects to `/login` before this page renders; no visual state to design beyond the redirect.

---

## States Matrix

This is a server-rendered page (SSR). All states are resolved server-side before HTML reaches the client. No client-side loading state is required.

| State | Trigger | What the camper sees | Notes |
|---|---|---|---|
| **success (default)** | booking found, userId matches session | Success header + booking details card + two CTA buttons | The primary state — designed first |
| **not-found** | booking not found OR userId does not match session | "ไม่พบข้อมูลการจอง" empty-state panel | Maps to HTTP 404; rendered via `not-found.tsx` in this route segment |
| hover | pointer over a CTA button | Button background shifts to token hover value (`primary/90` for primary, `secondary` surface shift for outline) | CSS only; no JS state |
| focus | keyboard tab to a CTA button | Visible `ring-ring` focus ring around button | `rounded-full` button so ring follows the pill shape |
| active | button pressed | `active:scale-95` scale transform (120ms ease-out) | Token motion: transform only |
| loading | n/a — SSR | n/a — page does not render until data is ready | Streaming Suspense fallback (skeleton) is a Frontend concern if adopted; not in this AC |
| error | n/a for this page | n/a — errors resolve to not-found or redirect server-side | No inline error state on this page |
| disabled | n/a — CTAs are always active when the success state renders | n/a | |

### 8-state accounting

| State | Handled by |
|---|---|
| default | Success layout (designed below) |
| hover | CSS token (button system) |
| focus | CSS ring-ring (button system) |
| active | CSS scale-95 (button system) |
| loading | SSR resolves before paint; no client loading state in AC |
| error | Server → notFound() or redirect; no design state needed |
| empty | not-found state (see below) |
| disabled | Not applicable for this read-only confirmation page |

All 8 states are accounted for. States handled by the existing button primitive (hover/focus/active/disabled) do not require new design work.

---

## Layout — Success State

**Mobile-first, single column, max-w-xl centered.**

```
<main> (bg-background, min-h-screen)
  <Navbar />                                 ← reuse existing Navbar (session passed server-side)

  <div class="container mx-auto px-6 py-12">
    <div class="max-w-xl mx-auto space-y-8">

      [1] SUCCESS HEADER
          ┌────────────────────────────────────┐
          │  ● icon: CheckCircle2 (lucide)     │  ← w-16 h-16, text-success, aria-hidden="true"
          │    (centered, decorative)          │
          │                                   │
          │  h1: "การจองสำเร็จแล้ว"            │  ← text-3xl font-bold text-foreground
          │  p:  "รหัสการจอง:"                │  ← text-muted-foreground text-sm mt-1
          └────────────────────────────────────┘

      [2] BOOKING REFERENCE CHIP (prominent, easy to read)
          ┌────────────────────────────────────┐
          │  CAMP-XXXXXXXX                     │  ← font-mono text-2xl font-bold text-foreground
          │  (inside rounded-xl bg-muted px-6 │    tracking-widest tabular-nums
          │   py-4 inline-block mx-auto)       │    centered
          └────────────────────────────────────┘

          Note: no copy-to-clipboard button (Phase 2 QR/print is out of scope per story.md).
          The monospace treatment + generous letter-spacing makes the reference easy to
          read aloud to camp staff. That is sufficient for Phase 1.

      [3] STATUS BADGE  ← see recommendation below
          <Badge variant="warning">รอยืนยัน</Badge>   ← rounded-xl, centered under the ref

      [4] BOOKING DETAILS CARD
          <Card> (bg-card rounded-3xl p-6 border border-border shadow-sm)
            ┌─────────────────────────────────┐
            │ ชื่อลานแคมป์ (nameTh / nameEn) │  h2, text-xl font-bold text-foreground
            ├─────────────────────────────────┤
            │ 📅 เช็คอิน     [date]           │  label: text-xs text-muted-foreground uppercase
            │ 📅 เช็คเอาท์   [date]           │  value: text-sm font-semibold text-foreground tabular-nums
            │ 👥 ผู้เข้าพัก  [N] คน           │  icons: Calendar, Users (lucide), w-4 h-4 text-muted-foreground
            ├─────────────────────────────────┤
            │ ยอดรวม                          │  text-xs text-muted-foreground uppercase tracking-wider
            │ ฿X,XXX                          │  text-2xl font-bold text-primary tabular-nums
            └─────────────────────────────────┘

      [5] CTA BUTTONS  (stacked on mobile, side-by-side md:flex-row)
          [Primary]   "ดูการจองทั้งหมด"     → /bookings          Button size="lg" variant="default"
          [Secondary] "กลับไปดูลานแคมป์"   → /campgrounds/[slug] Button size="lg" variant="outline"

    </div>
  </div>
</main>
```

**Layout rules:**
- Section [1] icon + heading are centered (`text-center`).
- Section [2] booking ref chip is centered (`flex justify-center`).
- Section [3] status badge is centered.
- Section [4] card is full-width within `max-w-xl`.
- Section [5] buttons stack on mobile (`flex flex-col gap-3`), side by side on md+ (`md:flex-row`). Both buttons are `w-full md:w-auto`.
- No nested cards (card inside card is §5 anti-slop). The details card is the only surface.
- No decorative icons other than CheckCircle2 in the header. The Calendar and Users icons in the details list are informational (paired with text labels, not color-only signals).

---

## Layout — Not-Found State

Route: `/bookings/[id]/confirmation` when `notFound()` is called.

Implemented via `app/bookings/[id]/confirmation/not-found.tsx` (Next.js App Router convention).

```
<main> (bg-background, min-h-screen)
  <Navbar />

  <div class="container mx-auto px-6 py-24">
    <div class="max-w-sm mx-auto text-center space-y-6">

      [icon]   FileQuestion (lucide) w-16 h-16 text-muted-foreground/40  aria-hidden="true"
      [h1]     "ไม่พบข้อมูลการจอง"              text-2xl font-bold text-foreground
      [p]      "กรุณาตรวจสอบอีกครั้ง หรือดูรายการจองทั้งหมดของคุณ"
                                               text-muted-foreground text-sm
      [CTA]    "ดูการจองทั้งหมด" → /bookings   Button size="lg" variant="default"

    </div>
  </div>
</main>
```

This state does not disclose whether the booking ID exists (AC#5 security requirement: 404, not 403).

---

## Status Badge Recommendation

**Decision: SHOW the status badge ("รอยืนยัน") on the confirmation page.**

Justification:
- A fresh booking lands in `PENDING` status. The camper has just paid attention (time + form fill); telling them the booking is now "รอยืนยัน" (awaiting host confirmation) completes the mental model. Without it, they may not know whether something is still required of them.
- The `warning` badge variant (`--warning` token, yellow-amber) communicates "in progress, not yet done" clearly — paired with text, never color-only. This is reassuring, not alarming.
- The `getBookingStatusMeta` util from `lib/booking-status.ts` (CAM-60) is already in the system. Reusing it here costs nothing and keeps the status vocabulary consistent across all booking surfaces.
- The alternative (omitting the badge for a "clean success moment") risks the camper thinking the booking is already confirmed when it is only pending host approval. That is a UX inaccuracy.
- Placement: centered, immediately below the booking reference chip (section [3]), before the details card. Small footprint — does not compete with the success heading or the CTA buttons.

---

## Components

All from `components/ui/*`. No new components. Icons from `lucide-react` only (DS-5 complete).

| Component | Purpose |
|---|---|
| `Button` | "ดูการจองทั้งหมด" (variant=default, size=lg) and "กลับไปดูลานแคมป์" (variant=outline, size=lg) |
| `Badge` | Status badge — `<Badge variant="warning">รอยืนยัน</Badge>` via `getBookingStatusMeta` |
| `Card` | Booking details surface (bg-card, rounded-3xl, shadow-sm) — section [4] |
| `Navbar` | Page chrome — existing component, session passed as prop |
| lucide `CheckCircle2` | Success icon (decorative, `aria-hidden="true"`) |
| lucide `FileQuestion` | Not-found icon (decorative, `aria-hidden="true"`) |
| lucide `Calendar` | Check-in / check-out row icons in the details card |
| lucide `Users` | Guests row icon in the details card |

---

## Token Table

| Token | Used for |
|---|---|
| `bg-background` | Page surface |
| `text-foreground` | h1, h2, booking ref, date/guest values |
| `bg-card` / `text-card-foreground` | Booking details card surface |
| `border-border` | Card border |
| `shadow-sm` | Card elevation (lowest tier; no floating shadow) |
| `text-muted-foreground` | Detail labels, paragraph under h1, not-found paragraph |
| `bg-muted` | Booking reference chip background |
| `text-primary` | Total price value |
| `text-success` | CheckCircle2 icon color (success state icon only) |
| `--warning` / Badge `variant="warning"` | Status badge (PENDING) |
| `ring-ring` | Focus ring on buttons |
| `rounded-3xl` | Card radius |
| `rounded-xl` | Booking reference chip radius; Badge radius |
| `rounded-full` | Button radius (system default) |
| `h-12` (size="lg") | CTA button height — primary CTA |
| `p-4 md:p-6` | Card padding |
| `space-y-8` | Section spacing |
| `gap-3` | Button stack gap (mobile) |
| `tabular-nums` | Price, booking reference, dates |
| `max-w-xl` | Page content constraint |
| `font-mono` | Booking reference chip text (monospace for readability/scanability) |

No new tokens are needed. All values map to existing tokens in `app/globals.css`.

Note on `font-mono`: Tailwind's `font-mono` references the system monospace stack, not a custom token. It is a scale utility, not an inline value. This is acceptable per DESIGN.md §0 precedence rules.

---

## Booking Reference Display

- Format: `CAMP-XXXXXXXX` (first 8 chars of `Booking.id` UUID, uppercase) — sourced from the API.
- Display treatment: `font-mono text-2xl font-bold tracking-widest tabular-nums text-foreground`.
- Container: `bg-muted rounded-xl px-6 py-4` — creates a visually distinct, scannable chip.
- Centered on the page for easy reading and dictation to camp staff.
- No copy-to-clipboard affordance in Phase 1 (QR/print/copy is explicitly out of scope per `story.md`).

---

## a11y (WCAG 2.1 AA)

- **Heading hierarchy:** `h1` = "การจองสำเร็จแล้ว" (one per page). Camp name in the details card uses `h2`. No heading levels are skipped.
- **Decorative icons:** `CheckCircle2` and `FileQuestion` are `aria-hidden="true"`. Meaning is carried by the adjacent text (`h1`, paragraph), not the icon.
- **Informational icons in the details list** (`Calendar`, `Users`): paired with visible text labels. The icons themselves can be `aria-hidden="true"` — the text label provides the accessible name.
- **Button accessible names:** "ดูการจองทั้งหมด" and "กลับไปดูลานแคมป์" are full text — no icon-only buttons. No `aria-label` required beyond the button text.
- **Status badge:** `<Badge>` renders a `<span>` — it is not interactive. Text "รอยืนยัน" is present; variant color is not the only signal (the text reads independently).
- **Focus:** all interactive elements (two `<Button asChild>` / `<Link>` pairs) receive the system `ring-ring` focus ring. Tab order: primary CTA → secondary CTA.
- **Tap target:** both CTAs use `size="lg"` (`h-12` = 48px), exceeding the 44px minimum.
- **Color contrast:** `text-success` (CheckCircle2) on `bg-background` — not measured; this icon is decorative (`aria-hidden`), so contrast is not a requirement. `text-foreground` on `bg-background` uses the OKLCH token pair, which the system has verified. `--warning` badge on `bg-card` — not measured; badge text is `text-foreground` on the warning surface per the Badge component's system styling.
- **Booking reference:** `font-mono tracking-widest` improves readability for screen readers reading character by character. The ref is plain text, not an image.
- **Keyboard:** page has no traps. Two link-buttons navigate forward. No modal or drawer.
- **Landmarks:** `<main>`, `<Navbar>` (contains `<nav>`). Correct landmark structure.

---

## i18n

**New keys required in `locales/`** (TH + EN, under the `bookings` namespace):

| Key | TH | EN |
|---|---|---|
| `bookings.confirmationTitle` | `การจองสำเร็จแล้ว` | `Booking confirmed` |
| `bookings.bookingRefLabel` | `รหัสการจอง` | `Booking reference` |
| `bookings.viewAllBookings` | `ดูการจองทั้งหมด` | `View all bookings` |
| `bookings.backToCampsite` | `กลับไปดูลานแคมป์` | `Back to campsite` |
| `bookings.notFound` | `ไม่พบข้อมูลการจอง` | `Booking not found` |
| `bookings.notFoundDescription` | `กรุณาตรวจสอบอีกครั้ง หรือดูรายการจองทั้งหมดของคุณ` | `Please check the link, or view all your bookings.` |
| `bookings.statusBadgeAriaLabel` | `สถานะการจอง: รอยืนยัน` | `Booking status: pending` |

**Reused keys (no change needed):**
- `booking.checkIn` / `booking.checkOut` / `booking.guests` — already exist.
- `bookings.totalPaid` — already exists.
- `bookings.statusPending` — already exists (used by `getBookingStatusMeta`).

**Thai copy rules verified:**
- No em-dash used as a separator.
- No technical jargon (no "ID", "API", "reference number" in Thai).
- `CAMP-XXXXXXXX` is rendered as a value, not copy — it is not translated.

---

## SEO / robots

This page is an auth-gated user page (booking detail for a specific camper). It must set `robots: { index: false }` per `.claude/rules/seo.md §8`. No `generateMetadata` canonical or JSON-LD is required. A simple `noindex` metadata export is sufficient.

---

## Design Gate

Pre-merge checklist for this story's UI work:

- [ ] Token-only: no free-floating hex/px. `npm run check:palette` green.
- [ ] Components from `components/ui/*` only; icons from `lucide-react` only.
- [ ] Radius by role: Card `rounded-3xl`, booking-ref chip `rounded-xl`, Badge `rounded-xl`, Button `rounded-full`.
- [ ] All 8 states accounted for (see States Matrix above).
- [ ] a11y AA: heading hierarchy h1 → h2, decorative icons `aria-hidden`, buttons have text labels, tap targets `h-12` (48px), focus ring present, `axe` clean.
- [ ] i18n: 7 new keys added to `locales/` in TH + EN. No hardcoded Thai or English strings in the component. Thai copy: no em-dash, no jargon.
- [ ] `tabular-nums` on price, dates, and booking reference.
- [ ] `robots: { index: false }` set on the page.
- [ ] Status badge uses `getBookingStatusMeta` from `lib/booking-status.ts` (reuse; no duplication).
- [ ] `font-mono` on the booking reference chip (scale utility, not inline).
- [ ] Anti-slop: page has one dominant cell (success header), no gradient, no card nested in card, teal POV on the primary CTA.
- [ ] Screenshot on Staging matches this brief before marking AC Done.

---

## Links

`../../feature.md` · `../../../../DESIGN.md` · `./story.md` · `lib/booking-status.ts` (getBookingStatusMeta)

## Changelog

- v1 (2026-06-23) — created
