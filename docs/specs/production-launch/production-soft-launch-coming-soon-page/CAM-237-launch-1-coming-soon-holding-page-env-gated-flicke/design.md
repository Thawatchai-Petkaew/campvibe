---
linear: CAM-237
feature: production-launch
epic: production-soft-launch-coming-soon-page (CAM-236)
artifact: design
status: In Review
version: v1
updated: 2026-06-28
---

# Design Brief — LAUNCH-1 Coming Soon holding page (CAM-237)

## User job (from AC)

A first-time visitor opens the prod URL while the platform is env-gated. They must land on a friendly, on-brand page that signals "we are building something" without any risk of accessing real data, auth flows, or API endpoints. The page must feel like CampVibe, not a generic "under construction" template.

**Flow:** visitor opens any prod URL → middleware rewrites all routes → renders `/coming-soon` → sees mascot animation + copy → no further interaction required (static, no form, no DB).

---

## Art recommendation — walk-sprite cycle (option a, strongly recommended)

**Recommended art:** cycle `walk-front-right-0.webp` and `walk-front-right-1.webp` at 350ms per frame (a slow, gentle walk in place facing the visitor).

**Reasoning:**

- The owner asked for "flicker art" — the 2-frame walk cycle is literally the flicker mechanic already used in `/status/map`. It delivers exactly the cute mascot-walks-in-place effect intended.
- Both frames together = ~26KB total (.webp, immutable-cached). The static mascot PNGs are 494–604KB each and would require no animation. The relax poses cycle 6 frames and the idle/resting body language reads less like "we are building" and more like "nobody is home."
- The front-facing walk direction feels welcoming — the mascot is walking toward the visitor, not away.
- The `walk-front-right-0/1` pair already has an immutable-cache header set via `next.config.ts` (story rule: `/public/status-map/sprites` is in the allowlist and served immutable). Zero Vercel Image Optimizer cost.

**Asset paths (exact, use `<img>` not `next/image`):**

- Frame 0: `/status-map/sprites/walk-front-right-0.webp`
- Frame 1: `/status-map/sprites/walk-front-right-1.webp`

**Reduced-motion fallback:** show only frame 0 (`walk-front-right-0.webp`) as a static image. No cycling. Required — see a11y section.

**Display size:** render at `96px × 96px` (`w-24 h-24`) on mobile, `128px × 128px` (`w-32 h-32`) on md+. The sprites are pixel art — use `image-rendering: pixelated` to keep the crisp pixel edges at this upscaled size (this is a CSS property, not a token; it is the correct treatment for pixel-art assets).

---

## Copy — TH + EN options (owner picks one)

All copy lands in `locales/translations.json` under a new top-level `comingSoon` namespace (not the existing `settings.comingSoon` label which is a badge, not a page). Keys and verbatim strings below.

### Option A — Outdoor/camping metaphor ("setting up camp")

| key | TH | EN |
|---|---|---|
| `comingSoon.title` | `กำลังตั้งแคมป์อยู่นะ` | `Setting up camp` |
| `comingSoon.subtitle` | `เว็บไซต์จะเปิดให้บริการเร็วๆ นี้` | `We'll be open soon` |
| `comingSoon.mascotAlt` | `มาสคอต CampVibe กำลังเดิน` | `CampVibe mascot walking` |

**Character:** warmest of the three. "ตั้งแคมป์" is a literal camping verb — it puts the brand identity directly into the waiting message. Feels like the team is literally setting up the campsite before opening the gate.

### Option B — Direct / friendly ("working on it")

| key | TH | EN |
|---|---|---|
| `comingSoon.title` | `เรากำลังดำเนินการ` | `We're working on it` |
| `comingSoon.subtitle` | `เว็บไซต์จะเปิดให้บริการเร็วๆ นี้` | `Coming soon` |
| `comingSoon.mascotAlt` | `มาสคอต CampVibe กำลังเดิน` | `CampVibe mascot walking` |

**Character:** clear and on-brand, matches the verbatim AC copy. Safe choice if the owner wants to stay literal to the ticket.

### Option C — Adventure metaphor ("adventure is coming")

| key | TH | EN |
|---|---|---|
| `comingSoon.title` | `การผจญภัยกำลังมา` | `Your adventure is coming` |
| `comingSoon.subtitle` | `CampVibe จะเปิดให้จองแคมป์เร็วๆ นี้` | `Book your next camp with us — opening soon` |
| `comingSoon.mascotAlt` | `มาสคอต CampVibe กำลังเดิน` | `CampVibe mascot walking` |

