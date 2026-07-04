---
linear: DS-badge-norm
feature: design-system-v2
epic: badge-normalization
persona: Admin · Host · Camper
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-29
---

# Design — Badge Normalization (DS-badge-norm)

## Problem statement

`components/ui/badge.tsx` is a correct DS badge — `rounded-xl`, `font-medium`, 9 semantic variants.
Fourteen call sites apply ad-hoc `className` overrides (`font-bold uppercase tracking-wider`,
`rounded-full`, `ring-2 ring-card shadow-sm`, `bg-background/90 backdrop-blur-sm …`) that contradict
the variant styling, break dark mode semantics, and produce visually inconsistent badges across the app.

The fix is **two small additions to `badge.tsx`** that make the overrides unnecessary, plus
a per-call-site prop-only replacement map.

---

## Flow (affected surfaces)

Every surface that renders a `<Badge>` is touched; no navigation flow changes.

```
Navbar (HOST label) → layout-client.tsx (HOST label + count pill) →
app/bookings/page.tsx (status over image) → app/bookings/[id]/BookingDetailClient.tsx (status over image) →
app/dashboard/page.tsx (status in table) → app/dashboard/bookings/page.tsx (status in table) →
app/profile/page.tsx (role chip) → app/host/page.tsx (decorative chip) →
components/settings/TeamManagement.tsx (role chips)
```

---

## Decision: what to add to `badge.tsx`

### Decision 1 — Status badge typography: drop uppercase, keep DS default

**Question:** should `uppercase + font-bold + tracking-wider` be baked into a prop, or dropped?

**Decision: DROP them. Standardise on the DS default (`font-medium`, normal case, normal tracking).**

Rationale against baking in uppercase:
- DESIGN.md §1 mandates "teal calm-confidence" — calm, composed, no aggressive shouting.
- `uppercase` on short status words (`PENDING`, `CONFIRMED`) adds visual noise without adding
  clarity; the semantic color (success teal, warning amber, destructive red) already carries the
  meaning.
- Thai status labels (ยืนยันแล้ว, รอดำเนินการ) cannot be uppercased; a bilingual app must not
  apply a style only to EN text.
- `tracking-wider` fights the compact `h-5 px-2` geometry: the letters overflow at Thai script.
- DESIGN.md §5 anti-slop: "decorative meaningless badges" — bold uppercase is decoration, not
  function.

**The cleaned-up look (DS default):** `rounded-xl font-medium text-xs normal-case tracking-normal`.
This is already in `badge.tsx` — it requires zero code in the component for this decision.

### Decision 2 — Count / notification pill: add `shape="pill"` prop

The numeric count badge in `app/dashboard/layout-client.tsx:108` **legitimately** needs a circular
shape (a digit in a circle is a universally understood pattern). A raw `className="rounded-full h-5 min-w-5"` override is still wrong because it bypasses the token layer.

**Add `shape="pill"` prop to `badge.tsx`.** When `shape="pill"`, the component applies:
- `rounded-full` (overrides the default `rounded-xl` for this case only)
- `min-w-[1.25rem]` (same as `min-w-5`) to keep single-digit circles

This is the only radius override that is permitted, isolated inside the component, and controlled
by a typed prop — not a loose className.

**No new token required** — `rounded-full` and `min-w-5` are Tailwind scale utilities already in
the project.

### Decision 3 — Overlay-on-image badge: add `variant="overlay"`

`CampgroundCard.tsx:120` uses `bg-background/90 backdrop-blur-sm text-foreground shadow-sm border-border/50`
on a `variant="secondary"` badge. These tokens are legitimate (they are all semantic), but they
override the secondary variant's background in a way that is not self-documenting and breaks
dark mode (secondary in dark mode would show a different tint, but the `/90` opacity stack
changes the visual result).

**Add `variant="overlay"` to `badge.tsx`** that bakes:
- `bg-card/85 backdrop-blur-sm text-foreground border border-border/40`

The `bg-card/85` is the correct overlay idiom: DESIGN.md §2 explicitly blesses
`bg-foreground/50 … over an image … the correct light/dark-adaptive overlay idiom`. Using
`bg-card/85` gives a legible light-background chip over a photo in light mode, and a dark
chip in dark mode — automatically, via the `.dark` token, no hand-written `dark:` needed.

No new hex. No new CSS custom property. Just a variant entry in the `cva` map.

---

## Badge taxonomy — one lookup table

