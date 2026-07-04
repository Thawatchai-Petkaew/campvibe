---
linear: CAM-218
feature: performance-and-freshness
epic: data-layer-performance-and-freshness
persona: Camper
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-27
---
# Design — ERR-1 Platform Error-State Standard (CAM-218)

## Flow

User lands on or navigates to a URL that resolves to an error condition:

1. **not-found (404)** — route does not exist or resource is missing: Navbar stays → full-page ErrorState variant `not-found` renders below Navbar.
2. **error (500 / unexpected)** — unhandled exception or server error: Navbar stays → full-page ErrorState variant `error` with retry CTA + go-home CTA.
3. **forbidden (403)** — authenticated user has no permission: Navbar stays → full-page ErrorState variant `forbidden` with go-home CTA only (no retry, no existence leak).
4. **generic** — any other catch-all error context: Navbar stays → full-page ErrorState variant `generic` with go-home CTA.

In-page / compact use (e.g. a section failed to load while the rest of the page is fine): caller passes `compact={true}`, component renders at reduced height inline, mascot at `w-32 h-32`, no full-screen centering.

---

## States (8) — for the ErrorState component

| State | Behaviour |
|---|---|
| **default** | Asymmetric layout renders: mascot left, text block right (desktop); stacked mascot-top / text-below (mobile). Glow ring behind mascot. |
| **hover** | Primary CTA button: `bg-primary` darkens per token `active` state via Tailwind `hover:` variant (already in Button component). Secondary CTA: `outline` hover per Button. No effect on mascot or wrapper. |
| **focus** | Visible focus ring (`ring-ring`, `outline-ring/50`) on both CTA buttons. Tab order: first CTA → second CTA (if present). |
| **active** | Button press `active:scale-95` per DESIGN.md motion token. |
| **loading** | Not applicable to ErrorState itself — this component IS the resolved error state. In-page skeleton (`LoadingSkeleton`) handles the loading state before the error is known. |
| **empty** | Not applicable — ErrorState is not a list/data component. |
| **error** | The component itself IS an error state. Image fallback: if mascot PNG is missing, `ImageWithFallback` shows `ImageOff` lucide icon in a `bg-muted rounded-full` container — graceful, never a broken-image browser icon. |
| **disabled** | CTA buttons: if `onRetry` is not provided for the `not-found` / `forbidden` variants, the retry button does not render at all (not rendered, not disabled). The go-home link is always present and never disabled. |

---

## Layout specification

### Desktop (md+): asymmetric two-column

```
flex-col md:flex-row   gap-12 md:gap-16
items-center md:items-center
max-w-4xl mx-auto px-6 py-16

[LEFT: mascot column]                  [RIGHT: text block]
flex-shrink-0                          flex flex-col items-start
w-48 md:w-64 (full) / w-28 (compact)  text-left
```

The text block (right column) is left-aligned — NOT centered. This is the anti-slop requirement: no centered-hero cliche.

### Mobile (below md): stacked

```
flex-col items-center text-center
mascot on top, text block below
```

Mobile text is centered (`text-center`) because there is no asymmetry on narrow screens. Desktop is left-aligned.

### Full-page wrapper

```
min-h-[calc(100vh-64px)]   (64px = Navbar height; Navbar stays on top)
flex items-center justify-center
bg-background px-4
```

Compact (`compact={true}`) wrapper:

```
py-12 flex items-center justify-center
(no min-height, no full-screen)
```

---

## Mascot treatment

### Glow ring (mirrors EmptyState)

Behind the mascot image:

```
absolute inset-0 bg-primary/10 rounded-full blur-3xl opacity-20
group-hover:opacity-30 transition-opacity duration-200
```

Wrapper for glow + image:

```
relative mb-8 md:mb-0 group
```

### Mascot image sizes

| Context | Width class | Approximate render |
|---|---|---|
| Full-page, all variants | `w-48 md:w-64` | 192px → 256px |
| Compact | `w-32` | 128px |

Use `ImageWithFallback` in fixed-width mode (pass `width` + `height` props) so next/image does not require `fill` and a relative wrapper.

Suggested intrinsic prop: `width={320} height={320}` (the mascot PNGs are square-safe). Frontend should tune to the actual PNG dimensions.

No `priority` prop — error pages are not LCP candidates.

### Dark mode