**Character:** most evocative, leans into the outdoor/adventure tone. The subtitle names the product value ("จองแคมป์") which helps explain what CampVibe is to a brand-new visitor.

**Owner: please pick A, B, or C.** Designer recommendation = **Option A** ("กำลังตั้งแคมป์อยู่นะ") — it earns the camping metaphor that separates CampVibe from a generic SaaS coming-soon.

**Thai copy rules verified for all options:**
- No em-dash (—) as a separator.
- No technical jargon (no "API", "endpoint", "flag", "env").
- Friendly, polite, action-implied tone.
- "เร็วๆ นี้" not "Soon™" / not "Under Construction".

---

## Layout

### Structure (mobile-first, vertical stack)

```
[page background: bg-background]
  [centered column, max-w-sm on mobile / max-w-md on md+]
  [py-16 md:py-24, px-6]

    [logo]
      <img src="/logo.png"> — 80px height, auto width
      margin-bottom: gap-8 (mb-8)

    [mascot animation]
      <img> cycling walk-front-right-0/1 at 350ms
      w-24 h-24 (mobile) / w-32 h-32 (md+)
      image-rendering: pixelated
      margin-bottom: gap-6 (mb-6)

    [title]
      font: text-2xl font-semibold (Outfit EN / Sarabun semibold TH)
      color: text-foreground
      text-align: center
      margin-bottom: gap-2 (mb-2)

    [subtitle]
      font: text-base text-muted-foreground
      text-align: center
      max-w-xs mx-auto (reading line length)
```

### Tokens used

| element | token / utility |
|---|---|
| Page background | `bg-background` |
| Title color | `text-foreground` |
| Subtitle color | `text-muted-foreground` |
| Title font size | `text-2xl` |
| Subtitle font size | `text-base` |
| Title weight | `font-semibold` |
| Outer padding (vertical) | `py-16 md:py-24` |
| Outer padding (horizontal) | `px-6` |
| Logo margin | `mb-8` |
| Mascot margin | `mb-6` |
| Subtitle margin | `mt-2` |
| Max width | `max-w-sm` (mobile) / `max-w-md` (md+) |
| Subtitle line width | `max-w-xs` |

No new tokens required. No raw hex values. No gradient. No shadow. `bg-background` is the page — the teal-tinted white already reads as CampVibe without adding any overlay.

### What is deliberately absent

- No card/panel wrapping the content — the mascot and text float on `bg-background` directly (no "card nested in a card" slop).
- No button / CTA — AC says no form, no interaction. Adding a CTA button would violate the out-of-scope rule (no email capture) and add an unnecessary tap target.
- No social links — deferred per AC out-of-scope; adds API/auth risk.
- No progress bar or countdown timer — no ETA is known; a fake one breaks trust.

---

## Components

This page uses no components from `components/ui/*` because there are no interactive elements, no form, no error state, and no dynamic data. The page is a static HTML render.

The only primitives used are native `<img>` tags (not `next/image` per the story rule: art must not go through Vercel Image Optimizer — "$0 image cost" is an explicit AC requirement). The JavaScript animation is a `setInterval` frame swap behind a `prefers-reduced-motion` check.

No lucide icons are used. No icon is needed on this page — the mascot art carries the visual weight.

---

## States

This is a static informational page. The only "state" is the animation state.

| state | behavior |
|---|---|
| default (motion on) | mascot cycles walk-front-right-0 → walk-front-right-1 at 350ms interval |
| reduced-motion | mascot shows walk-front-right-0 as a static image; no interval runs |
| JS disabled (no-JS) | mascot shows walk-front-right-0 as a static image (the `<img src>` default); no interval needed |
| dark mode | `bg-background` / `text-foreground` / `text-muted-foreground` flip via `.dark` automatically; no manual dark: override needed |

The page has no hover, focus, active, loading, error, empty, or disabled interactive states because there are no interactive elements. The a11y requirements below cover the non-interactive a11y obligations.

---

## Accessibility (WCAG 2.1 AA — mandatory)

1. **Alt text** — the mascot `<img>` must have `alt` equal to the `comingSoon.mascotAlt` i18n value. The logo `<img>` must have `alt="CampVibe"`.