| Use case | Variant | shape | Notes |
|---|---|---|---|
| Booking status: confirmed / paid | `success` | (default) | font-medium, normal case |
| Booking status: pending / awaiting | `warning` | (default) | |
| Booking status: cancelled / failed | `destructive` | (default) | |
| Booking status: completed / info | `info` | (default) | |
| Booking status: unknown / inactive | `muted` | (default) | |
| HOST label next to logo | `default` | (default) | NOT rounded-full; the button role uses rounded-full — Badge is rounded-xl |
| Role chip: OWNER | `default` | (default) | pair with Shield icon; font-medium, normal case |
| Role chip: ADMIN | `info` | (default) | |
| Role chip: MANAGER | `warning` | (default) | |
| Role chip: STAFF / VIEWER | `muted` | (default) | |
| Role chip: CAMPER | `secondary` | (default) | |
| Count / notification number | any semantic variant | `pill` | e.g. `variant="destructive" shape="pill"` |
| New listing over image | `overlay` | (default) | baked backdrop-blur; replaces the className override |
| Decorative feature chip (Host onboarding) | `secondary` | (default) | stays rounded-xl, NOT rounded-full |

---

## States (8) for every Badge usage

Badges are non-interactive read-only labels (not clickable) unless wrapped in a `<Link>` or
`asChild`. The 8 states apply to the entire containing element, not the badge alone.

| State | Spec |
|---|---|
| default | variant colors per taxonomy table; `rounded-xl`; `font-medium`; `text-xs` |
| hover | only when `[a]` ancestor (badge inside `<Link>`): `[a]:hover:bg-{variant}/80` — already in `badgeVariants`; no extra class |
| focus | `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50` — already in base CVA; visible ring present |
| active | inherits from `[a]` or the wrapping control |
| loading | Badge itself does not load; the containing section shows a `<Skeleton>` matching Badge dims (`h-5 w-16 rounded-xl`) |
| error | Badge is not an error input; the `variant="destructive"` communicates an error state in the domain |
| empty | No badge rendered when status is undefined; do not render a Badge with empty string |
| disabled | `aria-disabled="true"` on the wrapping control; Badge itself has no disabled state |

---

## What to add / change in `badge.tsx`

### A. New `shape` prop

```
// In the cva base, the default shape classes stay as-is:
//   rounded-xl  (the DS badge radius)
//
// Add a new "shape" variant:
shape: {
  default: "",               // no override — keeps rounded-xl from the base
  pill:    "rounded-full min-w-[1.25rem]",
},
defaultVariants: {
  variant: "default",
  shape: "default",
},
```

And update the function signature:

```ts
function Badge({
  className,
  variant = "default",
  shape = "default",     // NEW
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean })
```

### B. New `overlay` variant entry in the cva map

```
overlay:
  "bg-card/85 backdrop-blur-sm text-foreground border-border/40",
```

No other variant is changed.

### C. Nothing else changes in `badge.tsx`

The base still has `rounded-xl font-medium text-xs`. No `uppercase`, no `tracking-wider`,
no `font-bold`. The `shape` prop is the only structural addition; `overlay` is a single
variant line.

---

## Per-call-site replacement map

Frontend applies these changes file by file. Every replacement is prop-only — no className
for color, radius, font-weight, text-transform, ring, or shadow.

### 1. `components/Navbar.tsx:119` — HOST label next to logo

```tsx
// BEFORE (wrong)
<Badge variant="default" className="cursor-pointer hover:bg-primary/80 transition-colors text-xs px-2 py-0.5 font-bold uppercase">
  HOST
</Badge>

// AFTER — label from locales key; cursor/hover on the wrapping <Link>, not the Badge
<Badge variant="default">
  {t.nav.hostLabel}
</Badge>
```

Notes: `cursor-pointer hover:bg-primary/80 transition-colors` belong on the `<Link>` wrapper,
not the badge. The `[a]:hover:bg-primary/80` is already baked into `variant="default"`.
Drop `font-bold uppercase px-2 py-0.5 text-xs` — all covered by the DS default.

Locale key needed: `nav.hostLabel` → TH: `โฮสต์` / EN: `Host`

### 2. `app/dashboard/layout-client.tsx:79` — HOST label (desktop sidebar)

Same as Navbar:119.

```tsx
// AFTER
<Badge variant="default">
  {t.nav.hostLabel}
</Badge>
```

