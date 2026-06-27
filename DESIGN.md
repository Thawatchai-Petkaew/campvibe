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
| `primary` / `primary-foreground` | `0.511 0.096 186.391` / `0.984 0.014 180.72` | `0.437 0.078 188.216` / `0.984 0.014 180.72` | primary buttons, actions, prominent links, selected | wide backgrounds, body text |
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
| button · input · select-trigger · chip/pill · icon-button | `rounded-full` | — |
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

## §3 Component contracts + decision matrix (which primitive for which job)

**Vocabulary = `components/ui/*` only** (28 components: button, input, input-field, input-group, label, textarea, checkbox, select, dropdown-menu, popover, command, dialog, alert-dialog, sheet, calendar, date-range-picker, tooltip, tabs, scroll-area, card, badge, skeleton, loading-spinner, loading-skeleton, error-banner, permission-tooltip, truncated-label, sonner). Do not invent components outside the system.

### Choosing a "picker / menu" — one grammar per role (resolves the Profile-vs-Filter case the owner flagged)

| job | use | spec | ❌ do not use |
|---|---|---|---|
| pick **one value** from a short list (form) | `Select` | trigger `rounded-full h-11` · content `rounded-2xl` · item `rounded-xl py-2.5` | DropdownMenu, custom button |
| **long / searchable** list (province/place) | `Popover` + `Command` | content `rounded-2xl` · item `rounded-xl` | a long `Select` |
| **command/account menu** (go to an action, not pick a value), e.g. Profile menu | `DropdownMenu` | content `rounded-2xl` · item `rounded-xl` (normal weight) — **same grammar as Select** | ❌ panel rounded-xl + bold item rounded-lg (the old style that made it look inconsistent) |
| **multi-select / toggle filter** (FilterModal) | the **FilterChip** pattern | pill `rounded-full border`; selected = `bg-foreground text-background`; image-card variant `rounded-2xl` for categories with a photo — **one style** | Select, raw `<span>` |
| boolean | `Checkbox` / Switch | — | — |
| confirm/delete (destructive) | `AlertDialog` | — | `window.confirm` |
| transient feedback | `toast` (sonner) | — | a persistent inline alert |

> **Answer to the owner's case:** Profile dropdown = `DropdownMenu` (command menu), Filter selection = `FilterChip` (multi-select) — **different roles, so they can be different components** but **must share grammar**: radius/size/spacing from the one §2 set → they "look like one family" even though they do different jobs.

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
| pick a date / date range | `Calendar` (single) / `DateRangePicker` (range) in a `Popover` | trigger `rounded-full h-11` |
| status label (not clickable) | `Badge` `rounded-xl` | status (confirmed/paid) uses `Badge` + token success/destructive/muted — **not a raw `<span>`** · a clickable filter → FilterChip (§ table) |
| truncated text + tooltip | `TruncatedLabel` | — |
| **icon-chip background** (stat cards, active nav, dashboard) | `<div>` / `<span>` wrapping an icon | `bg-(primary\|success\|warning\|info\|destructive)/10` — 10% opacity tint fill; pair with the matching `text-(color)` or `text-(color)-foreground` icon · ❌ do **not** apply this pattern to a `<Button>` or `<Badge>` className (use variant instead) |
| **ghost-primary link-action** (utility/dashboard surfaces) | `<Button variant="ghost">` | add `className="text-primary hover:bg-primary/5"` — low-chrome "view / go" action on product-utility pages (dashboard, bookings list) · ❌ do **not** use as a primary CTA or on marketing/brand pages (use `default` or `link` variant) |

### Composition (existing primitives and wrappers — reuse, do not rebuild)

Before building anything new, check this list and the Component Index (§3.1 below). Re-implementing an existing primitive is the #1 source of UI drift (CAM-220/CAM-221).

| primitive | file | use when |
|---|---|---|
| `ModalHeader` / `ModalContent` | `components/ui/modal-shell.tsx` | every modal's header band + shell (centered title, divider, 44px close, `rounded-3xl`) — the **canonical modal shell**; do not hand-roll a modal header |
| `EmptyState` | `components/EmptyState.tsx` | empty result / no-data state with an illustration |
| `ErrorState` | `components/ErrorState.tsx` | error / not-found / forbidden — full-page or inline |
| `ConfirmDialog` | *(planned — story B3)* | canonical destructive-confirm wrapper over `AlertDialog`; **do not hand-roll a confirm dialog** — wait for B3 or use `AlertDialog` directly in the interim |
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
| `ImageWithFallback` | `components/ui/image-with-fallback.tsx` | `next/image` with a graceful fallback |

### Dropdown / select grammar (canonical — resolves the "which dropdown is correct" question)

`Select` and `DropdownMenu` are **different primitives for different jobs** and must NOT be mixed:

| primitive | job | example in the codebase |
|---|---|---|
| `Select` | Pick one value from a list (form control) — shows a persistent selected-check mark | `SortDropdown` — the canonical sort picker |
| `DropdownMenu` | Action / account menu — navigate to an action, no persistent selected state | Navbar profile menu |

**Shared item grammar (both primitives must use this — no exceptions):**

`rounded-xl` · `py-2.5` · `font-normal` · `focus:bg-accent`

