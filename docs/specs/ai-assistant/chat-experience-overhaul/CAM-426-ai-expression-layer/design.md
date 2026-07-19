---
ticket: CAM-426
feature: ai-assistant
epic: chat-experience-overhaul
persona: Camper
artifact: design
owner: ux-designer
status: in-progress
version: v2
updated: 2026-07-19
---

# Design — AI Expression Layer · น้องกองไฟ (CAM-426)

> **Purpose.** The FINAL, comprehensive visual design spec for the whole AI chat surface.
> This **supersedes v1** (the generic "AI-ambient aurora" brief on PR #492). The owner changed the
> look-and-feel direction: the assistant is **น้องกองไฟ** (Nong Kongfai, the campfire mascot) and the
> surface is **camping-themed**, not generic-AI. The ล้ำ (advanced) lives in the UX + tech; the VISUAL is a
> quiet campfire-at-night feel — soft fireflies, a few star sparkles, gentle rising embers, and a small warm
> flame on the avatar. **All dimmed and soft: readability wins over glow.**
>
> **This is a G2 design artifact.** The owner delegated full autonomy on this epic, so the exception below is
> **self-approved at G2** under that delegation (see §11). Frontend (S2) applies every diff after this hands off.
> **Nothing here edits `app/globals.css` / `DESIGN.md` / `locales/` yet** — those are the FE build checklist (§10).

---

## 0) Brand POV — what "camping-themed ล้ำ" means here

CampVibe's POV (DESIGN.md §1): teal/mist + clean white, Airbnb-light, one dominant cell per section, no gradients-as-slop.
น้องกองไฟ keeps that POV and adds a **night-at-camp** atmosphere ONLY in the assistant surface's decorative backdrop:

- **Day palette stays.** Text, cards, and controls keep the standard tokens (`foreground`, `card`, `primary`). The
  camping feel is a **backdrop layer**, never a wash over content.
- **Warmth is an accent, not the ground.** Teal (`--primary`) + sky (`--info`) remain the surface identity; the warm
  campfire colors (ember, firefly) appear only as tiny points of light and one faint horizon glow — the "escape the
  average" move (DESIGN.md §5) is: a campfire scene rendered with restraint, not a saturated orange gradient.
- **Readability is the hard constraint (owner).** Every readable element sits on a solid-enough glass surface; the
  ambient lives BEHIND that surface (blurred + dimmed), so chat text is never fighting the animation. If a choice
  trades legibility for atmosphere, legibility wins.

Anti-slop hold for this surface: no purple/blue AI gradient, no full-bleed orange, no cards-in-cards, no default
`shadow-xl`. lucide icons only, no emoji. One dominant surface (the panel / the detail card), light chrome.

---

## 1) `--ai-*` token set — finalized (camping: teal + sky + warm ember/firefly)

Seven tokens, complete light + dark, OKLCH in the globals.css style. Hues used, all sanctioned in §2's exception:
**teal 186–188** (`--primary`), **sky 237** (`--info`), **blend 205–222**, and **warm camping accents 55–105**
(ember/firefly, derived from the `--warning` amber family). Nothing is an invented brand hue.

| token | role | light | dark |
|---|---|---|---|
| `--ai-surface` | glass panel + readable-content backdrop (translucent, pairs with `backdrop-blur`). **High opacity for legibility.** | `oklch(0.980 0.008 210 / 0.86)` | `oklch(0.230 0.014 222 / 0.84)` |
| `--ai-tint` | assistant message-bubble fill (opaque, `text-foreground` on it ≥ AA) | `oklch(0.965 0.016 205)` | `oklch(0.305 0.024 216)` |
| `--ai-glow` | ambient glow box-shadow on panel + detail card + avatar (**dimmed/soft**, NOT `shadow-xl`) | see block (a) | see block (b) |
| `--ai-gradient` | ambient aurora bg-image: teal→sky + a faint warm campfire horizon at the bottom | see block (a) | see block (b) |
| `--ai-ember` | rising-ember particles + the avatar flame (warm orange, from `--warning`) | `oklch(0.720 0.170 55)` | `oklch(0.780 0.180 58)` |
| `--ai-firefly` | fireflies-follow-cursor particles (warm yellow-green glow) | `oklch(0.860 0.160 100)` | `oklch(0.900 0.170 105)` |
| `--ai-star` | star-sparkle particles (cool near-white, sky-tinted, from `--info`) | `oklch(0.950 0.020 237)` | `oklch(0.970 0.030 237)` |

**Why 7 (leanness check):** each is load-bearing and independently tunable (owner said "all dimmed" and may want to
dim each on its own). `surface`+`tint` = readability, `glow`+`gradient` = the camping backdrop base, `ember`+`firefly`+`star`
= the three colored gimmicks. The particle colors are **tokens** (not hardcoded in the canvas) so dark mode flips
correctly and `check:palette` stays green — the canvas reads them via `getComputedStyle`.

**Contrast honesty (NOT tool-measured here — FE axe-verifies at build, Design Gate a11y):**
- assistant bubble = `text-foreground` on opaque `bg-ai-tint`. Light: L≈0.965 fill vs L≈0.148 text = parity with
  foreground-on-background (a combo the token system already guarantees ≥ AA). Dark: L≈0.305 fill vs L≈0.987 text =
  high contrast. **AA by token parity.**
- readable content sits on `bg-ai-surface` (0.86 / 0.84 alpha) + `backdrop-blur` over a solid page base → the ambient
  behind is blurred and dimmed under the surface, so `text-foreground` / `text-muted-foreground` keep their normal
  contrast. **Marked AA-by-parity; axe-verify required.**

### Exact lines to add to `app/globals.css` (anchored to THIS branch's globals.css — 177 lines)

> Re-anchor note: this worktree's `globals.css` is **177 lines** and has **NO `prefers-reduced-motion` block yet**
> (v1 assumed L200–211 on a different baseline — that block does not exist here, so FE must ADD it in block (d)).
> `:root` closes at L124, `.dark` closes at L165, `@theme inline` closes at L80.

**(a) `:root` block — insert after L123 (`--foreground:`), before the closing `}` (L124). Light values:**

```css
    /* ── CAM-426 น้องกองไฟ AI Expression Layer — assistant surface only (see DESIGN.md §2.1) ── */
    /* Teal 186–188 (--primary) + sky 237 (--info) + warm camping ember/firefly 55–105 (--warning family). */
    --ai-surface: oklch(0.980 0.008 210 / 0.86);
    --ai-tint: oklch(0.965 0.016 205);
    --ai-ember: oklch(0.720 0.170 55);
    --ai-firefly: oklch(0.860 0.160 100);
    --ai-star: oklch(0.950 0.020 237);
    --ai-glow:
      0 0 0 1px oklch(0.511 0.096 186.391 / 0.08),
      0 2px 8px -4px oklch(0.148 0.004 228.8 / 0.06),
      0 16px 40px -24px oklch(0.511 0.130 237.0 / 0.18),
      0 4px 16px -10px oklch(0.511 0.096 186.391 / 0.14);
    --ai-gradient:
      radial-gradient(115% 120% at 15% 0%, oklch(0.511 0.096 186.391 / 0.08) 0%, transparent 45%),
      radial-gradient(120% 125% at 100% 5%, oklch(0.511 0.130 237.0 / 0.08) 0%, transparent 50%),
      radial-gradient(90% 80% at 50% 100%, oklch(0.769 0.188 70.08 / 0.05) 0%, transparent 55%);
```

**(b) `.dark` block — insert after L164 (`--sidebar-ring:`), before the closing `}` (L165). Dark values:**

```css
    /* ── CAM-426 น้องกองไฟ AI Expression Layer (dark) — night-at-camp: brighter embers/fireflies over a dim sky ── */
    --ai-surface: oklch(0.230 0.014 222 / 0.84);
    --ai-tint: oklch(0.305 0.024 216);
    --ai-ember: oklch(0.780 0.180 58);
    --ai-firefly: oklch(0.900 0.170 105);
    --ai-star: oklch(0.970 0.030 237);
    --ai-glow:
      0 0 0 1px oklch(0.637 0.143 237.0 / 0.16),
      0 2px 8px -4px oklch(0 0 0 / 0.24),
      0 22px 56px -26px oklch(0.437 0.078 188.216 / 0.36),
      0 0 32px -16px oklch(0.637 0.143 237.0 / 0.20);
    --ai-gradient:
      radial-gradient(115% 120% at 15% 0%, oklch(0.437 0.078 188.216 / 0.18) 0%, transparent 45%),
      radial-gradient(120% 125% at 100% 5%, oklch(0.637 0.143 237.0 / 0.16) 0%, transparent 50%),
      radial-gradient(90% 80% at 50% 100%, oklch(0.879 0.169 91.605 / 0.10) 0%, transparent 55%);
```

**(c) `@theme inline` block — insert after L78 (`--color-sidebar-ring:`), before L79 (`--font-heading:`). Utilities:**

```css
    --color-ai-surface: var(--ai-surface);   /* → bg-ai-surface */
    --color-ai-tint: var(--ai-tint);         /* → bg-ai-tint / text-ai-tint */
    --color-ai-ember: var(--ai-ember);       /* → text-ai-ember (avatar flame); also read by the canvas */
    --color-ai-firefly: var(--ai-firefly);   /* → utility + canvas */
    --color-ai-star: var(--ai-star);         /* → utility + canvas */
    --shadow-ai-glow: var(--ai-glow);        /* → shadow-ai-glow (NOT shadow-xl; passes check:ds R2) */
```

**(d) ambient utilities + motion (append at END of file, after L178 — no reduced-motion block exists yet):**

```css
/* ── CAM-426 น้องกองไฟ AI Expression Layer — ambient utilities (assistant surface only) ── */
@layer components {
  /* Static campfire-night aurora backdrop (teal→sky + warm horizon). Decorative; place behind content. */
  .ai-aurora {
    background-image: var(--ai-gradient);
  }
}

/* Motion-safe only. Every loop is transform/opacity, dimmed, and no-ops under reduce-motion.
   These are the §2.1-sanctioned ambient loops (owner-approved under the CAM-426 delegation). */
@media (prefers-reduced-motion: no-preference) {
  /* Slow, ~18s aurora drift — barely perceptible; reinforces the "night breathing" feel. */
  .ai-aurora-drift {
    animation: ai-aurora-drift 18s ease-in-out infinite alternate;
    will-change: transform, opacity;
  }
  /* Gentle flame glow on the avatar chip — dim opacity/scale pulse, ~2.4s. */
  .ai-flame-glow {
    animation: ai-flame-glow 2400ms ease-in-out infinite;
    will-change: transform, opacity;
  }
  /* One-shot detail-card "campfire materialize" — owner-gated exception, ≤480ms (see §7 motion). */
  .ai-materialize {
    animation: ai-materialize 480ms cubic-bezier(0.23, 1, 0.32, 1) both;
    will-change: transform, opacity;
  }
}

@keyframes ai-aurora-drift {
  from { transform: translate3d(0, 0, 0) scale(1);        opacity: 0.85; }
  to   { transform: translate3d(1.2%, -1.2%, 0) scale(1.03); opacity: 1; }
}
@keyframes ai-flame-glow {
  0%, 100% { transform: scale(1);    opacity: 0.55; }
  50%      { transform: scale(1.06); opacity: 0.85; }
}
@keyframes ai-materialize {
  from { transform: scale(0.965); opacity: 0; }
  to   { transform: scale(1);     opacity: 1; }
}

/* Reduce-motion: no ambient motion at all (aurora/flame static, materialize collapses to a fade the app can skip). */
@media (prefers-reduced-motion: reduce) {
  .ai-aurora-drift,
  .ai-flame-glow,
  .ai-materialize { animation: none; }
}
```

**Guard confirmation:**
- `check:palette` — all literals live in `app/globals.css` (exempt); components reference only `bg-ai-surface` /
  `bg-ai-tint` / `text-ai-ember` / `shadow-ai-glow` / `ai-aurora` (no numbered palette, no hex). The canvas reads
  `--ai-ember/-firefly/-star` at runtime via `getComputedStyle` — no color literal in the `.tsx`. **PASS.**
- `check:ds` — glow = `shadow-ai-glow` (not `shadow-xl/xs/inner`, R2 clean); radius stays role-scale
  (`rounded-3xl` panel/card, `rounded-2xl` bubble/card-inner, `rounded-full` controls — never `rounded-sm/md/lg`,
  R1 clean); no `!h-*`, no `rounded-[Npx]`, no `text-[Npx]`; icons lucide-only (R-tabler clean). **PASS.**

---

## 2) DESIGN.md §2.1 sanctioned exception (exact prose to add)

Insert as a new subsection **§2.1** in `DESIGN.md`, immediately after §2's "Motion tokens" block (before §3 at L139):

```markdown
### §2.1 Sanctioned exception — น้องกองไฟ AI Expression Layer (CAM-426)

**Scope: the assistant surface ONLY** — `components/ai-chat/*` (`AiChatPanel`, `AiChatMessageList`,
`AiChatAvatar`, `AiAmbientCanvas`, `AiChatCampCard`, `AiChatDetailCard`). No standard page (Home / catalog /
dashboard / booking / auth) may use this exception; those keep stock tokens and standard 120–250ms motion.

Within that scope, and using ONLY the closed `--ai-*` token set (`--ai-surface`, `--ai-tint`, `--ai-glow`,
`--ai-gradient`, `--ai-ember`, `--ai-firefly`, `--ai-star` — derived in `app/globals.css` from `--primary` teal,
`--info` sky, and the `--warning` amber family for the warm camping accents), the assistant surface MAY:

1. render a **camping-night ambient backdrop** (`.ai-aurora`, `aria-hidden`, `pointer-events-none`, behind
   content) — a subtle teal→sky gradient with a faint warm campfire horizon;
2. render a **decorative particle canvas** (`AiAmbientCanvas`, `aria-hidden`, `pointer-events-none`) with four
   dimmed camping gimmicks — fireflies-follow-cursor, star sparkles, rising embers, and a small avatar flame —
   all perf-capped (particle cap + fps throttle + pause on hidden tab) and OFF under `prefers-reduced-motion`;
3. use a **glass surface** (`bg-ai-surface` + `backdrop-blur`) for the panel and the floating detail card, with a
   readable-content layer on top so text never sits directly on the animation;
4. apply the **`--ai-glow`** ambient glow (`shadow-ai-glow`) to the panel, the detail card, and the avatar;
5. tint the assistant bubble with **`bg-ai-tint`** (`text-foreground`, ≥ AA) and the avatar flame with `text-ai-ember`.

**Readability is the binding constraint:** the ambient must never reduce text legibility. Readable content sits on
`bg-ai-surface`/`bg-card` (opaque-enough) over the blurred backdrop; contrast stays WCAG 2.1 AA and is axe-verified.

**Still binding inside the exception:** role-radius (`rounded-3xl` panel/card, `rounded-2xl` bubble, `rounded-full`
control — never `rounded-sm/md/lg`), lucide-only icons, no emoji, all copy in `locales/` (TH+EN, Thai-copy rules),
all 8 states, WCAG 2.1 AA (contrast, visible focus ring `ring-ring`, tap ≥44px), `check:palette` + `check:ds` green.

**Motion within the exception:** message entrance + panel/detail open clamp to **≤250ms** transform/opacity
(standard). Three named loops/one-shots are permitted because they are transform/opacity only, dimmed, and no-op
under `prefers-reduced-motion`: `ai-aurora-drift` (~18s), `ai-flame-glow` (~2.4s), and the one-shot detail-card
`ai-materialize` (≤480ms). They were authored + justified in `CAM-426/design.md §7` and approved under the owner's
CAM-426 autonomy delegation; any NEW motion beyond these routes back to full human G2.

This exception is the record that legitimizes the camping assistant look. Anything beyond items 1–5, or any reuse of
`--ai-*` outside the assistant surface, routes back to full human G2.
```

---

## 3) Ambient effects spec — `AiAmbientCanvas` (the four gimmicks, dimmed + perf-capped)

A single decorative `<canvas>` component that renders the camping atmosphere. **Decorative only** — it carries no
information and is invisible to assistive tech.

**Placement + a11y:**
- `aria-hidden="true"`, `pointer-events-none`, `role="presentation"`. It never receives focus or a pointer event.
- Positioned `absolute inset-0` and stacked BEHIND the readable content (`-z-10`; readable content wrapper is
  `relative z-10`). In the panel it lives in the panel's non-text backdrop; in the detail card it lives on the dimmed
  overlay behind the card.
- It sits under `bg-ai-surface` + `backdrop-blur` wherever text is shown, so it is blurred and dimmed under any
  reading region. Full-strength particles are only visible in the margins/backdrop, never between text and its fill.

**The four effects (all dimmed — max render alpha noted):**

| # | gimmick | color token | behavior | max alpha |
|---|---|---|---|---|
| 1 | fireflies-follow-cursor | `--ai-firefly` | 8–14 soft dots drift; a subset eases toward the pointer with lag + jitter, pulsing slowly. On touch/no-pointer, they drift only (no follow). | 0.45 |
| 2 | star sparkles | `--ai-star` | 16–24 tiny points that twinkle (opacity in/out) at random phase; static positions. | 0.55 |
| 3 | rising embers | `--ai-ember` | 8–12 embers rise from the bottom, drift sideways, fade near the top, then respawn. | 0.40 |
| 4 | avatar flame | `--ai-ember` | NOT on the canvas — a lucide `Flame` (`fill-current text-ai-ember`) on the avatar chip with the `ai-flame-glow` dim pulse (CSS, §1d). | — |

**Perf caps (mandatory — this must never cost INP):**
- **Particle cap:** totals above are the desktop ceiling (≤ ~50 particles). On viewport `< md` OR
  `navigator.hardwareConcurrency <= 4`, halve every count.
- **fps throttle:** `requestAnimationFrame` loop gated to ~30fps via a delta accumulator; no per-frame allocation
  (pre-allocate the particle arrays once).
- **Pause on hidden tab:** listen to `visibilitychange`; when `document.hidden`, cancel the rAF loop; resume on show.
- **DPR cap:** render at `min(devicePixelRatio, 2)`; resize-observe the container, debounce.
- **Motion gate:** run the loop ONLY when `window.matchMedia('(prefers-reduced-motion: no-preference)').matches`.
  Under reduce-motion, render nothing (or one static, dim frame of stars) and do not start rAF. Re-check on the
  media-query `change` event so a mid-session preference flip is honored.
- **Token read:** read `--ai-ember/-firefly/-star` from `getComputedStyle(document.documentElement)` on mount and on
  theme change (observe the `.dark` class on `<html>` via a `MutationObserver`, or re-read on the app's theme toggle),
  so canvas colors track light/dark. No color literal in the component.

**Budget note (metric honesty):** the canvas is `dynamic(() => …, { ssr: false })` so it is not in the panel's
first-load critical path; its JS is a small client chunk. CWV impact is **not measured** yet — FE must confirm INP
is unaffected (the throttle + cap + hidden-pause are the guardrails) and note it at the gate.

---

## 4) Framed chat camp-card — `AiChatCampCard` (REAL fields only)

When น้องกองไฟ recommends a camp, the assistant bubble renders a compact **framed** camp card. "Framed" = the
camping glass treatment (a hairline `--ai-tint` border + `shadow-ai-glow`), but the CONTENT sits on solid `bg-card`
so it stays fully readable. Tapping the card opens the floating detail card (§5).

**Layout (mobile-first, `rounded-2xl` card inside the bubble):** hero image (16:9) · name + province row · a stat
row (rating · price · availability) · first tag chip · a `ดูรายละเอียด` affordance (the whole card is the tap target).

**REAL field mapping (every field exists — source noted):**

| element | field (source) | render rule |
|---|---|---|
| hero image | `images[0].url` (`campCardSelect.images`, first by `sortOrder`) | `ImageWithFallback` (fill, `sizes`, `aspect-video`, `rounded-2xl`); no src → its built-in fallback |
| name | `nameTh` (`campCardSelect.nameTh`) | `text-foreground font-medium`, 1 line + truncate; EN uses `nameEn` when locale=en, else `nameTh` |
| province | `location.province` (`campCardSelect.location.province`) | lucide `MapPin` + text; **nullable** → hide the row if null |
| rating | `avgRating` + `reviewCount` (`campCardSelect`) | lucide `Star fill-current` + `avgRating` (`tabular-nums`) + `{reviewCount} รีวิว`; **`avgRating` is null when `reviewCount = 0` → show `ยังไม่มีรีวิว`, never `0.0`** |
| price | `priceLow` + `priceCurrency` (schema `CampSite`; **not in `campCardSelect` today — see gap G4**) | `฿` + `Intl.NumberFormat('th-TH')` of `priceLow` + `/คืน` (`tabular-nums`); `isFree` → `ฟรี`; `priceLow` null → hide |
| availability | remaining capacity from the availability service (`app/api/campsites/[id]/availability`) | `เหลือ {N} ที่` (`tabular-nums`); **separate fetch, not on the card payload — see gap G3**; if not loaded, omit (never fabricate) |
| tag | `tags` CSV (schema `CampSite.tags`; **not in `campCardSelect` today — gap G4**) | first tag = `tags.split(',')[0].trim()`; render one `Badge rounded-xl`; empty → hide |

**Surface classes (token/utility only):**

| element | classes |
|---|---|
| card frame | `relative overflow-hidden rounded-2xl bg-card border border-ai-tint shadow-ai-glow p-0` |
| hero | `ImageWithFallback` wrapper `relative aspect-video w-full rounded-t-2xl` |
| body | `p-4 space-y-2` |
| name | `text-sm font-medium text-foreground line-clamp-1` |
| meta row | `flex items-center gap-3 text-xs text-muted-foreground tabular-nums` |
| tag | `Badge` `rounded-xl` (variant `secondary`) |
| tap target | whole card is a `button`/`role=button`, `aria-label` = name + `ดูรายละเอียด`; focus ring `ring-ring`; min height keeps ≥44px |

**Anti-slop:** the frame is a 1px tint border + soft glow — not a second nested card and not a loud gradient. One
image, one clear hierarchy (name → meta → tag). Readable: content on `bg-card`, not on the ambient.

---

## 5) Floating detail card — `AiChatDetailCard` (owner KEY delta)

**NOT a plain full-height edge drawer.** A **big consolidated camp-detail card that floats on an airy glass ambient
backdrop** — it gathers everything about the camp into one elevated card the camper reads without leaving the chat.

**Consolidated content (top → bottom, one scroll):**
1. **Hero** — `images[0..4].url` (a small carousel or a hero + thumb strip; reuse `ImageGallery`/`ImageWithFallback`).
2. **Title block** — `nameTh` (+ `nameEn` sub when locale=en) · `location.province` (`MapPin`).
3. **Key stats row** — rating (`avgRating`/`reviewCount` or `ยังไม่มีรีวิว`) · price (`priceLow`+`priceCurrency` / `ฟรี`)
   · availability (`เหลือ {N} ที่` from the availability service). Each an icon-chip + `tabular-nums`.
4. **Tags** — every tag from `tags` CSV as `Badge rounded-xl` (wrap).
5. **About** — `description` (schema `CampSite.description`, nullable → hide the section).
6. **Amenities** — `options MasterData[]` (`code`, `nameTh`/`nameEn`, `icon`); **not in `campCardSelect` — needs a
   detail-level include, see gap G5**. Render as an icon + label grid; unknown `icon` → a neutral lucide fallback.
7. **Available dates** — from the availability service (`app/api/campsites/[id]/availability`) / `DateRangePicker`
   read-only display of open dates; **derived, not a stored field — see gap G6**.
8. **Reviews** — `avgRating`/`reviewCount` summary + a few `Review` rows (schema `Review`; detail-level fetch).
9. **Book CTA** — one primary `Button size="lg"` `จองเลย` (the single primary action per DESIGN.md button grammar).

**Responsive behavior:**

| breakpoint | shape | classes (token/utility only) |
|---|---|---|
| mobile `< md` | **full sheet** rising from the bottom, near-full height, scroll inside | bottom-anchored, `w-full max-h-[92vh] rounded-t-3xl bg-ai-surface backdrop-blur-xl shadow-ai-glow overflow-y-auto` |
| desktop `≥ md` | **large floating card**, centered (slightly offset up), over a dimmed ambient backdrop | `max-w-3xl w-[calc(100%-4rem)] max-h-[85vh] rounded-3xl bg-ai-surface backdrop-blur-xl shadow-ai-glow overflow-hidden` (inner `overflow-y-auto`) |

**Overlay + backdrop (reuse the system, do not invent):**
- Built on `components/ui/dialog.tsx` (radix Dialog) → **free focus trap, `Esc`-to-close, scroll-lock, `aria-modal`**.
  One Dialog with responsive content classes covers both breakpoints (no second overlay primitive to manage).
- **Backdrop = the "airy glass ambient".** The Dialog overlay is a dimmed scrim `bg-foreground/40` (the approved
  adaptive over-content scrim idiom, DESIGN.md §2 color-rules — light/dark-safe, not a hardcoded color) PLUS the
  `.ai-aurora` layer and an `AiAmbientCanvas` instance on the scrim, so the floating card sits over a soft
  campfire-night backdrop. The scrim keeps the page behind readable-dim; the card's own `bg-ai-surface` keeps its
  content readable.
- Title has `DialogTitle` (visually the name; provides the accessible name); close = `h-11 w-11` icon-button top-right,
  lucide `X`, `aria-label` `ปิด`.

**Open / close motion:**
- **Default open/close = ≤250ms** transform/opacity: card `scale(0.98)→1` + fade; scrim fades. Standard gate, no exception.
- **Owner-gated "campfire materialize" (approved under CAM-426 delegation):** on desktop open, the card may run the
  one-shot **`ai-materialize` (≤480ms)** — `scale(0.965)→1` + fade + the `--ai-glow` settling in. OFF under
  `prefers-reduced-motion` (collapses to the ≤250ms fade). Named + justified here per §2.1. Recommend **enable on
  desktop, ≤250ms on mobile** (mobile sheets read better with a fast slide). Transform/opacity only.

**Anti-slop:** one dominant card, sections separated by spacing + hairline `border-border` (not nested cards, not
heavy shadows). The glass + glow is the only "effect"; content leads.

---

## 6) All 8 states + readability + a11y (whole surface)

The canonical 8 (DESIGN.md §274): **default · hover · focus · active · loading · error · empty · disabled.**

| state | what the user sees | mechanics |
|---|---|---|
| **default** | glass panel, campfire-night backdrop (dimmed), น้องกองไฟ avatar with a gentle flame, composer ready | `bg-ai-surface backdrop-blur-xl shadow-ai-glow` panel; `AiAmbientCanvas` in the backdrop |
| **hover** | send button, starter chips, and camp-card lift subtly; camp-card border warms slightly | `hover:` on the control only, ≤250ms opacity/transform |
| **focus** | **visible ring** on textarea, send, starter chips, camp-card, detail close/book | `ring-ring` / `outline-ring/50` — never removed |
| **active** | send / book press | `active:scale-95` (standard) |
| **loading** | น้องกองไฟ "thinking": a 3-dot pulse + streamed tokens appear live; camp-card image uses `ImageWithFallback`; detail sections that fetch show a `LoadingSpinner`/`Skeleton` matching their shape | module indicator (NOT a full skeleton — chat has no fixed layout to mirror, per `loading.md` canvas rule); `role="status" aria-live="polite"` + `น้องกองไฟกำลังคิด`; `aria-busy` on the list region while streaming |
| **error** | `ErrorBanner` at the top of the panel + `ลองอีกครั้ง` retry on the failed turn; a camp-card/detail that fails to load shows an inline `ErrorState` with retry (never a blank) | reuse `components/ui/error-banner.tsx` + `components/ErrorState.tsx`; retry ≥44px, focusable |
| **empty** | no messages yet → น้องกองไฟ avatar + welcome title + one-line hint + 3 starter-prompt chips | reuse `EmptyState` pattern; chips = `FilterChip`-style pills at `rounded-full`; copy in `locales/` |
| **disabled** | send greyed + unclickable while the composer is empty OR a turn is streaming; a stop button (`Square`) is offered during a stream | `disabled` state; `PermissionTooltip` optional to explain |

**Readability rules (owner hard requirement — restate for the gate):**
- Text never renders directly over the animated canvas. Every reading region has `bg-ai-surface`/`bg-card` +
  `backdrop-blur` between the text and the ambient.
- Bubbles are opaque (`bg-ai-tint` assistant, `bg-primary` user) — not translucent over the ambient.
- Ambient render alpha is capped (§3) and the canvas is dimmed under the surface. If atmosphere ever competes with
  legibility, dim the ambient further — legibility wins.
- Distinguish user vs assistant by **side + fill + avatar**, never hue alone (color-not-only).

**a11y (WCAG 2.1 AA):**
- Panel + detail card have an accessible name (`aria-label` / `DialogTitle` = the assistant name / camp name); message
  list `aria-live="polite"` so streamed text is announced without interrupting; the ambient canvas + decorative
  shapes are `aria-hidden`.
- Icon-only controls (send / stop / retry / close / book) carry an `aria-label` from `locales/`.
- Visible focus ring on every focusable control; logical tab order; no keyboard trap; detail card dismiss via `Esc`
  (from Dialog); focus returns to the opener on close.
- Tap target ≥44px (send/stop/close = `h-11 w-11`; book = `size="lg"` h-12).
- Contrast: `text-foreground` on `bg-ai-tint` / `bg-ai-surface` / `bg-card` — **AA by token parity; FE axe-verifies**
  (not tool-measured here).
- `prefers-reduced-motion`: ambient canvas renders nothing (or one static dim frame), aurora/flame static, detail
  open collapses to a ≤250ms fade.

---

## 7) Copy — keys for `locales/translations.json` (TH + EN, Thai-copy rules)

Frontend adds these under both the `th` and `en` trees (the file is `{ "en": {…}, "th": {…} }`) before build —
**no hardcoded strings.** Thai copy: no em-dash separator, no technical jargon, `tabular-nums` for numbers. The `…`
ellipsis glyph is allowed (it is not an em-dash separator).

| key | TH | EN |
|---|---|---|
| `aiChat.panel.label` | ผู้ช่วยน้องกองไฟ | Kongfai assistant |
| `aiChat.assistant.name` | น้องกองไฟ | Kongfai |
| `aiChat.assistant.tagline` | ผู้ช่วยหาที่พักแคมป์ของคุณ | Your camp finding buddy |
| `aiChat.empty.title` | เริ่มคุยกับน้องกองไฟได้เลย | Say hi to Kongfai |
| `aiChat.empty.hint` | ถามหาที่พักแคมป์ วันว่าง หรือกิจกรรมได้ทุกอย่าง | Ask about camps, open dates, or activities |
| `aiChat.empty.prompt1` | หาแคมป์ใกล้เชียงใหม่ | Camps near Chiang Mai |
| `aiChat.empty.prompt2` | ที่พักที่พาสัตว์เลี้ยงได้ | Pet friendly stays |
| `aiChat.empty.prompt3` | แคมป์ริมน้ำสุดสัปดาห์นี้ | Riverside camps this weekend |
| `aiChat.composer.placeholder` | พิมพ์ข้อความ | Type a message |
| `aiChat.send` | ส่งข้อความ | Send message |
| `aiChat.stop` | หยุดสร้างคำตอบ | Stop generating |
| `aiChat.thinking` | น้องกองไฟกำลังคิด | Kongfai is thinking |
| `aiChat.loading` | กำลังโหลด | Loading |
| `aiChat.error.stream` | ตอบกลับไม่สำเร็จ กรุณาลองใหม่ | Couldn't get a reply, please try again |
| `aiChat.error.retry` | ลองอีกครั้ง | Try again |
| `aiChat.card.perNight` | /คืน | /night |
| `aiChat.card.free` | ฟรี | Free |
| `aiChat.card.noReviews` | ยังไม่มีรีวิว | No reviews yet |
| `aiChat.card.reviews` | {count} รีวิว | {count} reviews |
| `aiChat.card.remaining` | เหลือ {count} ที่ | {count} spots left |
| `aiChat.card.viewDetail` | ดูรายละเอียด | View details |
| `aiChat.detail.about` | เกี่ยวกับที่นี่ | About |
| `aiChat.detail.amenities` | สิ่งอำนวยความสะดวก | Amenities |
| `aiChat.detail.availableDates` | วันที่ว่าง | Available dates |
| `aiChat.detail.reviews` | รีวิว | Reviews |
| `aiChat.detail.book` | จองเลย | Book now |
| `aiChat.detail.close` | ปิด | Close |

**Error pattern (per `form-patterns.md`):** stream/turn failure → `ErrorBanner` at the top of the panel (server-error
pattern) + inline retry on the failed turn. A card/detail load failure → inline `ErrorState` with retry (not a banner).

---

## 8) Real-data gaps (fields a mock might show that do NOT exist — do not design on fiction)

| id | field shown in the mock/prototype | status | what to do |
|---|---|---|---|
| **G1** | altitude / ความสูงเหนือระดับน้ำทะเล | **does NOT exist** in `prisma/schema.prisma` (`CampSite` has no altitude field) | do NOT show. Adding it = a new schema field → separate Architect ticket. |
| **G2** | distance from Bangkok / ระยะทางจากกรุงเทพฯ | **not stored.** `latitude`/`longitude` exist on `CampSite` but there is no distance field and no fixed origin | do NOT show as a stored fact. If ever wanted, compute at runtime from lat/lon + a chosen origin → separate ticket. |
| **G2b** | temperature / weather now | **does NOT exist** — no weather source in schema | do NOT show. Needs an external source → out of scope. |
| **G3** | "เหลือ {N} ที่" availability | field does NOT exist on the card payload; the **availability service exists** (`app/api/campsites/[id]/availability`) but is a **separate per-camp fetch** | fetch it separately for the card/detail; if not loaded, **omit** the availability chip — never fabricate a number. |
| **G4** | `priceLow`, `tags` on the framed chat card | **exist on `CampSite`** but are **NOT in `campCardSelect`** (dropped as over-fetch, see `lib/read-models/camp-card.ts`) | Architect adds a chat-card read-model (or extends the select) that includes `priceLow`, `priceCurrency`, `isFree`, `tags`, `id` for the detail link. Data exists; the SELECT must include it. |
| **G5** | amenities on the detail card | **exist** via `options MasterData[]` (`code`, `nameTh`/`nameEn`, `icon`) but **NOT in `campCardSelect`** | detail card uses a **detail-level fetch** that includes `options` (+ `description`, more `images`, `Review` rows). Data exists; needs the right include. |
| **G6** | "วันที่ว่าง" available-dates calendar | **derived, not a stored field** — computed from `Spot`/`BlockedDate`/`Booking` by the availability service | render from the availability service's open-date output; do not invent a stored "availableDates" field. |
| **G7** | `avgRating` when there are no reviews | `avgRating` is **null when `reviewCount = 0`** (schema comment, AGG-1) | show `ยังไม่มีรีวิว`; never render `0.0`. |
| **G8** | `location.province` | exists but is **nullable** (`Location.province String?`) | hide the province row when null; do not render "null"/blank. |

> Net: the framed card + detail card are buildable on REAL fields **once** the read-model for the chat card includes
> `priceLow/priceCurrency/isFree/tags/id` (G4) and the detail fetch includes `options/description/reviews/more images`
> (G5). Availability (G3/G6) is a separate service call. G1/G2/G2b are genuinely absent — cut them from the design.

---

## 9) Component / file map (what Frontend builds)

| file | new? | responsibility |
|---|---|---|
| `components/ai-chat/AiChatPanel.tsx` | new | glass panel shell (`bg-ai-surface backdrop-blur-xl shadow-ai-glow rounded-3xl`), header (avatar+name+tagline), message list, composer; hosts the backdrop `AiAmbientCanvas` + `.ai-aurora`. Mobile = bottom sheet (`rounded-t-3xl`), `≥md` = docked card (`max-w-md`). |
| `components/ai-chat/AiAmbientCanvas.tsx` | new | the decorative canvas (§3): fireflies/stars/embers, capped/throttled/hidden-paused, motion-gated, token-read; `aria-hidden pointer-events-none`; `dynamic ssr:false`. |
| `components/ai-chat/AiChatAvatar.tsx` | new | น้องกองไฟ chip `bg-primary/10 rounded-full h-11 w-11` + lucide `Flame` `fill-current text-ai-ember` with `ai-flame-glow`; optional `shadow-ai-glow`. |
| `components/ai-chat/AiChatMessageList.tsx` | new | bubbles (user `bg-primary text-primary-foreground rounded-2xl`, assistant `bg-ai-tint text-foreground rounded-2xl`); `aria-live="polite"` + `aria-busy`; thinking indicator; `ErrorBanner`+retry; `EmptyState`+3 chips; renders `AiChatCampCard` for camp results. |
| `components/ai-chat/AiChatCampCard.tsx` | new | framed camp card (§4), REAL fields, opens `AiChatDetailCard`. |
| `components/ai-chat/AiChatDetailCard.tsx` | new | floating consolidated detail card (§5) on `components/ui/dialog.tsx`, responsive, REAL fields, book CTA, ambient backdrop. |
| `app/globals.css` | edit | blocks (a)+(b)+(c)+(d) from §1. |
| `DESIGN.md` | edit | §2.1 exception prose from §2. |
| `locales/translations.json` | edit | `aiChat.*` keys from §7 (TH+EN). |

**Icon note (repo rule overrides the generic default):** this repo's `check:ds` R1 bans `@tabler/icons-react` and
the owner delta requires **lucide-only**. Use lucide: `Flame`, `Sparkles`, `Send`, `Square`, `RotateCw`, `Star`,
`MapPin`, `Users`, `X` (+ `Tent`/`TreePine` if a camping accent is wanted). No emoji.

---

## 10) Frontend build checklist (S2 — self-approved G2 under CAM-426 autonomy)

1. **`app/globals.css`** — add blocks (a) `:root` after L123, (b) `.dark` after L164, (c) `@theme inline` after L78,
   (d) ambient utilities + reduced-motion at EOF. Re-anchor if the branch's globals.css differs (blocks are additive).
2. **`DESIGN.md`** — add the §2.1 exception prose (after §2 Motion tokens, before §3).
3. **`locales/translations.json`** — add the `aiChat.*` keys (TH+EN) from §7 to both trees.
4. **`AiChatPanel.tsx`** — §9 shell + backdrop; mobile-first; lucide-only, no emoji.
5. **`AiAmbientCanvas.tsx`** — §3 with ALL perf caps (particle cap + 30fps throttle + hidden-pause + DPR≤2 +
   motion-gate + token read); `dynamic ssr:false`.
6. **`AiChatAvatar.tsx`** — flame chip + `ai-flame-glow`.
7. **`AiChatMessageList.tsx`** — bubbles + `aria-live`/`aria-busy` + thinking + `ErrorBanner`/retry + `EmptyState`/chips.
8. **`AiChatCampCard.tsx`** — §4 REAL fields; wait on the chat-card read-model (gap G4) — coordinate with Architect.
9. **`AiChatDetailCard.tsx`** — §5 Dialog-based floating card + detail fetch (gap G5) + availability (gap G3/G6).
10. **Self-verify:** `npm run check:palette` (green) · `npm run check:ds` (green) · `npm run lint` · `npm run typecheck`
    · axe on panel + detail (contrast, focus, labels, no keyboard trap) · screenshot panel + detail in **light AND
    dark** on `/preview` and compare to §4/§5/§6 · confirm the ambient does not hurt INP (throttle/cap in place).

---

## 11) Motion honesty + gate posture

- **Standard motion (no exception):** message entrance + panel/detail open/close ≤250ms, transform/opacity,
  easing `cubic-bezier(0.23,1,0.32,1)`, `active:scale-95` on press.
- **Named ambient loops/one-shot (owner-gated, approved under the CAM-426 autonomy delegation, §2.1):**
  `ai-aurora-drift` (~18s), `ai-flame-glow` (~2.4s), and the one-shot `ai-materialize` (≤480ms desktop open). All are
  transform/opacity only, dimmed, and no-op under `prefers-reduced-motion`. Recommend shipping all three (they carry
  the camping feel at low cost); the reduced-motion path is fully static.
- **Gate posture:** this story introduces new tokens + a new flow + new motion → it is NOT the pre-authorized
  standard class. It is **self-approved at G2 under the owner's explicit CAM-426 autonomy delegation**; the design
  gate still runs at merge (anti-slop + a11y + token-sync + screenshot-vs-brief), and any NEW motion or `--ai-*` reuse
  outside the assistant surface routes back to full human G2.

---

## Open questions

None blocking. Two notes carried to Frontend/Architect (defaults chosen, buildable as-is):
- **Chat-card read-model (gap G4) + detail fetch (gap G5)** are an Architect dependency — the visual design is final;
  the SELECT/include must ship for the real fields to appear. Default until then: render only the fields the current
  `campCardSelect` exposes (`nameTh`, `location.province`, `avgRating`/`reviewCount`, `images[0]`) and hide price/tags.
- **Materialize (`ai-materialize`)**: recommended ON for desktop detail-open; if the owner later wants it off, delete
  the class usage — the ≤250ms default remains.

## Changelog
- **v2 (2026-07-19)** — REWRITE for the camping direction (น้องกองไฟ). Supersedes v1's generic aurora brief.
  Finalized 7 `--ai-*` tokens (teal+sky+warm ember/firefly/star) with exact light+dark OKLCH + `@theme inline`;
  re-anchored globals.css insert points to this branch's 177-line file (added the missing reduced-motion block);
  rewrote §2.1 for the camping scope; added the ambient-canvas spec (4 dimmed gimmicks + perf caps + motion gate);
  added the framed chat card + the floating detail card (owner KEY delta) on REAL fields; added the real_data_gaps
  table (G1–G8); readability-first rules + 8 states + AA a11y; FE build checklist mapping each change to a file.
- v1 (2026-07-19) — generic `--ai-*` aurora proposal (superseded).