Transparent PNGs display correctly on both `background` (light) and the dark `background` token. No `-dark` asset variant needed. No `dark:hidden` / `hidden dark:block` pattern (unlike EmptyState's SVG swap, which needed it because the SVGs had baked-in background fills).

---

## Typography & title style

| Element | Class |
|---|---|
| Title (h1) | `text-2xl md:text-3xl font-bold text-foreground` (Outfit/Sarabun via `--font-display`) |
| Message | `text-muted-foreground text-base md:text-lg max-w-sm` |
| Spacing between title and message | `mb-3` |
| Spacing between message and CTA(s) | `mt-6` |
| CTA group | `flex flex-col sm:flex-row gap-3` |

---

## CTA buttons

| Variant | Primary CTA | Secondary CTA |
|---|---|---|
| `not-found` | `variant="default" size="lg"` → go home | none |
| `error` | `variant="default" size="lg"` → retry (`onRetry` callback) | `variant="outline" size="default"` → go home (link) |
| `forbidden` | `variant="default" size="lg"` → go home | none |
| `generic` | `variant="default" size="lg"` → go home | none |

- All buttons: `rounded-full` (already in Button component per DESIGN.md §2)
- Size `lg` = `h-12` for the primary CTA
- Size `default` (`md`) = `h-11` for secondary CTA
- Tap target: h-12 = 48px and h-11 = 44px — both meet ≥44px
- Primary CTA icon: `Home` (lucide) at left, size 16px, `aria-hidden="true"`
- Retry CTA icon: `RotateCcw` (lucide) at left, size 16px, `aria-hidden="true"`

---

## Props contract (for Frontend reference)

```ts
interface ErrorStateProps {
  variant: 'not-found' | 'error' | 'forbidden' | 'generic';
  title?: string;           // overrides the i18n default title for this variant
  message?: string;         // overrides the i18n default message
  actionLabel?: string;     // overrides the primary CTA label
  actionHref?: string;      // primary CTA href (defaults to '/')
  onRetry?: () => void;     // if provided on 'error' variant, shows the retry button
  compact?: boolean;        // renders inline at reduced size (no full-screen min-height)
}
```

Defaults: `actionHref = '/'`. Title/message default to the i18n key for the variant. Frontend picks the copy from `t.errors.<variant>.title` / `.message` / `.cta` / `.retryLabel`.

---

## Mascot pose → variant mapping

| Variant | Pose | Filename |
|---|---|---|
| `not-found` | Thinking / scratching head | `/mascot/thinking.png` |
| `error` | Sitting cross-legged with laptop | `/mascot/coding.png` |
| `forbidden` | Waving | `/mascot/waving.png` |
| `generic` | Walking with laptop side-view | `/mascot/walking.png` |

---

## Accessibility (WCAG 2.1 AA)

- Wrapper `role="alert"` for `error` variant (content is urgent, announced immediately by screen readers). All other variants use `role="status"` (polite announcement).
- Mascot `<img>` alt text from `t.errors.<variant>.mascotAlt` (i18n key, not hardcoded). The alt describes the pose in plain language, not "error illustration."
- Both CTA buttons have accessible names from their visible label text — no `aria-label` needed beyond the visible copy.
- `Home` and `RotateCcw` icons carry `aria-hidden="true"` — the button text carries the accessible name.
- Focus ring: `ring-ring` / `outline-ring/50` via the Button component — no override needed.
- Color is not the only signal: the error identity is conveyed by the title text, not color alone.
- Contrast: `text-foreground` on `bg-background` and `text-muted-foreground` on `bg-background` both use system tokens that meet AA at 4.5:1 (foreground) and approximately 4.6:1 (muted-foreground) — **not measured independently for this brief; relies on the token contract in DESIGN.md**.

---

## Reduced-motion handling

The glow ring uses `transition-opacity duration-200`. When `prefers-reduced-motion: reduce`, this must be suppressed. Frontend wraps the transition in `motion-safe:transition-opacity` or uses the Tailwind `motion-reduce:transition-none` utility on that element. No other motion is present in ErrorState.

---

## Tokens referenced

| Purpose | Token / class |
|---|---|
| Page background | `bg-background` |
| Card surface (not used — full-page is background, not card) | — |
| Primary text (title) | `text-foreground` |
| Secondary text (message) | `text-muted-foreground` |
| Glow | `bg-primary/10` |
| Primary CTA | `variant="default"` → `bg-primary text-primary-foreground` |
| Secondary CTA | `variant="outline"` → `border-border text-foreground` |
| Image fallback bg | `bg-muted` (via ImageWithFallback) |
| Radius: buttons | `rounded-full` (Button default) |
| Spacing: gap between columns | `gap-12 md:gap-16` |
| Spacing: text block internal | `mb-3` title→message, `mt-6` message→CTA |
| Motion: glow ring | `transition-opacity duration-200` (motion-safe only) |

No new tokens. All values come from the existing system.

---

## Components used

- `components/ui/button` — primary and secondary CTA
- `components/ui/image-with-fallback` — mascot PNG with graceful fallback to `ImageOff`
- `lucide-react`: `Home`, `RotateCcw`, `ImageOff` (ImageOff is already inside ImageWithFallback)
- `contexts/LanguageContext` → `useLanguage()` for i18n
- `components/Navbar` — remains on page; ErrorState renders below it

---

## i18n copy — `errors` block

Ready-to-paste into `locales/translations.json` under both `"en"` and `"th"` top-level keys.

### English (`"en"`)

```json
"errors": {
  "notFound": {
    "title": "Page not found",
    "message": "This page has moved or no longer exists. Let's get you back on the trail.",
    "cta": "Back to home",
    "mascotAlt": "Mascot thinking"
  },
  "unexpected": {
    "title": "Something went wrong",
    "message": "An unexpected error occurred. Try again or return home.",
    "retryLabel": "Try again",
    "cta": "Back to home",
    "mascotAlt": "Mascot with laptop"
  },
  "forbidden": {
    "title": "Access not permitted",
    "message": "You don't have permission to view this page.",
    "cta": "Back to home",
    "mascotAlt": "Mascot waving"
  },
  "generic": {
    "title": "Something went wrong",
    "message": "We couldn't load this page. Please try again later.",
    "cta": "Back to home",
    "mascotAlt": "Mascot walking"
  }
}
```

### Thai (`"th"`)

```json
"errors": {
  "notFound": {
    "title": "ไม่พบหน้านี้",
    "message": "หน้านี้ถูกย้ายหรือไม่มีอยู่แล้ว กลับไปหน้าหลักเพื่อค้นหาแคมป์ที่ชอบ",
    "cta": "กลับหน้าหลัก",
    "mascotAlt": "มาสคอตกำลังคิด"
  },
  "unexpected": {
    "title": "เกิดข้อผิดพลาด",
    "message": "มีข้อผิดพลาดที่ไม่คาดคิดเกิดขึ้น ลองใหม่อีกครั้งหรือกลับหน้าหลัก",
    "retryLabel": "ลองใหม่อีกครั้ง",
    "cta": "กลับหน้าหลัก",
    "mascotAlt": "มาสคอตพร้อมแล็ปท็อป"
  },
  "forbidden": {
    "title": "ไม่มีสิทธิ์เข้าถึง",
    "message": "คุณไม่มีสิทธิ์ดูหน้านี้",
    "cta": "กลับหน้าหลัก",
    "mascotAlt": "มาสคอตโบกมือ"
  },
  "generic": {
    "title": "เกิดข้อผิดพลาด",
    "message": "โหลดหน้านี้ไม่สำเร็จ กรุณาลองใหม่ภายหลัง",
    "cta": "กลับหน้าหลัก",
    "mascotAlt": "มาสคอตเดินทาง"
  }
}
```

Copy rules verified:
- No em-dash used as a separator anywhere
- No technical jargon (no "404", "403", "500", "API", "server error" in user-facing text)
- Thai: สุภาพ + action-oriented, each message ends with a clear action or context
- EN: concise imperative register

---

## Design gate checklist

- [x] **Token-only** — all colors via `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary/10`. No floating hex or px. `npm run check:palette` will pass.
- [x] **Component-in-system** — `Button`, `ImageWithFallback`, lucide icons (`Home`, `RotateCcw`, `ImageOff`). No invented components.
- [x] **Scale matches role** — buttons `rounded-full`, card-level surfaces (not used here — full-page), no inline height override.
- [x] **All 8 states specified** — default / hover / focus / active / loading / empty / error / disabled all addressed above.
- [x] **a11y AA** — `role="alert"` / `role="status"`, icon `aria-hidden`, tap ≥44px (h-11 / h-12), focus ring via Button component. Contrast relies on token contract (not independently measured — mark: **not measured**).
- [x] **i18n** — TH + EN in `errors` block above. No hardcoded strings. No em-dash separator. No jargon.
- [x] **Motion** — glow ring only, `transition-opacity duration-200` (within 120–250ms window), `motion-safe:` wrapper required. No `transition: all`.
- [x] **Anti-slop** — asymmetric desktop layout (mascot left, left-aligned text right), not a centered hero. No gradient. No decorative badges. Teal glow only via `bg-primary/10`. CampVibe tone.
- [x] **Layout sanity** — Navbar stays above. CTA does not wrap on desktop (flex-row at sm+). One primary CTA per variant. `error` variant has 2 CTAs with distinct intent (retry vs home — not duplicate intent).
- [x] **No dark: overrides** — transparent PNG + token surfaces handle dark mode automatically.

## Links

- `DESIGN.md` — token tables, anti-slop, 8-state requirement
- `components/ui/image-with-fallback.tsx` — mascot image wrapper
- `components/EmptyState.tsx` — reference for glow + light/dark idiom
- `public/mascot/README.md` — asset placement guide for owner
- `components/ui/form-patterns.md` — error pattern (ErrorState is distinct: full-page, not a form error)

## Changelog

- v1 (2026-06-27) — created (ERR-1 Design Brief, CAM-218)
