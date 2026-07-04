---
linear: CAM-350
feature: m1-data-trust
epic: m1-listing-truth-ราคา-ค่าธรรมเนียม-นโยบายยกเลิก-qu (CAM-288)
persona: host
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-04
---
# Design — Weight-segmented listing-completeness progress card (CAM-350)

> **What this formalizes.** The owner picked wireframe **A** in chat (2026-07-04) as the FINAL
> direction: replace the current text-only `ListingCompletenessCard` body with a
> **weight-segmented progress bar + a remaining-jobs list that shows each job's `+N%` payoff**.
> This document is the design contract Frontend builds from — it does not re-open the direction.
> G2 direction is pre-approved; this doc specifies tokens, states, the new primitive, a11y, and
> the responsive rule so `check:ds` + `check:palette` pass.
>
> **Scope of change vs CAM-305.** The card's data plumbing is unchanged — same frozen CAM-304
> contract `GET /api/campsites/[id]/completeness → { score, missing[] }`, same client-fetch +
> `useMinimumLoading` anti-flicker, same per-card error/retry, same deep-link map (CAM-305 BR-2,
> now resolving to CAM-341's real section anchors), same zero-campsite dashboard gating. **Only
> the card body's presentation changes** — from a text score line + plain missing list to a
> segmented bar + payoff-annotated jobs list. No API change, no new field, no scoring logic.

## Flow

Host → operator dashboard (`app/dashboard/page.tsx`) → the "ความครบถ้วนของข้อมูลลาน" section renders
one `ListingCompletenessCard` per owned campsite (unchanged wiring). For each card:

1. Card mounts → client-fetches its completeness → shows the loading skeleton (mirrors the new
   bar+rows layout) with anti-flicker.
2. On data (score < 100): the card shows the campsite name + a `ครบ {N}%` score pill, the
   **segmented bar** (6 segments sized by weight; satisfied = filled, missing = translucent), an
   optional under-bar label strip (wide cards only), the `งานที่เหลือ {N} รายการ` count, and the
   **remaining-jobs list** — one row per missing item (verbatim API label + `+{N}%` payoff +
   deep-link).
3. Host clicks a job row → navigates to that campsite's edit surface at the field's anchor
   (`/dashboard/campsites/{id}/edit#{anchor}`), the place the gap is fixed (CAM-341 shipped the
   anchors + the fee/policy inputs).
4. On data (score = 100): the card shows the fully-filled bar + the success affirmation
   `ข้อมูลลานของคุณครบถ้วนแล้ว`, no jobs list.
5. On fetch failure: the per-card error state (`โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง` + `ลองใหม่`),
   isolated to that one card (unchanged from CAM-305 BR-6).

## Non-goals

- **No ring/radial or stepper/checklist variants** of the progress primitive — one horizontal
  weight-segmented bar only. A future consumer may add variants; this story ships the bar.
- **No API / contract / scoring change** — the card reads the frozen CAM-304 payload; weights come
  from the existing `LISTING_COMPLETENESS_WEIGHTS` export (a pure, client-importable module).
- **No inline editing, no sort, no aggregated roll-up card** — read-only + deep-link navigation,
  one card per campsite (unchanged CAM-305 boundaries).
- **No new screen or flow** — the card stays in the same dashboard section; only its body changes.

## Alternatives considered

- **Keep the text score line + a plain missing list (CAM-305 as-is).** Rejected by the owner:
  a bare percentage doesn't show a host *which* gaps cost the most or how much each fix is worth,
  so it under-motivates. The segmented bar makes each criterion's weight visible and the `+N%`
  payoff turns each missing row into a ranked, rewarded to-do.
- **A single plain `Progress` fill bar (one solid fill to `{score}%`).** Rejected: a single fill
  conveys the number but hides *composition* — it can't show that "photos" is worth 25% while
  "zones" is worth 10%, which is the whole point. The segmentation IS the information.

## The new primitive — `SegmentedProgress` (`components/ui/segmented-progress.tsx`)

The only new primitive. A **display** component (like `Badge`/`Skeleton`) — non-interactive, so
the "8 interaction states" apply to the card's job-row links + retry button, not to the bar.

### Purpose

A horizontal bar divided into N segments whose widths are **proportional to a per-segment
`weight`**, each segment rendered as either satisfied (filled) or unsatisfied (translucent,
bordered). Generic + reusable; its first (and only, this story) consumer is the completeness card.

### Props (contract)

| prop | type | notes |
|---|---|---|
| `segments` | `Array<{ key: string; weight: number; complete: boolean }>` | ordered; segment width = `weight / Σweight`. The bar renders in array order. |
| `aria-label` | `string` (required) | the accessible summary for `role="img"` — the consumer composes it (e.g. `ความครบถ้วนของข้อมูลลาน 80%`). |
| `className` | `string?` | passthrough on the track (height override etc.). |

The primitive computes each segment's `flex-basis` = `(weight / Σweight) * 100 + '%'`. **This one
data-driven inline `style={{ flexBasis }}` is the sole inline style** and carries no color/px
literal — it is a proportion, analogous to a chart bar width, and does not trip `check:palette`
(which only flags hex + numbered palette). All color/radius/spacing stay tokens.

### Anatomy + exact tokens

```
track  ┌───────────────────────────────────────────────┐
       │ ██████████ │ ███████ │▒▒▒▒▒▒▒│ █████ │ ███ │███ │   rounded-full, h-2.5
       └───────────────────────────────────────────────┘
         seg(complete)  seg(complete) seg(missing) …
```

| part | classes (tokens only) | role |
|---|---|---|
| **track** | `flex h-2.5 w-full items-stretch gap-0.5 overflow-hidden rounded-full` + `role="img"` + `aria-label` | the bar container; `gap-0.5` shows the card surface between segments as thin dividers; `overflow-hidden rounded-full` gives clean pill ends. `h-2.5` = a slim bar (scale utility). |
| **segment (satisfied)** | `min-w-2 bg-primary border border-transparent` + `style={{ flexBasis }}` + `aria-hidden` | filled with the brand teal → "this criterion is done". `min-w-2` floors the narrowest (10%) segment so it never collapses to invisible. |
| **segment (missing)** | `min-w-2 bg-muted border border-border` + `style={{ flexBasis }}` + `aria-hidden` | translucent muted fill + a `border-border` edge — the border is **load-bearing for a11y**: `bg-muted` is near-white on the white card, so the border supplies the ≥3:1 non-text (graphical) boundary (WCAG 1.4.11). Equal box model to satisfied (both carry a 1px border, one transparent), so no height jump. |

Radius: track `rounded-full` (pill role, §2). Segments carry no own radius (square, clipped by the
track) — this avoids the `check:ds` R1 off-role-radius trap; the primitive is in `components/ui/**`
(excluded from `check:ds`) but is kept clean anyway.

### Token choice — why `primary` (teal) for the filled segment, not `success`

Per `DESIGN.md` §2 semantics, `success` is reserved narrowly for **"confirmed / accepted / paid"**
(a transactional finality). Listing completeness is **progress**, not a transaction — so the
progressing bar uses `primary` (the brand's one strong opinion, "teal calm-confidence"), which is
maximally on-brand for a product-utility dashboard surface. `success` stays reserved for the **100%
affirmation badge** (`ข้อมูลลานของคุณครบถ้วนแล้ว`) — so the visual story is a deliberate escalation:
**teal while working → green once truly complete**, not a redundant double-green. Missing segments
use `muted` (§2: "secondary surfaces … skeleton").

### Motion / reduced-motion

- Optional entrance: a `motion-safe:animate-in motion-safe:fade-in` (opacity only) on the track,
  120–250ms, easing `cubic-bezier(0.23,1,0.32,1)` — **transform/opacity only** per §2; **never**
  animate segment width/`flex-basis` (§2 bans animating width/height).
- Under `prefers-reduced-motion: reduce` the entrance is disabled (the `motion-safe:` gate omits
  it) → the bar renders at its final state immediately. **No fill animation under reduce.**

## Card composition — `ListingCompletenessCard` (revised body)

`Card` (`rounded-3xl`, `bg-card`, `p-4 md:p-6`, unchanged shell) → `CardHeader` (campsite name,
unchanged) → `CardContent` (`@container`, `aria-busy`) contains, top to bottom:

1. **Header row** — the campsite name (left, `CardTitle`, existing) + a **score pill** on the right:
   `<Badge variant="muted" className="tabular-nums">ครบ {N}%</Badge>` (variant prop carries the
   color — no `bg-*` in className, so `check:ds` R5b stays clean). `{N}` = the API `score`
   (authoritative), not a re-sum of the segments.
2. **`<SegmentedProgress segments=… aria-label=…/>`** — the bar (see primitive above).
3. **Under-bar label strip (wide cards only, container-query gated)** — a flex row whose cells mirror
   the segment widths; each cell = a status icon + the criterion short label + its weight, stacked:
   - satisfied cell: lucide `Check` (`text-primary size-3`) + `<TruncatedLabel>` short label
     (`text-foreground`) + `{N}%` (`text-muted-foreground tabular-nums`).
   - missing cell: lucide `Minus` (`text-muted-foreground size-3`) + short label + `ขาด {N}%`
     (`text-muted-foreground tabular-nums`) — the `Minus` glyph + the word `ขาด` are the non-color
     signals.
   - The strip is `aria-hidden="true"` (decorative reinforcement) — its meaning is exposed
     authoritatively by the bar's `role="img"` summary + the jobs list text.
4. **Count line** — `งานที่เหลือ {N} รายการ` (`text-sm text-muted-foreground`, `{N}` = `missing.length`).
5. **Remaining-jobs list** — `<ul>` of `next/link` rows (one per `missing[]` item, in API order):
   - verbatim API `label` (`<span>{item.label}</span>` — preserves CAM-305 BR-1: no hardcoded
     Thai label, never re-derived from `key`).
   - a **payoff badge**: `<Badge variant="muted" className="tabular-nums">+{N}%</Badge>` where `{N}`
     = that key's weight from `LISTING_COMPLETENESS_WEIGHTS` (imported; no hardcoded 25/20/…).
   - a trailing lucide `ArrowUpRight` (`aria-hidden`) — the "opens the edit surface" cue.
   - row shell reuses the CAM-305 link styling: `rounded-xl px-3 py-2 hover:bg-muted
     hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring`.
   - href = `fixLinkFor(campSiteId, item.key)` (the existing CAM-305 BR-2 `ANCHOR_BY_KEY` map,
     now resolving to CAM-341's real `#photos/#price/#cancellation-policy/#extra-fee/#zones/
     #amenities` anchors; unknown key → `/edit` with no hash).

**Data derivation (single-source, no hardcoding):** the segment array is built by mapping over the
imported `LISTING_COMPLETENESS_WEIGHTS`; per criterion `complete = !missing.some(m => m.key ===
criterion.key)`; width comes from `weight`; the payoff for a job row = the weight looked up by
`key`. If a `missing[]` key is not in the weights table (upstream drift), the job row still renders
(verbatim label + deep-link) but **omits the `+N%` badge** (no weight to show) — it never appears as
a segment and never becomes a dead link.

## States (8)

| state | behavior |
|---|---|
| **default** | score < 100: name + `ครบ {N}%` pill + segmented bar (filled/translucent segments) + (wide) under-bar strip + `งานที่เหลือ {N} รายการ` + jobs list. |
| **hover** | job-row link → `bg-muted` + `text-foreground`, trailing arrow to `text-foreground`; retry button hover (Button grammar); on a narrow card, hovering a bar has no tooltip (bar is `aria-hidden`/decorative) — the segment short names live in the `TruncatedLabel` tooltips of the under-bar strip when it is shown. |
| **focus** | job-row link + retry button show the visible ring (`focus-visible:ring-2 ring-ring`); tab order = name → (pill is non-interactive) → each job row top-to-bottom → retry (error state only). No keyboard trap. |
| **active** | job-row link press (native); retry button `active:scale-95` (Button grammar). |
| **loading** | `useMinimumLoading` skeleton that **mirrors the new layout** (title bar + score-pill block + one `h-2.5 rounded-full` bar block + count-line block + 1–2 job-row blocks) — `bg-muted` via `Skeleton`; `aria-busy` + `role="status" aria-live="polite"` + `กำลังโหลด…` (`t.common.loading_sr`); skeleton region `aria-hidden`; shimmer off under reduced-motion (Skeleton already `motion-reduce:animate-none`). Anti-flicker: delay 300ms / min-display (client-fetch, CAM-305 BR-5). |
| **error** | `ErrorBanner` (`โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง`) + `ลองใหม่` retry `<Button size="sm" variant="outline">`; re-fetches only this card; other cards unaffected (CAM-305 BR-6, unchanged). |
| **empty** | score = 100 / `missing` empty: the bar renders fully filled + the affirmation `ข้อมูลลานของคุณครบถ้วนแล้ว` in a `<Badge variant="success">` with a lucide `CheckCircle2`; **no** jobs list, **no** count line (the "nothing left to complete" empty). Dashboard-level zero-campsite empty (no section at all) is unchanged CAM-305 BR-7, owned by `app/dashboard/page.tsx`. |
| **disabled** | N/A for the card's own content — every job row always has a valid edit target (never a disabled link) and the card has no form submit. The retry button follows the standard `Button` disabled grammar only if a re-fetch is briefly in flight (optional; not required). Documented N/A with reason. |

### Worked examples — 0% / partial / 100%

- **0%** — API `score:0`, all six keys in `missing[]`. All six segments = `bg-muted border-border`
  (translucent). Pill `ครบ 0%`. `งานที่เหลือ 6 รายการ`. Jobs list = six rows, each with its `+{N}%`
  (photos `+25%`, price `+20%`, cancellationPolicy `+20%`, extraFee `+15%`, zones `+10%`,
  amenities `+10%`).
- **partial (80%, the owner wireframe)** — satisfied: photos(25)·price(20)·extraFee(15)·zones(10)·
  amenities(10) = 80; missing: cancellationPolicy(20). Bar: five `bg-primary` segments + one
  `bg-muted border-border` segment (the 20%-wide cancellationPolicy slot). Pill `ครบ 80%`.
  `งานที่เหลือ 1 รายการ`. Jobs list = one row: `ยังไม่ระบุนโยบายยกเลิก` (verbatim API label) +
  `+20%` badge + `ArrowUpRight`, deep-linking to `…/edit#cancellation-policy`.
  > The chat wireframe sketched this row as `ระบุนโยบายยกเลิก`; the LOCKED decision is
  > "remaining-jobs rows = missing[] labels **verbatim from the API**", so the row renders the API
  > label `ยังไม่ระบุนโยบายยกเลิก` char-for-char (preserving CAM-305 BR-1), not the sketch's shorthand.
- **100%** — API `score:100`, `missing:[]`. Bar fully filled (six `bg-primary` segments). Affirmation
  `ข้อมูลลานของคุณครบถ้วนแล้ว` + success badge. No jobs list, no count line.

## Responsive behavior (the collapse rule)

Six labels cannot fit under the narrowest segments (zones/amenities are 10% ≈ 34px on a ~340px
card), and the card's own width varies with the dashboard grid (`grid-cols-1 md:grid-cols-2
lg:grid-cols-3`) — full width on mobile, ~⅓ width on desktop. So:

- The **bar itself always renders at every width** (it is proportional and never needs to wrap).
- The **under-bar label strip is container-query gated** on the card content
  (`@container` on `CardContent`): shown at `@sm` and up (~≥384px card-content width, roughly the
  1-col mobile + 2-col `md` cases), **hidden below** (`hidden @sm:flex`). Below the threshold the
  bar + score pill + jobs list carry all the meaning — nothing actionable is lost, because the
  jobs list already names every missing item in full text with its `+N%`.
- Where the strip IS shown, each short label is wrapped in `TruncatedLabel` so an overflowing name
  (e.g. `สิ่งอำนวยความสะดวก` under a 10% cell) truncates with an ellipsis + reveals the full text
  in a tooltip. Full labels live in `locales/` (not pre-abbreviated in copy).

Container queries (Tailwind v4 built-in; `Card`/`CardHeader` already use `@container/*`) are used
instead of viewport breakpoints so the strip's visibility tracks the CARD's real width, not the
viewport.

## Validation UX

No form fields on this card (read-only). The only "error surface" is the fetch-failure state →
`ErrorBanner` at the top of the card body with the verbatim `โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง`
+ a `ลองใหม่` retry (per `components/ui/form-patterns.md`: a server/fetch error → `ErrorBanner`,
not an inline field error). Unchanged from CAM-305 BR-6.

## Components & tokens

**Reused (no new primitive):** `components/ui/card.tsx` (`rounded-3xl`, `bg-card`) ·
`components/ui/badge.tsx` (`variant="muted"` score pill + `+N%` payoff; `variant="success"` 100%
affirmation — color via the **variant prop only**, never `bg-*` in className → `check:ds` R5b safe) ·
`components/ui/skeleton.tsx` (`bg-muted`, `motion-reduce:animate-none`) · `components/ui/button.tsx`
(retry `size="sm" variant="outline"` — size via prop, no inline `h-N` → `check:ds` R7 safe) ·
`components/ui/error-banner.tsx` · `components/ui/truncated-label.tsx` (overflowing segment labels) ·
`lib/hooks/use-minimum-loading.ts` · `next/link`.

**New primitive:** `components/ui/segmented-progress.tsx` (spec above).

**Icons — lucide-react only** (`DESIGN.md` §7 / `check:ds` R1 blocking; `@tabler/icons-react` was
removed, DS-5): `Check` (satisfied cell), `Minus` (missing cell), `ArrowUpRight` (job-row deep-link
cue), `CheckCircle2` (100% affirmation). The current card's `ChevronRight` is replaced by
`ArrowUpRight` to signal "leaves this card for the edit surface".

**Tokens:** `primary` (satisfied segment + satisfied-cell check) · `muted` / `muted-foreground`
(missing segment fill, secondary text, skeleton) · `border` (missing-segment edge = non-text
contrast) · `success` (100% affirmation badge) · `foreground` (labels) · `ring` (focus) ·
`card` / `card-foreground` (surface). Radius: card `rounded-3xl`, bar `rounded-full`, badge/row
`rounded-xl`. Height: bar `h-2.5`, retry `size="sm"` (`h-9`). Spacing: `p-4 md:p-6`, `gap-0.5`
(dividers), `space-y-*` per §2. **No new token** is introduced.

## a11y (WCAG 2.1 AA per DESIGN.md)

- **Color not the only signal (bar).** Satisfied vs missing is conveyed by *four* redundant
  non-color cues: (1) fill vs bordered-empty **shape** on the segment; (2) the under-bar strip's
  `Check`/`Minus` **icon** + text label + `ขาด {N}%` **word**; (3) the jobs list, which names every
  missing item in full text; (4) the bar's `role="img"` **summary**. A colorblind or grayscale user
  reads completeness without relying on hue.
- **Bar semantics.** The `SegmentedProgress` track is `role="img"` with a required `aria-label`
  (the consumer passes a concise summary, e.g. `ความครบถ้วนของข้อมูลลาน {N}%`); the individual
  segments and the decorative under-bar strip are `aria-hidden="true"` so a screen reader is not
  flooded with six segment announcements — the actionable detail is the jobs-list links.
- **Score pill** renders as plain text inside a `Badge` (read naturally by a screen reader);
  `tabular-nums` on all numbers (§4).
- **Jobs list.** Each row is a real `next/link` with an accessible name = the verbatim label
  (the `+N%` badge and `ArrowUpRight` are supplementary; the arrow is `aria-hidden`). Focus ring
  visible (`ring-ring`), keyboard-operable, logical tab order, tap target ≥44px (the row is
  `px-3 py-2` on a full-width list item — the hit area spans the row; verify ≥44px height at build).
- **Loading.** `aria-busy` on the region + `role="status" aria-live="polite"` + `กำลังโหลด…`;
  decorative skeleton shapes `aria-hidden`; shimmer off under `prefers-reduced-motion` (§Loading).
- **Contrast.** Text pairs use DESIGN.md-vetted tokens (`text-foreground`/`text-muted-foreground`
  on `bg-card` clear 4.5:1). The satisfied segment (`primary` graphic) vs card and the missing
  segment's `border-border` edge target the ≥3:1 non-text contrast (WCAG 1.4.11). **Not measured
  here (docs-only PR)** — reasoned from token values; Frontend/QA must confirm with axe + a
  contrast check at build (design gate).

## Links

`../../feature.md` · `DESIGN.md` (§2 tokens/scales · §3.1 primitive index · §5 anti-slop · §6 gate) ·
`story.md` (BR-1..8) · `.claude/rules/loading.md` (§2 skeleton-mirrors-layout · §4 client-fetch
anti-flicker · §5 a11y) · CAM-305 `story.md` (BR-2 link map, unchanged) · CAM-341 `story.md`
(BR-5 real section anchors) · `lib/listing-completeness.ts` (`LISTING_COMPLETENESS_WEIGHTS`).

## Changelog
- v1 (2026-07-04) — created. Formalizes the owner-approved chat wireframe **A** (2026-07-04) as the
  FINAL direction (G2 direction pre-approved; this doc specifies it). Adds the `SegmentedProgress`
  primitive spec (anatomy/tokens/props/motion/a11y), the container-query collapse rule for the
  under-bar labels, all 8 states incl. the layout-mirroring skeleton, and 0%/partial/100% examples.
  Deviations from the sketch, all owner-locked: filled segment uses `primary` (teal, progress) not
  `success` (reserved for the 100% affirmation); job rows render the **verbatim API label**
  (`ยังไม่ระบุนโยบายยกเลิก`) not the sketch's `ระบุนโยบายยกเลิก` (preserves CAM-305 BR-1); icons are
  lucide (`ArrowUpRight` replaces `ChevronRight`) per DESIGN.md §7 / `check:ds` R1 (tabler removed).
