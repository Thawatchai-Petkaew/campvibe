---
linear: CAM-537
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: CAMPER
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-26
---
# Design — Selected states and price text meet the contrast floor in dark mode (CAM-537)

## Flow

No screen changes. The surfaces this touches, in the order a camper meets them:

Home → tap search → the filter/search modal opens (`DialogContent` = `bg-popover`, whose value equals
`--card`) → tap a chip → **the chip fills teal**. In dark mode that fill is the state signal this story
repairs. The same token also paints the dropdown/select focus highlight (`--accent`) and every primary
button. The AI-chat card price (`--ai-price`, the owner's named example) is measured here too and is
reported unchanged, because it already clears its floor.

## How every number below was produced

`scripts/check-contrast.mjs` parses the real `app/globals.css`, converts each OKLCH declaration to
linear sRGB (Björn Ottosson's matrices), gamut-clamps in encoded space as a display would, composites
alpha tokens over their actual backdrop in gamma-encoded sRGB (what a browser does), then takes the
WCAG 2.1 relative-luminance ratio. Nothing here is eyeballed or asserted.

**Confidence check:** run against `dev` before any edit, the engine reproduces CAM-532's independently
measured figures exactly — selected fill 5.39:1 light / 2.31:1 dark, `--border` 1.25:1 light. Two
different people measuring the same pair and landing on the same number is the evidence that the
engine is right, not just self-consistent.

## Which floor governs which row (WCAG 2.1)

| kind of thing | floor | why |
|---|---|---|
| body text | **4.5:1** | SC 1.4.3 |
| large text (≥18.66px **bold**, or ≥24px) | 3:1 | SC 1.4.3 exception |
| a **fill that identifies a state**, and the boundary that identifies a control | **3:1** | SC 1.4.11 Non-text Contrast |

Two rows are easy to misjudge and are called out on purpose:

- The AI-chat price is `text-lg font-semibold` = **18px at weight 600**. WCAG's "large" needs 18.66px
  at weight **700**, so the price does **not** qualify — it is judged at **4.5:1**, not 3:1.
- A status fill (`--warning` etc.) vs the page background is **not** registered as a 1.4.11 pair. Those
  badges render as a tint with the colour as *text* (`bg-warning/2 text-warning-foreground`) and
  `DESIGN.md` forbids colour as the only signal, so the fill is not "required to identify" anything.
  What IS registered is the text on that fill. Applying the non-text floor to a decorative fill would
  manufacture a failure the standard does not ask for.

## Before / after — every measured pair

Changed values are **bold**. Light values are byte-identical before and after.

### Shipped in this PR

| token | context (surface it sits on) | floor | light before → after | dark before → after |
|---|---|---|---|---|
| `--primary` | fill vs `--card` (selected chip vs unselected chip fill, dialog surface) | 3:1 non-text | 5.39 → 5.39 ✅ | **2.31 ❌ → 3.28 ✅** |
| `--primary` | fill vs `--background` (chip on the modal body) | 3:1 non-text | 5.39 → 5.39 ✅ | **2.62 ❌ → 3.73 ✅** |
| `--accent` | fill vs `--card` (dropdown/select item focus) | 3:1 non-text | 5.39 → 5.39 ✅ | **2.31 ❌ → 3.28 ✅** |
| `--primary-foreground` | on the `--primary` fill (chip/button label) | 4.5:1 text | 5.17 → 5.17 ✅ | **7.23 → 5.08 ✅** |
| `--accent-foreground` | on the `--accent` fill | 4.5:1 text | 5.17 → 5.17 ✅ | **7.23 → 5.08 ✅** |

### Measured, already passing, deliberately NOT changed

| token | context | floor | light | dark |
|---|---|---|---|---|
| `--ai-price` | on `--card` (`AiChatCampCard`, 18px/600) | 4.5:1 text | 5.39 ✅ | 8.52 ✅ |
| `--ai-price` | on `--ai-surface` (`AiChatDetailCard`) | 4.5:1 text | 5.14 ✅ | 8.53 ✅ |
| `--foreground` | on `--card` / `--background` | 4.5:1 | 19.71 ✅ | 16.74 / 19.00 ✅ |
| `--muted-foreground` | on `--card` / `--background` | 4.5:1 | 4.61 ✅ | 7.11 / 8.07 ✅ |
| `--destructive` / `--success` / `--info` | as text on `--card` (badge + button tints) | 4.5:1 | 4.76 / 4.96 / 5.50 ✅ | 6.01 / 5.65 / 5.23 ✅ |
| `--warning-foreground` / `--success-foreground` / `--info-foreground` | on their own fills | 4.5:1 | 9.19 / 4.76 / 5.28 ✅ | 13.63 / 6.42 / 5.94 ✅ |
| `--ring` | vs `--background` / `--card` | 3:1 non-text | 2.44 ❌ (deferred) | 4.27 / 3.76 ✅ |

**The owner's example, answered directly:** `--ai-price` passes on both surfaces in both themes, by a
wide margin in dark (8.5:1). CAM-444 already fixed it. It needed measuring to know that, and it is now
pinned by the guard so it cannot quietly regress — but it needs no retune.

### Measured failures deliberately handed back instead of shipped

| token | context | floor | light | dark | why not fixed here |
|---|---|---|---|---|---|
| `--border` | vs `--background` / `--card` | 3:1 | 1.25 ❌ / 1.25 ❌ | 1.26 ❌ / 1.34 ❌ | clearing 3:1 needs `L 0.925 → ~0.669`: every divider and card outline becomes a mid-grey line, contradicting the §1 POV |
| `--input` | vs `--background` | 3:1 | 1.25 ❌ | 1.48 ❌ | same repaint; scoping it to control boundaries only is a real option but still a visible chrome change |
| `--ai-tint` | vs `--card` (AI card border) | 3:1 | 1.10 ❌ | 1.31 ❌ | same class; belongs with the border decision, not split from it |
| `--ring` | vs `--background` | 3:1 | 2.44 ❌ | ✅ | the visible indicator is composed in components (`ring-ring/30`, `ring-ring/50`); the token alone does not determine it, and components are out of this story's surface |
| `--primary` as **text** | on `--card` | 4.5:1 | 5.39 ✅ | 2.31 → 3.28, still ❌ | impossible with one token (below) |

**The one-token impossibility, proven numerically.** For dark `--primary` to clear 4.5:1 as *text* on
`--card` it needs **L ≥ ~0.594**; for a near-white label to clear 4.5:1 *on the fill* it needs
**L ≤ ~0.549**. The windows do not intersect, so no single value satisfies both. A `text-primary` link
in dark mode therefore needs its own brighter token — which is precisely what CAM-444 concluded when it
created `--ai-price` rather than brightening `--primary`. This story moves that pair from 2.31 to 3.28
(a real improvement) and records the structural gap; it does not pretend to have closed it.

## Alternatives considered

- **Darken `--card` instead of brightening `--primary`.** Rejected: it repaints every surface in dark
  mode to fix one fill, and it would drag `--muted-foreground` and every other on-card pair with it.
- **Brighten to the window's edge (L 0.549) for maximum fill separation.** Rejected: it leaves the
  white label at 4.53:1, one rounding step above the floor. L 0.520 keeps headroom on both sides.
- **Change hue/chroma to gain contrast more cheaply.** Rejected outright — the brand must still read as
  itself, so only lightness moves (`.claude` dispatch hard rule 3).

## Non-goals

No component file is edited. If a component hardcodes a colour instead of consuming a token, this story
reports it rather than restyling it. No new token is introduced; no copy string changes.

## States (8)

The chip's eight states are owned by `components/ui/filter-chip.tsx` and were specified in CAM-532's
`design.md`; this story changes **no state's treatment**, only the measured contrast of the two that
depend on `--primary`:

| state | treatment (unchanged) | what this story changes |
|---|---|---|
| default (unselected) | `border-border bg-card text-foreground` | nothing |
| hover (unselected) | `hover:border-foreground` | nothing |
| **selected** | `border-primary bg-primary text-primary-foreground` | fill 2.31 → **3.28:1** vs the surface (dark) |
| **hover (selected)** | `hover:bg-primary/85` | tracks the new fill; stays perceptibly darker than the resting fill |
| focus | `focus-visible:ring-2 ring-ring ring-offset-2` | nothing — `--ring` is unchanged (its light-mode gap is deferred above) |
| active | `active:scale-95` | nothing |
| disabled | `opacity-50 pointer-events-none` | nothing |
| loading / empty / error | N/A for a chip — selection is local state with no async dependency; CAM-532 recorded the reasons | nothing |

## Validation UX

No `BR-n` in `story.md` produces a user-facing error: this story writes no data and submits no form, so
there is no inline error or `ErrorBanner` surface. The only failure path is a build-time one — a token
below its floor — and it is surfaced to a developer through `check:contrast`, never to a camper.

## Components & tokens

- Components: **none touched.** The surfaces that consume these tokens (`components/ui/filter-chip.tsx`,
  `components/ui/button.tsx`, `components/ui/select.tsx`, `components/ui/dropdown-menu.tsx`,
  `components/ai-chat/AiChatCampCard.tsx`, `components/ai-chat/AiChatDetailCard.tsx`) are read-only
  context for the measurement.
- Tokens changed (dark only, lightness only): `--primary` and `--accent`,
  `oklch(0.437 0.078 188.216)` → `oklch(0.520 0.078 188.216)`.
- Tokens deliberately left alone: the `--ai-glow` and `--ai-gradient` dark stops still embed the deeper
  `oklch(0.437 …)` literal. That is **not** stale drift — those layers sit *behind* content as depth,
  and a shadow that matches the surface it lifts stops reading as a shadow. A comment in
  `app/globals.css` records this so a later reader does not "sync" them.
- `--ai-price` stays a separate token. Its CAM-444 rationale survives this change: dark `--primary` as
  text on `--card` is now 3.28:1, still under the 4.5:1 body-text floor, so the price still cannot be
  `text-primary`.

## a11y

- **Contrast:** every number in this file is measured by `scripts/check-contrast.mjs` against the real
  `app/globals.css`, both themes, each row judged against the floor named in the table above.
- **Colour is not the only signal:** unchanged and still true — `FilterChip` sets `aria-pressed` on
  every chip, so selection is exposed to assistive tech regardless of the fill.
- **Focus ring:** unchanged (`ring-ring ring-offset-2`, never suppressed). Its light-mode gap is
  recorded above as deferred, with the reason it cannot be closed from the token layer alone.
- **Tap target:** unchanged, `h-11` + `min-w-[44px]` = 44px.
- **Not measured:** no axe run and no browser screenshot were taken for this story — it changes no
  markup, and the property it does change is verified numerically instead. Stated rather than implied.

## Guard — mode and measured backlog

`scripts/check-contrast.mjs` is a **new** script rather than an extension of `check-palette.mjs`. The
two do unrelated jobs: `check-palette` is a lexical scanner over ~200 source files looking for forbidden
hardcoded-colour strings; this is a numeric check over exactly one file whose unit is a
(foreground, background, floor) triple and which needs ~60 lines of colour-space maths. Fusing them
would give one script two inputs, two failure vocabularies, and one confusing exit code.

Rollout follows `.claude/rules/ops.md` — report-mode → backlog 0 → blocking:

| set | count | mode | meaning |
|---|---|---|---|
| ENFORCED | 30 pairs (15 contexts × 2 themes) | **blocking** (exit 1) | backlog measured **0** after the fix — the flip condition is met and proven inside this PR |
| DEFERRED | 10 pairs | **report only** (exit 0, printed loudly) | the failures handed back above; each carries a written reason and a `DESIGN.md` §8 pointer |

Both directions are proven in `__tests__/cam-537-contrast-floor.test.ts`: the guard **fires** (exit 1,
naming the pair) when a token is set to a deliberately-bad value, and is **quiet** (exit 0) on the real
tree. A guard only proven in one direction can be silently toothless — the CAM-532 R9 lesson.

## Anti-slop criteria that must pass

- Only lightness moved; hue and chroma are untouched, so the teal is the same teal (`DESIGN.md` §1).
- No new token invented to dodge the floor; no `dark:` override hand-written in a component.
- Light mode is byte-identical — a contrast fix must not become a redesign.
- Every ratio in this document came out of a program that was run.

## Links

`../../feature.md` · `DESIGN.md` (§2 token table, §8 item 11) · `story.md` (BR-1..BR-5) ·
`../CAM-532-chip-standardization/design.md` (the measurement that surfaced this)

## Changelog
- v1 (2026-07-26) — created