2. **Reduced motion** — the frame-cycling `setInterval` MUST be gated behind `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. If true, only frame 0 renders. This is a hard requirement from DESIGN.md §6 motion token.

3. **Contrast:**
   - `text-foreground` on `bg-background` = `oklch(0.148…)` on `oklch(1 0 0)`. This is the darkest token on the lightest token. Contrast ratio is very high — passes AA by a large margin. Measurement: not measured with a tool, but token values confirm this is the darkest/lightest pair in the palette. Mark: passes AA (token-guaranteed).
   - `text-muted-foreground` (`oklch(0.56 0.021 213.5)`) on `bg-background` (`oklch(1 0 0)`). This is the muted/secondary text color. Not measured with a contrast tool — mark as **not measured, must verify before merge** using a contrast checker (e.g. axe or WebAIM). If it fails 4.5:1 (which is possible for muted text), use `text-foreground` for the subtitle instead.

4. **Focus** — no focusable elements on this page. No tab order required. No focus ring gap.

5. **Tap target** — no interactive elements. No tap target obligation.

6. **Landmark** — the page must have a `<main>` landmark wrapping the content so screen readers can navigate to it.

7. **Language** — the page must set `lang` attribute correctly (from the locale: `lang="th"` or `lang="en"`).

---

## Anti-slop check

| slop tell (§5) | CampVibe counter applied |
|---|---|
| centered hero + purple-blue gradient + 3 identical cards | single centered column on plain `bg-background`; no gradient; no cards; no repetition |
| generic heading font (Inter/Roboto/system) | Outfit (EN) / Sarabun semibold (TH) per §2 typography |
| decorative meaningless badges or floating icon pills | no decoration; every element serves the message |
| gradients / heavy shadows / cards stacked on cards | no shadow, no gradient, no card wrapper |
| over-saturated or flat-gray colors | OKLCH tokens only; no numbered gray |
| generic copy ("Under Construction" / "Check back soon") | Option A: "กำลังตั้งแคมป์อยู่นะ" earns the camping metaphor |
| "Under construction" cliché framing | mascot is the personality; warm verb "ตั้งแคมป์" makes it CampVibe-specific |

---

## i18n requirements for Frontend

Add the following block to `locales/translations.json` under both `en` and `th` top-level keys as a new `comingSoon` namespace at the root level (not nested under any existing key).

English block (add to `en`):
```json
"comingSoon": {
  "title": "Setting up camp",
  "subtitle": "We'll be open soon",
  "mascotAlt": "CampVibe mascot walking"
}
```

Thai block (add to `th`):
```json
"comingSoon": {
  "title": "กำลังตั้งแคมป์อยู่นะ",
  "subtitle": "เว็บไซต์จะเปิดให้บริการเร็วๆ นี้",
  "mascotAlt": "มาสคอต CampVibe กำลังเดิน"
}
```

Replace "Setting up camp" / "กำลังตั้งแคมป์อยู่นะ" with the owner-chosen copy option if different from Option A.

---

## Error pattern

Not applicable. This page has no form, no input, and no server call. There is no error state to handle. The page must never call `auth()` or Prisma.

---

## Reference

Single reference for on-brand tone: the existing `/status/map` mascot animation in `app/status/map/scene-loader.tsx` (uses the same walk-sprite frames in the same cycling pattern). The coming-soon page should feel like the same mascot from the same product, stripped of all chrome — not a new design language.

Anti-slop criteria that must pass at the design gate:
1. Screenshot shows logo + mascot + title + subtitle on plain `bg-background`. Nothing else.
2. No hardcoded hex or px in any className.
3. `npm run check:palette` green.
4. `prefers-reduced-motion` path shows a static frame (verified in browser DevTools: Rendering > Emulate CSS media).
5. `text-muted-foreground` contrast verified with axe or WebAIM contrast checker before merge.

---

## Design gate verdict

**PASS — ready for Frontend handoff.**

Conditions on Frontend before merge:
- Critical: verify `text-muted-foreground` contrast meets 4.5:1 AA (not measured — must verify).
- Critical: `prefers-reduced-motion` must be implemented and tested.
- Critical: `<img alt>` from i18n key on both logo and mascot.
- Important: `image-rendering: pixelated` on the mascot `<img>` so pixel art does not blur at 96/128px.
- Info: the `comingSoon` namespace must be a new root-level key in `translations.json`, not reusing `settings.comingSoon` (which is a badge label, not a page namespace).