Consumers **must not** override the item focus state (e.g. no per-item `focus:bg-primary/10`). The Navbar Host-Dashboard item currently violates this rule and will be corrected in story A1.

### §3.1 Component Index — check before building any UI (SoT for agents)

> **Check this index before building any UI — reuse, do not rebuild.** If a primitive exists here, use it. If DESIGN.md names a primitive as "(planned)", build that primitive first (don't hand-roll inline).

#### `components/ui/*` primitives (31)

| component | use when | role/radius note |
|---|---|---|
| `alert-dialog` | Confirm / destructive action — the only modal that prompts for consent | `rounded-3xl` |
| `badge` | Status label (not clickable) — confirmed / paid / pending | `rounded-xl`; pair with a token color + text/icon (never color-only) |
| `button` | All buttons | `rounded-full`; size sm/md/lg; 1 primary per view |
| `calendar` | Pick a single date | trigger `rounded-full h-11` |
| `card` | Raised surface grouping related content | `rounded-3xl p-4 md:p-6` |
| `checkbox` | Boolean toggle in a form | — |
| `command` | Searchable list (long / province / place) — use inside a `Popover` | item `rounded-xl` |
| `date-range-picker` | Pick a start + end date | wraps `Calendar` + `Popover` |
| `dialog` | Focused-task modal (centered) | `rounded-3xl`, close `h-11 w-11` |
| `dropdown-menu` | Action / account menu — no persistent selected state | content `rounded-2xl` · item `rounded-xl py-2.5 font-normal focus:bg-accent` |
| `error-banner` | Server error shown at the top of a form after submit | — |
| `filter-chip` | Multi-select / toggle filter pill | `rounded-full`; selected = `bg-foreground text-background` |
| `image-with-fallback` | `next/image` with a graceful fallback | — |
| `input` | Raw text input (use `input-field` when label + error needed) | `rounded-full h-11` |
| `input-field` | Input + label + inline error in one unit | — |
| `input-group` | Grouped inputs (e.g. date pair) | — |
| `label` | Form field label | — |
| `loading-skeleton` | Composite page/card skeleton (route-level loading) | — |
| `loading-spinner` | Inline / button loading indicator | — |
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
| `ConfirmDialog` | *(planned — story B3)* | Canonical destructive-confirm over `AlertDialog` |

### Interaction states + accessibility (required on every interactive element)

`default` · `hover` · `focus` (ring = `ring-ring`) · `active` · `loading` · `error` · `empty` · `disabled` — missing any one = fails the Design Gate.

**Form/error pattern** (`components/ui/form-patterns.md`): client validation → inline below the field · server error → `ErrorBanner` at the top after submit · always `<form noValidate>`.

**Accessibility — WCAG 2.1 AA checklist (enforce on every UI delivery):**

- [ ] **Keyboard** — fully operable by keyboard; logical tab order; no keyboard trap.
- [ ] **Screen reader** — meaningful `aria-label` / accessible name on every control (icon-button required); correct roles/landmarks.
- [ ] **Contrast** — **4.5:1 body text · 3:1 heading / large text** (token colors meet this; verify any composite).
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

## §6 Quality gate — pre-delivery checklist (can block a PR, run before merge→staging = "Done")

- [ ] **Token-only** — no free-floating hex/px/colors, reference tokens + scale (light + dark) · `npm run check:palette` green
- [ ] **Component-in-system** — `components/ui/*` only, no out-of-system components · icon imports use **lucide-react only** (§7) — `@tabler/icons-react` has been removed (DS-5)
- [ ] **Scale matches role** — radius/size/spacing per §2 (no inline height override)
- [ ] **All 8 states** — default/hover/focus/active/loading/error/empty/disabled + form/error pattern
- [ ] **a11y AA** — contrast **4.5:1 body / 3:1 heading**, visible focus ring, complete `aria-label`, tap ≥44px (full checklist in §3, verified with axe)
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

1. **Dropdown/select → 1 grammar** + build a `FilterChip` component (align Profile menu + Search/Sort/Form/Team Select + FilterModal chips).
2. **Button `size="lg"` (h-12)** + drop every inline `!h-12`/`h-10` override.
3. **Card primitive** — CampgroundCard + CampgroundForm stop hardcoding `rounded-xl`/`rounded-3xl` and use `Card`.
4. **One modal shell** (`rounded-3xl`, close `h-11 w-11`) — align AmenitiesModal (`rounded-2xl`).
5. **Input `size="lg"`** (h-12 rounded-full) — drop `!h-12` in LoginModal/SearchModal.
6. **Badge taxonomy** — status=`Badge`, filter=`FilterChip`; drop raw `<span>` (e.g. booking status).
7. ~~**Icon migration tabler→lucide**~~ ✓ **Done (DS-5 / CAM-125)** — `@tabler/icons-react` removed; lucide-only throughout.
8. **Consistency CI guard** — extend `check-palette.mjs` to catch inline height/radius off-scale (prevent drift like the palette).
9. **Wire Sarabun** — `next/font/google` subset thai+latin + Thai font stack (`:lang(th)`) → heading Sarabun semibold.
10. **Cleanup** — remove the stale hex `--color-primary:#0d9488` in `@theme` (globals.css), and the `"orange-600"` comment that does not match the value.

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
