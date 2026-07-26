---
name: CampVibe Design Language
version: 2.0
lastReviewed: 2026-06-22
sourcesOfTruth:
  - app/globals.css        # token values (OKLCH, light + .dark) — authoritative
  - components/ui/*         # the only component vocabulary
  - app/preview             # living reference (kitchen-sink)
enforcement: npm run check:palette   # CI guard, exits 1 on hardcoded palette
precedence: token > scale utility > inline value (inline = rejected)
audience: AI agents (primary) + humans
---

# DESIGN.md — CampVibe Design Language (v2, AI-First)

## Overview

This file is the **single source of truth** for all design. **Every agent reads it before doing any UI work** (humans read it too). It has the authority to **block a PR** for UI work via the Design Gate (§6).

Change a token in one place only: `app/globals.css` + this file. Public-facing work (metadata / JSON-LD / CWV) → `.claude/rules/seo.md`. Field validation + PDPA → `.claude/rules/ux.md` (not duplicated here).

This doc keeps its §-numbered structure: §0 how to use → §1 brand → §2 tokens → §3 components → §4 copy → §5 anti-slop → §6 gate → §7 icons → §8 living reference.

## Quick Reference

The fast path for any UI work (full rules below):

1. **Read this file first** (§0) — it is a contract; output must be deterministic session-to-session.
2. **Precedence:** semantic token (`bg-card`, `text-muted-foreground`) → scale utility (`rounded-3xl`, `h-11`, `gap-6`) → **never an inline value** (`bg-[#…]`, `h-[52px]`). Value not in the token layer? **Stop — propose a token, don't invent one.**
3. **Pick the primitive** from `components/ui/*` only (§3 decision matrix); icons **lucide-react only** (§7).
4. **Cover all 8 states** (default/hover/focus/active/loading/error/empty/disabled) + the form/error pattern.
5. **Pass the gate before merge** (§6): `npm run check:palette` green · WCAG 2.1 AA (contrast 4.5:1 / 3:1, focus, tap ≥44px, axe) · i18n TH/EN no em-dash/jargon · motion transform/opacity 120–250ms · anti-slop (§5).

## §0 How to use this doc (for AI agents + humans)

1. **Read this file before starting any UI work, every session** — it is a contract, not a suggestion. Every design decision comes from here → the output of session 10 must match the output of session 1.
2. **Precedence:** use a **semantic token** (e.g. `bg-card`, `text-muted-foreground`) → if none exists, use a **scale utility** (`rounded-3xl`, `h-11`, `gap-6`) → **never use an inline value** (`bg-[#..]`, `h-[52px]`, a free-floating hex/px).
3. **Closed token layer:** if the value you need is **not in the token/scale**, **stop — do not invent a value.** Propose adding a token in `app/globals.css` (Designer + Architect approve) and then use it.
4. **Enforcement:** `npm run check:palette` (CI, exit 1) catches hardcoded palette across the repo (except `app/globals.css`, `app/status/**`) — a PR cannot pass with a violation.
5. **Every rule in this file is a fixed number + a reference to a real token/primitive** — if you hit a case this file does not answer, ask a human, do not guess.

## §1 Brand spec & POV — CampVibe

**Identity:** teal/mist + clean white in an **Airbnb-light** key — content leads, chrome is light, hierarchy is clear through **spacing + typography**, not heavy lines/shadows.

**The one strong opinion we commit to:** **teal calm-confidence** — teal as the primary, composed and trustworthy (not neon/loud); whitespace is a feature; calm = the credibility of a camp-booking platform. Every screen must "feel like CampVibe", not a generic template.

**Design parameters (the brand's mode dials — use to weight the work):**

| param | CampVibe value |
|---|---|
| mode | **brand-forward** on public/marketing pages · **product-utility** on dashboard/operator (lighter chrome, higher density) |
| density | comfortable (public) · compact (dashboard table) |
| design-variance | low–medium — consistency > flashiness; difference comes from real content/photos, not decoration |
| motion-intensity | restrained (§2 motion) |
| type-direction | Outfit display (has personality) + Inter/Sarabun body (legible, neutral) |

**Voice/personality:** outdoor-warm, trustworthy, friendly but not cutesy · speak to the user like a friend who really knows camping.

## §2 Tokens — machine-readable (real values from `app/globals.css`, OKLCH light/.dark)

### Color (semantic — tokens only, with per-row usage)

| token (Tailwind class) | light | dark | ✅ use for | ❌ do not use for |
|---|---|---|---|---|
| `primary` / `primary-foreground` | `0.511 0.096 186.391` / `0.984 0.014 180.72` | `0.520 0.078 188.216` / `0.984 0.014 180.72` | **fills, borders, rings, icons** — primary buttons, actions, selected state | wide backgrounds, and **any text** (use `primary-ink`; as text on dark `--card` it measures 3.28:1 vs the 4.5:1 floor) |
| `primary-ink` (`text-primary-ink`) | `0.511 0.096 186.391` (= light `primary`) | `0.760 0.120 184` | **primary teal on WORDS** — links, prices, active menu label, avatar initials, today's date, `link` button/badge variant | fills, borders and rings (use `primary`); never with an opacity modifier (`/80` drops it to 3.70:1 in light) |
| `secondary` / `secondary-foreground` | `0.967 0.001 286.375` / `0.21 0.006 285.885` | `0.274 0.006 286.033` / `0.985 0 0` | secondary buttons, soft secondary surfaces | the primary action |
| `accent` | = primary | = primary | hover/active accent, focus tint | (single tone with primary) |
| `muted` / `muted-foreground` | `0.963 0.002 197.1` / `0.56 0.021 213.5` | `0.275 0.011 216.9` / `0.723 0.014 214.4` | secondary surfaces, secondary text, placeholder, skeleton | primary text (insufficient contrast) |
| `destructive` | `0.577 0.245 27.325` | `0.704 0.191 22.216` | error, delete, cancel (pair with `text-primary-foreground`/white on fill) | success/info |
| `success` / `success-foreground` | `0.530 0.148 144.184` / `0.984 0.014 158.52` | `0.645 0.168 150.323` / `0.148 0.004 228.8` | confirmed, accepted, paid | error/warning |
| `warning` / `warning-foreground` | `0.769 0.188 70.08` / `0.148 0.004 228.8` | `0.879 0.169 91.605` / `0.148 0.004 228.8` | pending/awaiting states, caution signals | error (use destructive) |
| `info` / `info-foreground` | `0.511 0.130 237.0` / `0.984 0.014 180.72` | `0.637 0.143 237.0` / `0.148 0.004 228.8` | completed/informational states, neutral signals | primary actions (use primary) |
| `background` / `foreground` | `1 0 0` / `0.148 0.004 228.8` | `0.148 0.004 228.8` / `0.987 0.002 197.1` | page surface / primary text | — |
| `card` / `card-foreground` | `1 0 0` / `0.148…` | `0.218 0.008 223.9` / `0.987…` | card/surface raised surface | full-page background (use background) |
| `popover` / `popover-foreground` | = card | = card | dropdown/select/popover/tooltip panel | — |
| `border` / `input` | `0.925 0.005 214.3` | `1 0 0 / 10%` , `/15%` | borders, input borders | emphasis (use ring/primary) |
| `ring` | `0.723 0.014 214.4` | `0.56 0.021 213.5` | focus ring (`outline-ring/50` is global) | — |

**Color rules:**

- ❌ **No pure `#000`/`#fff`** — use `foreground`/`background` (foreground = `oklch(0.148…)` navy, not solid black) · `text-white` is allowed **only over images / primary-fill surfaces** (overlay scrim, primary button).
- **Teal fills vs teal words are two different tokens** (CAM-546). Ask "is this thing made of letters?" — if yes use **`text-primary-ink`**; if it is a fill, border, ring or icon use `primary`. One token cannot do both: text on the dark `--card` needs `L ≥ 0.596` while a near-white label *on* the fill needs `L ≤ 0.548`. Never put an opacity modifier on `text-primary-ink` — `/80` measures 3.70:1 in light, under the floor.
- Every neutral is **already tinted toward the teal hue** (hue ~197–228) — do not drop in a flat gray (zinc/slate/neutral numbered).
- Dark mode flips automatically via `.dark` — **do not hand-write `dark:` color overrides.**
- The `--color-primary:#0d9488` card value in `@theme` (top of globals.css) is a stale hex → the `:root` OKLCH is authoritative (cleanup is in the backlog).
- `bg-foreground/50` or `bg-foreground/60` **over an image** (avatar hover scrim, gallery caption chip with `backdrop-blur`) is an **approved intentional use** at opacity — it is the correct light/dark-adaptive overlay idiom; not a CTA button, not a DS violation. Do not replace with a hardcoded color.

### Typography (bilingual)

| language | display/heading | body/UI |
|---|---|---|
| Latin/EN | **Outfit** (`--font-display`) | **Inter** (`--font-sans`) |
| Thai | **Sarabun** semibold | **Sarabun** (Google Fonts, subset thai+latin) |

- Font stack splits by language (Thai font var / `:lang(th)`) — Outfit/Inter have no Thai glyphs, do not fall back to the system font.
- `font-variant-numeric: tabular-nums` (`tabular-nums`) is always required for **prices / dates / statistic numbers**.
- Body line-height ~**1.5** (Thai ~**1.6**) · paragraph measure **65–75ch** · clear heading/body/label/caption hierarchy.
- *(Note: Sarabun is not yet wired — see backlog §8 item 9; currently Thai falls back to the system font.)*

### Spacing & density

| context | value |
|---|---|
| card padding | `p-4 md:p-6` |
| modal content | `p-6 md:p-8` |
| form max-width | `max-w-xl` (reading) / `max-w-2xl` (wide form) |
| gutter | `gap-4` (mobile) / `gap-6` (desktop) |
| section spacing | `space-y-6`/`space-y-8` |

### Radius (soft-rounded — one token per role, stop mixing values)

| role | radius | px (base 10px) |
|---|---|---|
| button · input · select-trigger · chip/pill · icon-button · calendar day | `rounded-full` / token `--radius-full` | — |
| card · modal/dialog · sheet | `rounded-3xl` | 22px |
| popover · select/dropdown/command content | `rounded-2xl` | 18px |
| inner element · badge · small inset | `rounded-xl` | 14px |

### Size — height scale

| size | height | use for |
|---|---|---|
| sm | `h-9` | dense control (toolbar, inline) |
| **md** (default) | `h-11` | form control, select, general button |
| lg | `h-12` | **primary CTA**, input in modal/search |
| icon-button | `h-11 w-11` | icon-only button (tap ≥44px) |

### Shadow tiers (use only when needed — prefer border + spacing first)

`shadow-sm` card · `shadow-md` raised/hover · `shadow-lg` dropdown/popover · `shadow-2xl` modal · ❌ no other tier.

### Motion tokens

- Duration **120–250ms** · easing **`cubic-bezier(0.23,1,0.32,1)`** (responsive) — `tw-animate-css` utilities.
- Animate **only `transform` + `opacity`** · ❌ `transition: all` · ❌ animating width/height/margin/top/left.
- ❌ `ease-in` for entrance · button press `active:scale-95`.
- ❌ motion on frequent actions (filter/search/keyboard) · ✅ respect `prefers-reduced-motion`.

### §2.1 Sanctioned exception — น้องกองไฟ AI Expression Layer (CAM-426)

**Scope: the assistant surface ONLY** — `components/ai-chat/*` (`AiChatPanel`, `AiChatMessageList`,
`AiChatAvatar`, `AiAmbientCanvas`, `AiChatCampCard`, `AiChatDetailCard`). No standard page (Home / catalog /
dashboard / booking / auth) may use this exception; those keep stock tokens and standard 120–250ms motion.

Within that scope, and using ONLY the closed `--ai-*` token set (`--ai-surface`, `--ai-tint`, `--ai-glow`,
`--ai-gradient`, `--ai-ember`, `--ai-firefly`, `--ai-star`, `--ai-flame-aura`, `--ai-price` — derived in
`app/globals.css` from `--primary` teal, `--info` sky, and the `--warning` amber family for the warm camping
accents), the assistant surface MAY:

1. render a **camping-night ambient backdrop** (`.ai-aurora`, `aria-hidden`, `pointer-events-none`, behind
   content) — a subtle teal→sky gradient with a faint warm campfire horizon;
2. render a **decorative particle canvas** (`AiAmbientCanvas`, `aria-hidden`, `pointer-events-none`) with four
   dimmed camping gimmicks — fireflies-follow-cursor, star sparkles, rising embers, and a small avatar flame —
   all perf-capped (particle cap + fps throttle + pause on hidden tab) and OFF under `prefers-reduced-motion`;
3. use a **glass surface** (`bg-ai-surface` + `backdrop-blur`) for the panel and the floating detail card, with a
   readable-content layer on top so text never sits directly on the animation;
4. apply the **`--ai-glow`** ambient glow (`shadow-ai-glow`) to the panel, the detail card, and the avatar;
5. tint the assistant bubble with **`bg-ai-tint`** (`text-foreground`, ≥ AA) and the avatar flame with `text-ai-ember`;
6. render a **VISIBLE fire-toned aura halo** (**`shadow-ai-flame-aura`**, built from `--ai-ember`/`--ai-firefly` —
   distinctly stronger than the depth-only `--ai-glow`) behind the avatar mark and the launcher FAB, paired with the
   **`ai-flame-flicker`** loop (CAM-432, owner staging feedback + reference image);
7. use **`text-ai-price`** for the card price hero (brand-accent teal, ≥ AA both themes — dark is brightened off
   `--primary` so price text stays readable on the dark `--card` without touching `--primary` itself; CAM-444).

**Readability is the binding constraint:** the ambient must never reduce text legibility. Readable content sits on
`bg-ai-surface`/`bg-card` (opaque-enough) over the blurred backdrop; contrast stays WCAG 2.1 AA and is axe-verified.

**Still binding inside the exception:** role-radius (`rounded-3xl` panel/card, `rounded-2xl` bubble, `rounded-full`
control — never `rounded-sm/md/lg`), lucide-only icons, no emoji, all copy in `locales/` (TH+EN, Thai-copy rules),
all 8 states, WCAG 2.1 AA (contrast, visible focus ring `ring-ring`, tap ≥44px), `check:palette` + `check:ds` green.

**Motion within the exception:** message entrance + panel/detail open clamp to **≤250ms** transform/opacity
(standard). Four named loops/one-shots are permitted because they are transform/opacity only, dimmed, and no-op
under `prefers-reduced-motion`: `ai-aurora-drift` (~18s), `ai-flame-glow` (~2.4s), `ai-flame-flicker` (~2.6s — the
avatar/launcher fire-aura's วูบวาบ flicker; owner-requested, assistant น้องกองไฟ mark only; CAM-432), and the
one-shot detail-card `ai-materialize` (≤480ms). The first three were authored + justified in `CAM-426/design.md §7`
and approved under the owner's CAM-426 autonomy delegation; `ai-flame-flicker` was added under CAM-432 (owner
staging feedback + reference image). Any NEW motion beyond these four routes back to full human G2.

**Named exception — width animation (CAM-453):** the AI-chat detail split-rail (desktop `lg:` push-aside) MAY animate
`width` instead of transform/opacity — the only layout axis that pushes the chat aside without leaving a blank gap
on a fixed-width flex-row sibling — bounded ≤250ms and `motion-reduce`-guarded, same as every other motion in this
exception.

This exception is the record that legitimizes the camping assistant look. Anything beyond items 1–5, or any reuse of
`--ai-*` outside the assistant surface, routes back to full human G2.

## §3 Component contracts + decision matrix (which primitive for which job)

**Vocabulary = `components/ui/*` only** (28 components: button, input, input-field, input-group, label, textarea, checkbox, select, dropdown-menu, popover, command, dialog, alert-dialog, sheet, calendar, date-range-picker, tooltip, tabs, scroll-area, card, badge, skeleton, loading-spinner, loading-skeleton, error-banner, permission-tooltip, truncated-label, sonner). Do not invent components outside the system.

### Choosing a "picker / menu" — one grammar per role (resolves the Profile-vs-Filter case the owner flagged)

| job | use | spec | ❌ do not use |
|---|---|---|---|
| pick **one value** from a short list (form) | `Select` | trigger `rounded-full h-11` · content `rounded-2xl` · item `rounded-xl py-2.5` | DropdownMenu, custom button |
| **long / searchable** list (province/place) | `Popover` + `Command` | content `rounded-2xl` · item `rounded-xl` | a long `Select` |
| **command/account menu** (go to an action, not pick a value), e.g. Profile menu | `DropdownMenu` | content `rounded-2xl` · item `rounded-xl` (normal weight) — **same grammar as Select** | ❌ panel rounded-xl + bold item rounded-lg (the old style that made it look inconsistent) |
| **multi-select / toggle filter** (FilterModal, SearchModal) | the **FilterChip** primitive (`components/ui/filter-chip.tsx`) | pill `rounded-full border h-11 min-w-[44px] px-5`, icon `size-4`; **selected = `bg-primary text-primary-foreground border-primary`**; image-card variant `rounded-2xl` for categories with a photo — **one style, one file** | Select, raw `<span>`, a hand-rolled `<button>` pill (blocked by `check:ds` R9) |
| boolean | `Checkbox` / Switch | — | — |
| confirm/delete (destructive) | `AlertDialog` | — | `window.confirm` |
| transient feedback | `toast` (sonner) | — | a persistent inline alert |

> **Answer to the owner's case:** Profile dropdown = `DropdownMenu` (command menu), Filter selection = `FilterChip` (multi-select) — **different roles, so they can be different components** but **must share grammar**: radius/size/spacing from the one §2 set → they "look like one family" even though they do different jobs.

### Chip family — who is a chip, and what "selected" looks like (CAM-532)

**Selected = `bg-primary text-primary-foreground border-primary`.** This settles a contradiction that
lived in this file: §3/§3.1 used to say `bg-foreground text-background` while the primitive shipped
`bg-primary`. The primitive is right, on four counts: §2's token table already assigns `primary` the
"selected" role · `check:ds` R5a flags `bg-foreground`/`text-background` in a consumer as a CTA-color
override · the primitive plus all three of its consumers already ship `bg-primary` · teal-on-white is
the §1 POV. Measured contrast of the label on the selected fill: **5.17:1 light / 7.23:1 dark**
(both ≥ AA 4.5:1). Hover = `hover:bg-primary/85` selected, `hover:border-foreground` unselected.

**Only `components/ui/filter-chip.tsx` styles a chip.** A consumer passes
`variant`/`selected`/`onToggle`/`label`/`icon` and adds **no chip className** — height, radius, icon
size, tap target, focus ring, `active:scale-95` and all 8 states come from the primitive. A
hand-rolled `<button>` pill is a **Critical** gate violation and is caught by `check:ds` R9.

**Not chips (do not "convert" them):**

| surface | what it really is | why it stays |
|---|---|---|
| `ActiveFilters` | dismiss **token** — reports a filter already on, removes it on tap | not selectable (no unselected state to render) → `Badge` `rounded-xl`, per the "status label" row |
| `CategoryBar` | underline **nav tab** (`aria-current`, `border-b-2`, no box) | switches page context rather than composing a multi-select → tab grammar, not chip grammar |

### Overlay grammar

| use | when |
|---|---|
| `Dialog` | focused-task modal, centered, `rounded-3xl`, close `h-11 w-11` top-right |
| `Sheet` | side/bottom drawer — long/contextual content |
| `AlertDialog` | confirm/destructive only |
| `Popover` | small anchored panel (date, picker) `rounded-2xl` |
| `Tooltip` | short hint text only (no action) |

### Button grammar

- variant: `default` (primary teal) · `secondary` · `outline` · `ghost` · `destructive` · `link`
- size: `sm h-9` · `md h-11` · `lg h-12` — **every variant `rounded-full`**
- **1 primary action per view** (do not repeat the primary CTA intent) · ❌ **do not override height inline** (`!h-12`) — use the size prop
- icon-button = `h-11 w-11` + `aria-label`

### Other components (full coverage — use this for this job)

| job | use | note |
|---|---|---|
| switch sections within one page | `Tabs` | not cross-page navigation (use a link) · active segment uses the accent tone, not a heavy line |
| pick a date / date range | `Calendar` (single) / `DateRangePicker` (range) in a `Popover` | trigger `rounded-full h-11` · day-cell selection states → the table below |
| status label (not clickable) | `Badge` `rounded-xl` | status (confirmed/paid) uses `Badge` + token success/destructive/muted — **not a raw `<span>`** · a clickable filter → FilterChip (§ table) |
| truncated text + tooltip | `TruncatedLabel` | — |
| **icon-chip background** (stat cards, active nav, dashboard) | `<div>` / `<span>` wrapping an icon | `bg-(primary\|success\|warning\|info\|destructive)/10` — 10% opacity tint fill; pair with the matching `text-(color)` or `text-(color)-foreground` icon · ❌ do **not** apply this pattern to a `<Button>` or `<Badge>` className (use variant instead) |
| **ghost-primary link-action** (utility/dashboard surfaces) | `<Button variant="ghost">` | add `className="text-primary hover:bg-primary/5"` — low-chrome "view / go" action on product-utility pages (dashboard, bookings list) · ❌ do **not** use as a primary CTA or on marketing/brand pages (use `default` or `link` variant) |

### Calendar day selection states (CAM-533 — one shape language, single/range alike)

`Calendar` mounts for BOTH `mode="single"` (booking check-in/out) and `mode="range"` (dashboard). One shape system covers both, so a day never changes vocabulary between surfaces.

**Ownership rule:** the day **button** (`CalendarDayButton`) is the ONLY layer that declares radius or fill. The DayPicker `classNames` cell layer declares layout only. Two layers declaring the same shape is what produced the circle/square/half-circle mix the owner reported.

| state | shape | fill | token |
|---|---|---|---|
| default | full round | none | `--radius-full` (via `--cell-radius`) |
| hover | full round (unchanged) | `bg-muted` (ghost button) | `--muted` |
| focus | full round (unchanged) | none — visible `ring-[3px]` outside | `--ring` |
| active | full round (unchanged) | press scale from the Button base | — |
| disabled | full round (unchanged) | none, `text-muted-foreground opacity-50`, no pointer | `--muted-foreground` |
| single selected | full round | solid `bg-primary` + `text-primary-foreground` | `--primary` |
| range start | outer (left) round, inner edge flat | solid `bg-primary` + `text-primary-foreground` | `--primary` |
| range middle | flat both edges (connects the band) | `bg-muted` + `text-foreground` | `--muted` |
| range end | outer (right) round, inner edge flat | solid `bg-primary` + `text-primary-foreground` | `--primary` |
| range of one day (start = end) | full round | solid `bg-primary` | `--primary` |
| today (not selected) | full round + 1px ring on the day control | none | `--muted-foreground` (4.61:1 light / 8.07:1 dark, ≥3:1 non-text) |
| today (selected) | takes the selection shape above; the today ring retires | per selection state | — |
| outside month | full round (unchanged) | none, `text-muted-foreground` | `--muted-foreground` |

- ❌ Never give `today` its own square/`rounded-none` treatment; a square day is a shape-language break, not an emphasis.
- ❌ Never mark today with `--primary` — measured 2.62:1 on `--background` in dark, below the 3:1 non-text floor.
- Today uses `border`, focus uses `ring` — different CSS properties on purpose, so a focused today cell keeps a visible focus ring.
- The row-end edges of a range that wraps a week stay flat, which reads as "continues on the next row".

### Composition (existing primitives and wrappers — reuse, do not rebuild)

Before building anything new, check this list and the Component Index (§3.1 below). Re-implementing an existing primitive is the #1 source of UI drift (CAM-220/CAM-221).

| primitive | file | use when |
|---|---|---|
| `ModalHeader` / `ModalContent` | `components/ui/modal-shell.tsx` | every modal's header band + shell (centered title, divider, 44px close, `rounded-3xl`) — the **canonical modal shell**; do not hand-roll a modal header |
| `EmptyState` | `components/EmptyState.tsx` | empty result / no-data state with an illustration |
| `ErrorState` | `components/ErrorState.tsx` | error / not-found / forbidden — full-page or inline |
| `ConfirmDialog` | `components/ui/confirm-dialog.tsx` | canonical destructive-confirm wrapper over `AlertDialog`; **use when: destructive/confirm dialog** (delete, cancel, remove member) — do not hand-roll a confirm dialog |
| `InputField` | `components/ui/input-field.tsx` | input + label + inline error in one unit |
| `InputGroup` | `components/ui/input-group.tsx` | grouped inputs (e.g. date pair) |
| `DateRangePicker` | `components/ui/date-range-picker.tsx` | pick a date range (wraps Calendar + Popover) |
| `ErrorBanner` | `components/ui/error-banner.tsx` | server / form-submit error shown at the top of a form |
| `LoadingSpinner` | `components/ui/loading-spinner.tsx` | inline / button loading indicator |
| `Skeleton` | `components/ui/skeleton.tsx` | single-element loading placeholder |
| `LoadingSkeleton` | `components/ui/loading-skeleton.tsx` | composite page/card skeleton (use for route-level loading) |
| `PermissionTooltip` | `components/ui/permission-tooltip.tsx` | wrap a disabled control to explain why it is disabled |
| `TruncatedLabel` | `components/ui/truncated-label.tsx` | text that may overflow — shows a tooltip with full text |
| `FilterChip` | `components/ui/filter-chip.tsx` | multi-select / toggle filter pill |
| `ImageWithFallback` | `components/ui/image-with-fallback.tsx` | `next/image` with a graceful fallback — the missing/failed photo placeholder (see "Empty image slot" below) |

### Dropdown / select grammar (canonical — resolves the "which dropdown is correct" question)

`Select` and `DropdownMenu` are **different primitives for different jobs** and must NOT be mixed:

| primitive | job | example in the codebase |
|---|---|---|
| `Select` | Pick one value from a list (form control) — shows a persistent selected-check mark | `SortDropdown` — the canonical sort picker |
| `DropdownMenu` | Action / account menu — navigate to an action, no persistent selected state | Navbar profile menu |

**Shared item grammar (both primitives must use this — no exceptions):**

`rounded-xl` · `py-2.5` · `font-normal` · `focus:bg-accent`

**Shared content grammar** (the container that wraps items — part of the same contract):

`rounded-2xl` · **`p-1.5`** (items inset so the hover pill floats — applies to `Select`, `DropdownMenu`, and `Command` content alike; `Select` applies `p-1.5` on the `Viewport`, `DropdownMenu` on the `Content` directly — the visual result is identical)

Consumers **must not** override the item focus state (e.g. no per-item `focus:bg-primary/10`). The Navbar Host-Dashboard item currently violates this rule and will be corrected in story A1.

### §3.1 Component Index — check before building any UI (SoT for agents)

> **Check this index before building any UI — reuse, do not rebuild.** If a primitive exists here, use it. If DESIGN.md names a primitive as "(planned)", build that primitive first (don't hand-roll inline).

#### `components/ui/*` primitives (31)

| component | use when | role/radius note |
|---|---|---|
| `alert-dialog` | Confirm / destructive action — the only modal that prompts for consent | `rounded-3xl` |
| `badge` | Status label (not clickable) — confirmed / paid / pending | `rounded-xl`; pair with a token color + text/icon (never color-only) |
| `button` | All buttons | `rounded-full`; size sm/md/lg; 1 primary per view |
| `calendar` | Pick a single date | trigger `rounded-full h-11` · day-cell states → §3 "Calendar day selection states" (button owns radius/fill, cell owns layout) |
| `card` | Raised surface grouping related content | `rounded-3xl p-4 md:p-6` |
| `checkbox` | Boolean toggle in a form | — |
| `command` | Searchable list (long / province / place) — use inside a `Popover` | item `rounded-xl` |
| `date-range-picker` | Pick a start + end date | wraps `Calendar` + `Popover` · same day-cell states as `calendar` (§3) |
| `dialog` | Focused-task modal (centered) | `rounded-3xl`, close `h-11 w-11` |
| `dropdown-menu` | Action / account menu — no persistent selected state | content `rounded-2xl` · item `rounded-xl py-2.5 font-normal focus:bg-accent` |
| `error-banner` | Server error shown at the top of a form after submit | — |
| `filter-chip` | Multi-select / toggle filter pill — **the only file allowed to style a selectable chip** | `rounded-full h-11`; selected = `bg-primary text-primary-foreground` (§3 "Chip family") |
| `image-with-fallback` | `next/image` with a graceful fallback | — |
| `input` | Raw text input (use `input-field` when label + error needed) | `rounded-full h-11` |
| `input-field` | Input + label + inline error in one unit | — |
| `input-group` | Grouped inputs (e.g. date pair) | — |
| `label` | Form field label | — |
| `loading-skeleton` | Composite page/card skeleton (route-level loading) — see `.claude/rules/loading.md` for the decision matrix, skeleton-mirrors-layout rule, section-level Suspense, and a11y contract | — |
| `loading-spinner` | Inline / button loading indicator — use for isolated module/widget (> ~1s) or user-action feedback on the control | — |
| `modal-shell` (`ModalHeader` / `ModalContent`) | Every modal's header band + shell — canonical modal shell | centered title, divider, 44px close, `rounded-3xl` |
| `permission-tooltip` | Wrap a disabled control to explain why it is disabled | — |
| `popover` | Small anchored panel (date, picker, command) | `rounded-2xl` |
| `scroll-area` | Scrollable container with styled scrollbar | — |
| `select` | Pick one value from a short list (form control) | trigger `rounded-full h-11` · content `rounded-2xl` · item `rounded-xl py-2.5` |
| `sheet` | Side / bottom drawer — long or contextual content | — |
| `skeleton` | Single-element loading placeholder | — |
| `sonner` | Transient toast feedback | — |
| `tabs` | Switch sections within one page (not cross-page nav) | — |
| `textarea` | Multi-line text input | `rounded-3xl` |
| `tooltip` | Short hint text only — no action | — |
| `truncated-label` | Text that may overflow — shows full text in a tooltip | — |

#### Composed components (`components/`)

| component | file | use when |
|---|---|---|
| `EmptyState` | `components/EmptyState.tsx` | Empty result / no-data state with illustration |
| `ErrorState` | `components/ErrorState.tsx` | Error / not-found / forbidden — full-page or inline |
| `ConfirmDialog` | `components/ui/confirm-dialog.tsx` | Canonical destructive-confirm over `AlertDialog` — use for delete, cancel, remove member |
| `CampgroundGridSkeleton` | `components/ui/loading-skeleton.tsx` (exported) | Camp-list route skeleton — mirrors the campground grid exactly (6 cards, `aspect-video`, same grid/gap); see `.claude/rules/loading.md` |
| `DashboardOverviewSkeleton` | `components/ui/loading-skeleton.tsx` (exported) | Operator-dashboard route skeleton; see `.claude/rules/loading.md` |
| `RootShellSkeleton` *(planned)* | — | Minimal last-resort skeleton for `app/loading.tsx`; planned S2 |
| `ProfileFormSkeleton` *(planned)* | — | Profile form section skeleton; planned S3 |
| `BookingListSkeleton` *(planned)* | — | Booking-list section skeleton; planned S4 |

### Empty image slot — the missing/failed photo placeholder (CAM-539)

A photo that is absent and a photo that failed to load share **one** treatment, because to a camper both
mean "no photo here". It is the **empty** state of an image (§5 list below), never an error state.

| | rule |
|---|---|
| glyph | lucide **`ImageIcon`** — a whole picture frame (rect + circle + mountain). Import it under that alias: `ImageWithFallback` already imports `Image` from `next/image`. |
| colour | `text-muted-foreground` at **full opacity** on the `bg-muted` frame — **4.15:1** light / **6.05:1** dark, clearing the 3:1 non-text floor (SC 1.4.11) in both themes |
| size | `w-8 h-8` (32px) |
| a11y | glyph `aria-hidden="true"`; the accessible name is the wrapper's `role="img"` + `aria-label={alt}`, so the slot announces once |

❌ **Never use a struck-through / "off" glyph here** (`ImageOff`, `VideoOff`, `FileX`, …). Those are lucide's
*error* marks: a full-canvas diagonal laid across a frame that is split into disjoint arcs to clear it, so
their strokes cross and the element reads as a rendering failure rather than an empty slot.
❌ **Never put alpha on the glyph** (`/40`, `/50`). It muddies every stroke crossing and it measured
**1.63:1 light / 2.15:1 dark** — below the non-text floor in both themes, which is what CAM-539 fixed.

### Interaction states + accessibility (required on every interactive element)

`default` · `hover` · `focus` (ring = `ring-ring`) · `active` · `loading` · `error` · `empty` · `disabled` — missing any one = fails the Design Gate.

**Form/error pattern** (`components/ui/form-patterns.md`): client validation → inline below the field · server error → `ErrorBanner` at the top after submit · always `<form noValidate>`.

**Accessibility — WCAG 2.1 AA checklist (enforce on every UI delivery):**

- [ ] **Keyboard** — fully operable by keyboard; logical tab order; no keyboard trap.
- [ ] **Screen reader** — meaningful `aria-label` / accessible name on every control (icon-button required); correct roles/landmarks.
- [ ] **Contrast — three floors, do not mix them up** (CAM-537): **4.5:1 body text** (SC 1.4.3) · **3:1 large text** — and large means ≥18.66px **bold** or ≥24px, so `text-lg font-semibold` (18px/600) is still body copy · **3:1 non-text** (SC 1.4.11) for a fill that identifies a **state** and for the boundary that identifies a control. Never judge a fill at the text floor or body copy at the non-text floor. Token pairs are pinned numerically by `npm run check:contrast`; verify any composite you introduce.
- [ ] **Focus** — visible focus ring (`ring-ring`, `outline-ring/50`) on every focusable element.
- [ ] **Color not the only signal** — never convey state by color alone; pair with text/icon/shape.
- [ ] **Touch target ≥44px** — interactive elements ≥44px (icon-button `h-11 w-11`).
- [ ] **Tooling** — run **axe** (axe DevTools / `@axe-core`) and resolve violations before handoff.

## §4 Copy & content

- Thai tone is **friendly but polite + action-oriented** (`เลือกวันเช็คอิน`, not `คุณสามารถเลือก...`) · EN is concise imperative ("Choose dates").
- ❌ No technical jargon in user-facing text (`API`, `OAuth`, `endpoint`, `validation`, `User ID`) → use human language.
- ❌ **em-dash (—) as a separator** in copy → use `,` `:` parentheses (— is only allowed as the empty value in a table).
- Prices/dates/numbers = `tabular-nums`.
- Every copy string has **TH/EN in `locales/`** (never hardcode) — copy = one glossary.
- **Do:** `ยืนยันการจอง` · **Don't:** "Submit booking request" / "validation error: date-before-today".

## §5 Named anti-patterns — block AI-slop (tell the agent to "escape" the average of its training)

> An LLM tends to produce the average value = slop. Name it directly to push it away. If the output looks like this = **wrong, send it back.**

| ❌ AI-slop tell | ✅ CampVibe counter |
|---|---|
| centered hero + purple-blue gradient + 3 identical cards | asymmetric, **1 dominant cell** per section, mixed cell sizes, teal POV with no gradient |
| generic heading font (Inter/Roboto/Arial/system) | **Outfit** (EN) / **Sarabun semibold** (Thai) |
| every card at radius 16px across the whole page | radius by role per §2 (card rounded-3xl, control rounded-full) |
| decorative meaningless badges, fake mockups, floating icon pills | every element serves the task (Lean §1) — cut what isn't needed |
| over-saturated / washed-out / flat-gray colors | OKLCH tokens, neutrals tinted toward teal |
| empty grid cells, blandly symmetric layout | fill every cell, lay it out with weight |
| gradients / heavy shadows / cards stacked on cards | content leads, light chrome (border + spacing > shadow) |
| em-dash, technical jargon, generic copy | §4 |
| an empty slot drawn with an error mark — a struck-through "off" glyph, faded to `/40` grey, so it reads "broken" | the **whole** glyph at full token opacity (§3 "Empty image slot") — absence is not failure |

## §6 Quality gate — pre-delivery checklist (can block a PR, run before merge→staging = "Done")

- [ ] **Token-only** — no free-floating hex/px/colors, reference tokens + scale (light + dark) · `npm run check:palette` green
- [ ] **Component-in-system** — `components/ui/*` only, no out-of-system components · icon imports use **lucide-react only** (§7) — `@tabler/icons-react` has been removed (DS-5) · `npm run check:ds` green, including **R9** (no hand-rolled selectable pill — use `FilterChip`, §3 "Chip family")
- [ ] **Scale matches role** — radius/size/spacing per §2 (no inline height override)
- [ ] **All 8 states** — default/hover/focus/active/loading/error/empty/disabled + form/error pattern
- [ ] **Loading state (blocks PR)** — every page/component with an async dependency must: (a) use the correct loader per the decision matrix (`.claude/rules/loading.md`); (b) if skeleton: mirror the real layout exactly (exact dims/count/grid — CLS = 0), NOT a generic gray block; (c) show a section-level skeleton only (chrome/navbar renders instantly) unless the ENTIRE route is async; (d) wire a11y (`aria-busy`, `role="status"`, `aria-live="polite"`, `กำลังโหลด…` label, `prefers-reduced-motion` disables shimmer); (e) anti-flicker per context — Suspense fallback: delay-before-show via `loading-delay` CSS utility (`app/globals.css`), min-display N/A; client-fetch skeleton: both delay + min-display via `useMinimumLoading` hook. Missing loading state OR wrong loader for the matrix OR full-page skeleton for a section-level fetch OR missing a11y = **Critical, blocks merge**.
- [ ] **a11y AA** — contrast **4.5:1 body / 3:1 large text / 3:1 non-text state + control boundary** (§3), visible focus ring, complete `aria-label`, tap ≥44px (full checklist in §3, verified with axe) · **`npm run check:contrast` green** — the numeric token guard (CAM-537); a changed token value must clear its floor in BOTH themes
- [ ] **i18n** — TH/EN in `locales/`, no em-dash separator, no technical jargon, tabular-nums
- [ ] **Motion** — transform/opacity only, 120–250ms, no `transition:all`, respect reduced-motion
- [ ] **Layout sanity** — nav < 80px tall, CTA does not wrap, no duplicate CTA intent, no generic card-grid
- [ ] **Anti-slop (§5)** — compare the screenshot to the §1 POV: it is CampVibe, not a template
- [ ] **Test ID** — `<type>--<module>-<detail>` (e.g. `btn--wishlist-toggle`)

> Verify the AC for real on the **Staging URL** before it counts as Done · enforcement guard: `scripts/check-palette.mjs` (+ proposed consistency guard, backlog §8).

## §7 Icon policy

- **lucide-only** (`lucide-react`) for static UI + facility/DB-driven icons — **one library** (DS-5 / CAM-125 complete — `@tabler/icons-react` has been removed from the codebase).
- filled-icon variant → use `fill-current` on the existing lucide icon (no separate filled component).

## §8 Living reference & consolidation backlog

**Living reference = `/preview`** (kitchen-sink, noindex) — agents/humans look at the real thing here · must be expanded (backlog): size/variant grid, composite patterns (form+validation+error+loading), decision-matrix examples, mobile view.

**Consolidation backlog (next epic — use this DESIGN.md v2 as the spec, ordered by impact):**

1. **Dropdown/select → 1 grammar** + ~~build a `FilterChip` component~~ ✓ **chip half done (CAM-532)** — `FilterChip` exists, FilterModal + SearchModal both use it, the selected-state contradiction is resolved (§3 "Chip family"), and `check:ds` R9 blocks the next hand-rolled pill. The Profile/Search/Sort/Form/Team **Select** alignment half is still open.
2. **Button `size="lg"` (h-12)** + drop every inline `!h-12`/`h-10` override.
3. **Card primitive** — CampgroundCard + CampgroundForm stop hardcoding `rounded-xl`/`rounded-3xl` and use `Card`.
4. **One modal shell** (`rounded-3xl`, close `h-11 w-11`) — align AmenitiesModal (`rounded-2xl`).
5. **Input `size="lg"`** (h-12 rounded-full) — drop `!h-12` in LoginModal/SearchModal.
6. **Badge taxonomy** — status=`Badge`, filter=`FilterChip`; drop raw `<span>` (e.g. booking status).
7. ~~**Icon migration tabler→lucide**~~ ✓ **Done (DS-5 / CAM-125)** — `@tabler/icons-react` removed; lucide-only throughout.
8. **Consistency CI guard** — extend `check-palette.mjs` to catch inline height/radius off-scale (prevent drift like the palette).
9. **Wire Sarabun** — `next/font/google` subset thai+latin + Thai font stack (`:lang(th)`) → heading Sarabun semibold.
10. **Cleanup** — remove the stale hex `--color-primary:#0d9488` in `@theme` (globals.css), and the `"orange-600"` comment that does not match the value.
11. **Dark-mode contrast** — ✓ **state fills done (CAM-537), teal TEXT done (CAM-546), boundaries still open.** The *selected* chip fill measured **2.31:1** vs `--card` in dark (5.39:1 light), under the 3:1 WCAG 1.4.11 floor. CAM-537 raised dark `--primary` and `--accent` from `L 0.437` to **`L 0.520`** (lightness only — chroma/hue untouched), taking the fill to **3.28:1** vs `--card` and **3.73:1** vs `--background` while the near-white label holds at **5.08:1**. The feasible window is **L ∈ [0.499, 0.549]** and both ends are pinned by `npm run check:contrast` (now **54 enforced pairs**, backlog 0, blocking).
    ✓ **The `text-primary` half is CLOSED by CAM-546 — the fill/text token split.** `--primary` provably could not do both jobs: as text on the dark `--card` it needs `L ≥ 0.596`, while a near-white label *on the fill* needs `L ≤ 0.548` — disjoint windows. So `--primary` now paints **fills, borders, rings and icons**, and the new **`--primary-ink`** (`0.760 0.120 184` dark; light = light `--primary`, so light mode is unchanged) paints **words**. Measured: dark text went **3.73 → 9.68:1** on `--background`, **3.28 → 8.52:1** on `--card`, and **3.01 → 7.81:1** on a `bg-primary/10` tint (the worst surface in the app — a tint *lightens* the backdrop, so it is harder than the bare surface, and `check:contrast` now models it via `overlay`). This closed a **serious** axe `color-contrast` violation on `/preview` (`#257771` on `#090b0c`, 3.71:1) that surfaced when dark became the default theme (CAM-544).
    **Known duplication (follow-up, not a defect):** `--primary-ink` and `--ai-price` now hold identical values in both themes — they do the same job, and the app should have exactly one bright teal for dark text rather than two. They are not merged only because `__tests__/cam-444-*` pins `--ai-price` as a literal `oklch()` declaration.
    **Still open — each needs one owner decision, all measured, none shipped:**
    - `--border` **1.25:1** light / 1.26–1.34 dark, `--input` **1.25 / 1.48**, `--ai-tint` **1.10 / 1.31** — clearing 3:1 pushes `--border` from `L 0.925` to ~`0.669`, i.e. every divider and card outline becomes a mid-grey line. That contradicts the §1 POV ("chrome is light, hierarchy through spacing + typography"), so it is a **look change**, not a bug fix. Decide the three together; splitting them fragments the look.
    - `--ring` **2.44:1** light (dark passes at 4.27) — a real 1.4.11 failure, but the indicator a user actually sees is composed in the components (`ring-ring/30` on Button, `ring-ring/50` on Badge), so the token alone does not determine it. Needs a component-level story, not a token edit.
    All of the above are printed on every `check:contrast` run as the DEFERRED set, with the reason on each row, so they cannot be quietly forgotten.

## Examples

Representative ✅/❌ (the full sets live in §2/§3/§5):

- ✅ `className="bg-card text-card-foreground rounded-3xl p-6"` (tokens + role radius) · ❌ `className="bg-[#0d9488] rounded-[22px] p-[24px]"` (inline palette/px — fails `check:palette`).
- ✅ Profile menu = `DropdownMenu`, Filter = `FilterChip` — different roles, **shared grammar** (radius/size/spacing from §2). · ❌ a bespoke dropdown with its own radius/weight.
- ✅ status as `<Badge variant="success">` + text/icon · ❌ a raw `<span>` colored only by hue (color-only signal fails a11y).
- ✅ CampVibe layout: one dominant cell, teal POV, no gradient · ❌ centered hero + purple-blue gradient + 3 identical cards (the §5 slop tell).

## Reference Files

- `app/globals.css` — authoritative OKLCH token values (light + `.dark`).
- `components/ui/*` — the only component vocabulary; `components/ui/form-patterns.md` — the form/error pattern.
- `app/preview` — living kitchen-sink reference.
- `.claude/rules/ux.md` — field validation + PDPA (not duplicated here); `.claude/rules/seo.md` — public-facing metadata / JSON-LD / CWV.
- `scripts/check-palette.mjs` — the CI enforcement guard (`npm run check:palette`).

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's just one `bg-[#0d9488]`, the token is basically the same color." | `npm run check:palette` exits 1 on any hardcoded palette — the PR cannot pass. Use the token. |
| "The value I need isn't in the scale, so I'll set `h-[52px]` this once." | The token layer is closed. Stop and propose a new token in `app/globals.css` (Designer + Architect approve), then use it. |
| "I'll add a `dark:` override so it looks right in dark mode." | Dark mode flips automatically via `.dark`. A hand-written `dark:` color override is a defect, not a fix. |
| "A quick custom dropdown is faster than wiring the primitive." | Vocabulary is `components/ui/*` only. An out-of-system component fails the Design Gate. |
| "Color alone makes the status obvious enough." | Color is never the only signal (a11y). Pair it with text/icon/shape and a `Badge`. |
| "Copy the existing modal's markup — it already looks right." | Cloning a modal's chrome silently inherits its BEHAVIORAL a11y gaps too: PanoramaViewer copied ImageGallery and inherited the missing focus-trap + body-scroll-lock (fixed once for both in `lib/hooks/use-modal-a11y.ts`). Before cloning dialog/overlay chrome, check for the shared a11y hook and consume it — behavior reuses like tokens do (CAM-354/CAM-368). |
| "Centered hero + gradient + three matching cards is a safe default." | That is the §5 AI-slop tell. It is not CampVibe — send it back. |
| "Profile menu and Filter do different jobs, so they can look different." | Different roles can be different components, but they must share one grammar (radius/size/spacing from §2). |

## Verify (exit criteria)

- [ ] Read this file before touching UI (§0); decisions trace to a token/primitive, not a guess.
- [ ] Token-only: no free hex/px/colors; `npm run check:palette` is green.
- [ ] Components from `components/ui/*` only; icons from lucide-react only (§7).
- [ ] Radius/size/spacing match the §2 scale by role; no inline height override.
- [ ] All 8 interaction states present + form/error pattern.
- [ ] WCAG 2.1 AA checklist passes (keyboard, screen reader, contrast 4.5:1/3:1, focus, color-not-only, tap ≥44px, axe clean).
- [ ] i18n: TH/EN in `locales/`, no em-dash separator, no jargon, tabular-nums.
- [ ] Motion: transform/opacity only, 120–250ms, no `transition:all`, respects reduced-motion.
- [ ] §6 layout sanity + §5 anti-slop check pass; test IDs follow `<type>--<module>-<detail>`.
- [ ] AC verified on the real Staging URL before marking Done.

---

*v1 (token + Design Gate) remains the core — v2 adds brand POV, fixed-number scales, the component decision matrix, motion, named anti-patterns, and AI-agent framing to keep output deterministic and slop-free.*