### 3. `app/dashboard/layout-client.tsx:143` — HOST label (mobile header)

Same as Navbar:119.

```tsx
// AFTER
<Badge variant="default">
  {t.nav.hostLabel}
</Badge>
```

### 4. `app/dashboard/layout-client.tsx:108` — count / notification pill

```tsx
// BEFORE (wrong)
<Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center rounded-full text-xs font-bold px-1.5">
  {item.badge}
</Badge>

// AFTER — shape="pill" handles rounded-full + min-w-5; px-1.5 stays (layout-only, acceptable)
<Badge variant="destructive" shape="pill" className="px-1.5">
  {item.badge}
</Badge>
```

`className="px-1.5"` is a layout-only spacing override, which is permitted. Everything else
(`rounded-full`, `min-w-5`, `font-bold`) comes from the prop.

### 5. `components/Navbar.tsx:234` — HOST chip inside DropdownMenuItem

```tsx
// BEFORE (wrong)
<Badge variant="default" className="rounded-full text-xs font-bold">HOST</Badge>

// AFTER
<Badge variant="default">
  {t.nav.hostLabel}
</Badge>
```

### 6. `app/host/page.tsx:20` — decorative "Host onboarding" chip

```tsx
// BEFORE (wrong)
<Badge variant="secondary" className="rounded-full">
  <Sparkles className="w-3.5 h-3.5 mr-1" />
  Host onboarding
</Badge>

// AFTER — drop rounded-full; DS default rounded-xl is correct here
<Badge variant="secondary">
  <Sparkles className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
  {t.host.onboardingChip}
</Badge>
```

Locale key needed: `host.onboardingChip` → TH: `เริ่มต้นโฮสต์` / EN: `Host onboarding`

### 7. `components/settings/TeamManagement.tsx:307` — OWNER role chip

```tsx
// BEFORE (wrong)
<Badge variant={getRoleVariant(member.role)} className="rounded-full text-xs font-bold">
  <Shield className="w-3 h-3 mr-1" />
  {member.role}
</Badge>

// AFTER
<Badge variant={getRoleVariant(member.role)}>
  <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
  {getRoleLabel(member.role, t)}
</Badge>
```

`getRoleLabel` should return the i18n label string, not the raw enum value (so `OWNER`
renders as `เจ้าของ` / `Owner`).

### 8. `components/settings/TeamManagement.tsx:362` — role chip in permission popover

```tsx
// BEFORE (wrong)
<Badge variant={getRoleVariant(member.role)} className="rounded-full text-xs font-bold">
  {member.role}
</Badge>

// AFTER
<Badge variant={getRoleVariant(member.role)}>
  {getRoleLabel(member.role, t)}
</Badge>
```

### 9. `app/dashboard/page.tsx:293` — booking status in table

```tsx
// BEFORE (wrong)
<Badge variant={variant} className="font-bold uppercase tracking-wider">
  {booking.status}
</Badge>

// AFTER — use the i18n label, not the raw enum string
<Badge variant={variant}>
  {t.bookings[labelKey]}
</Badge>
```

### 10. `app/dashboard/bookings/page.tsx:406` — booking status in table

Same as dashboard/page.tsx:293.

```tsx
// AFTER
<Badge variant={variant}>
  {t.bookings[labelKey]}
</Badge>
```

### 11. `app/bookings/page.tsx:144` — status badge over booking card image

```tsx
// BEFORE (wrong)
<Badge variant={variant} className="ring-2 ring-card shadow-sm font-bold tracking-wider">
  {label}
</Badge>

// AFTER — ring + shadow are the issue; legibility over a photo is handled by the card's
// image overlay scrim (the dark gradient at the bottom), not by ring/shadow on the badge.
// If the badge still needs to stand out over the image, use variant="overlay" layered
// on top of the semantic status — see note below.
<Badge variant={variant}>
  {label}
</Badge>
```

Note: if the badge sits directly on the photo without a scrim and legibility is genuinely
at risk, the containing `<div>` should add a subtle dark-to-transparent gradient at the top
(a layout responsibility, not the badge's). The badge itself must not carry `ring` or
`shadow` as DS overrides.

### 12. `app/bookings/[id]/BookingDetailClient.tsx:132` — status badge over cover image

```tsx
// BEFORE (wrong)
<Badge variant={variant} className="ring-2 ring-card shadow-sm font-bold tracking-wider rounded-xl" data-testid="badge--booking-status">

// AFTER
<Badge variant={variant} data-testid="badge--booking-status">
  {statusLabel}
</Badge>
```

`rounded-xl` was redundant (it is the DS default). `ring-2 ring-card shadow-sm font-bold
tracking-wider` are all dropped.

### 13. `app/profile/page.tsx:302` — role chip in profile form

```tsx
// BEFORE (wrong)
<Badge variant={roleVariant(profile?.role || 'CAMPER')} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
  {getRoleLabel(profile?.role || 'CAMPER', t.profile)}
</Badge>

// AFTER — px-4 py-1.5 are layout spacing; these are permitted as className additions
<Badge variant={roleVariant(profile?.role || 'CAMPER')} className="px-4 py-1.5">
  {getRoleLabel(profile?.role || 'CAMPER', t.profile)}
</Badge>
```

`font-bold uppercase tracking-wider` are dropped. `px-4 py-1.5` is a layout-only override
(extra padding for the profile display area) which is permitted.

### 14. `components/CampgroundCard.tsx:120` — "NEW" listing over image

```tsx
// BEFORE (wrong)
<Badge variant="secondary" className="h-6 px-2 text-xs font-medium bg-background/90 backdrop-blur-sm text-foreground shadow-sm border-border/50">
  {t.common.new}
</Badge>

// AFTER — variant="overlay" handles all of this; h-6 px-2 are layout, permitted
<Badge variant="overlay" className="h-6 px-2">
  {t.common.new}
</Badge>
```

---

## className additions: what is allowed vs forbidden

This is the canonical guard rule. Frontend must apply it; QA checks it at the design gate.

### Permitted className additions on `<Badge>` (layout-only)

- Positioning: `absolute top-3 left-3`, `relative`, `z-10`
- Margin / gap: `ml-1`, `mt-0.5`, `gap-2` (on the badge row container, not the badge itself)
- Extra padding: `px-4 py-1.5` when the design spec explicitly calls for it (profile role chip)
- `cursor-pointer` when the badge wraps a `<Link>` (prefer putting it on the link instead)
- `data-testid` attribute (not a class)

### Forbidden className additions on `<Badge>` (these override the variant/DS contract)

| Category | Forbidden examples |
|---|---|
| Color / background | `bg-background/90`, `bg-card/90`, `text-foreground`, `border-border/50`, any hex |
| Radius | `rounded-full`, `rounded-lg`, `rounded-2xl`, `rounded-3xl`, `rounded-md` |
| Font weight | `font-bold`, `font-semibold`, `font-normal` |
| Text transform | `uppercase`, `lowercase`, `capitalize` |
| Letter spacing | `tracking-wider`, `tracking-tight`, `tracking-widest` |
| Ring / shadow | `ring-2 ring-card`, `shadow-sm`, `shadow-md` |
| Height override | `h-6`, `h-7`, `h-8`, `h-5` (use `shape="pill"` for count pills, or leave DS default `h-5`) |
| min-width | `min-w-5`, `min-w-6` (use `shape="pill"`) |
| Backdrop / blur | `backdrop-blur-sm` (use `variant="overlay"`) |

---

## Copy (locales)

New keys required. Add to `locales/translations.ts` (TH + EN):

| Key | TH | EN |
|---|---|---|
| `nav.hostLabel` | `โฮสต์` | `Host` |
| `host.onboardingChip` | `เริ่มต้นโฮสต์` | `Host onboarding` |

Existing booking-status label keys in `t.bookings.*` are already in locales — call sites
must use `t.bookings[labelKey]` instead of the raw enum string (`booking.status` raw value
is an English programming constant, not user-facing copy).

Role label keys must go through `getRoleLabel(role, t)` which already exists; verify it
returns translated strings, not raw enum values.

---

## Validation UX

Badges are non-interactive read-only labels. No validation pattern applies.
If a badge status cannot be determined, do not render the Badge — render nothing (no empty
string, no placeholder).

---

## Components and tokens

### Components used (from `components/ui/*` only)

- `Badge` (`components/ui/badge.tsx`) — with the two additions specified above
- `Skeleton` (`components/ui/skeleton.tsx`) — `h-5 w-16 rounded-xl` as the loading placeholder

### Tokens referenced

All from `app/globals.css` OKLCH; no new token needed.

| Token | Used for |
|---|---|
| `primary` / `primary-foreground` | variant="default" |
| `secondary` / `secondary-foreground` | variant="secondary" |
| `destructive` | variant="destructive" (bg/10, border/30) |
| `success` / `success-foreground` | variant="success" |
| `warning` / `warning-foreground` | variant="warning" |
| `info` / `info-foreground` | variant="info" |
| `muted` / `muted-foreground` | variant="muted" |
| `border` | variant="muted" border, "outline" |
| `card` | variant="overlay" background (bg-card/85) |
| `foreground` | variant="overlay" text |
| `ring` | focus ring (already in base CVA) |

No new tokens are added. No `dark:` overrides are hand-written — all tokens flip automatically
via the `.dark` class.

---

## a11y (WCAG 2.1 AA)

- **Color not the only signal:** every badge variant uses a semantic color + visible text label.
  Never render a Badge with only color (e.g. no text, no icon that has an aria-label). — Required.
- **Contrast:** all token variant pairs meet 4.5:1 body text AA on their respective backgrounds.
  Spot-check: `success` teal on `success/10` tint = approximately 4.8:1 light mode (not measured
  precisely — mark **not measured**; Frontend must verify with axe before merge).
- **Overlay variant legibility:** `text-foreground on bg-card/85 over a photo` — contrast
  depends on the photo; the `backdrop-blur-sm` and `/85` opacity provide a minimum of ~2.5x
  scrim boost. If the photo is very light, the design calls for the containing `<div>` to add
  a dark gradient scrim at the image top. The badge alone is not responsible for photo contrast.
- **Focus ring:** `focus-visible:ring-[3px] focus-visible:ring-ring/50` is already in the base
  CVA; visible on keyboard navigation.
- **Touch target:** Badge is a display-only element. If a Badge is the only click target
  (wrapped in `<Link>` without other text), the wrapping element must be at least 44px tall
  (`h-11`). The HOST label in the Navbar is inside a `<Link>` that wraps logo + badge — verify
  the link's tap target includes the logo image.
- **Accessible name for icons inside badges:** all icon elements passed as children must have
  `aria-hidden="true"` since the badge text provides the accessible name.
- **Count pills:** add `aria-label` to the containing nav link, e.g. `aria-label="Bookings, 3 pending"`,
  so the count is not announced as a bare number out of context.
- **axe:** run before merge — no violations allowed.

---

## Anti-slop audit (DESIGN.md §5)

| Check | Status |
|---|---|
| Token-only — no floating hex | PASS: all variant colors map to semantic tokens |
| Radius by role — badge is `rounded-xl` (inner element) | PASS: the spec enforces this; `rounded-full` only via `shape="pill"` |
| No font-bold / uppercase decoration | PASS: `font-medium normal-case` is the canonical |
| Clear hierarchy — badge conveys a status, not decoration | PASS: taxonomy maps every case to a semantic variant |
| CampVibe tone — teal/mist, calm | PASS: status colors are already the OKLCH teal/amber/red set |
| No card-stacked-on-card / shadow abuse | PASS: ring + shadow overrides are removed |

---

## Reference

Visual reference PNG:
`/tmp/claude-0/-home-user-campvibe/c75ee324-b73c-5262-b279-58cd8fa163b0/scratchpad/badge-canonical.png`

Anti-slop criteria that must pass at the design gate:

1. No call site passes a color, radius, font-weight, text-transform, tracking, ring, or shadow
   className to `<Badge>`.
2. All status text is pulled from `locales/` keys — no raw enum value rendered as user-facing copy.
3. `shape="pill"` is the only path to a circular badge — no `rounded-full` in className.
4. `variant="overlay"` is the only path to the backdrop-blur chip — no `backdrop-blur-sm` in
   className.
5. `npm run check:palette` exits 0 — no new hardcoded hex introduced.

---

## Links

- `DESIGN.md` §2 (radius by role: `rounded-xl` for badge / inner element)
- `DESIGN.md` §3.1 (component index — Badge: "status label, not clickable")
- `DESIGN.md` §5 (anti-slop: no decorative bold/uppercase)
- `DESIGN.md` §6 (quality gate — token-only, all 8 states, a11y AA)
- `components/ui/badge.tsx` — the component to receive the two additions
- `app/globals.css` — authoritative OKLCH token values

---

## Changelog

- v1 (2026-06-29) — created; covers all 14 call sites, 2 component additions, taxonomy table,
  allowed/forbidden className guard rule, per-site replacement map, locales keys, a11y notes.
