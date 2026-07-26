---
linear: CAM-539
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: CAMPER
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-26
---
# Design — Image placeholder reads as an empty slot, not a broken image (CAM-539)

## Flow
There is no screen flow to draw: this is a single state of a single primitive. A camper lands on any
surface that shows a photo (camp card in the catalog, detail hero, album, host `LogoUpload`); when that
photo is absent or fails, `ImageWithFallback` swaps the `<Image>` for a glyph inside the same reserved
grey frame. The camper's job at that moment is to correctly read "this camp has no photo yet" and keep
browsing. Today they read "this page is broken", which is a different and much more expensive message.

## The defect, measured
Two independent faults compound in one element:

**1. The glyph is an error mark, not an empty mark.** lucide `ImageOff` is not "a picture, absent" — it is
"a picture, failed". Read from the lucide source rather than judged by eye:

| | node count | frame | crossing strokes |
|---|---|---|---|
| `ImageOff` (before) | 6 | **split into two disjoint arcs** to clear the slash | a full-canvas `line` (2,2)→(22,22) crossing the frame arcs AND the mountain line (13.5,13.5)→(6,21) |
| `Image` (after) | 3 | **one closed `rect`**, rx 2 | none — the `circle` sits fully inside, the mountain `path` never meets the diagonal |

The frame in `ImageOff` is *deliberately broken* so the slash has room. That is the owner's report exactly:
"เส้นที่ทับกันจะดูพัง" — the crossing strokes look broken. They look broken because the icon is drawn broken.

**2. The colour was below the accessibility floor.** `text-muted-foreground/40` on `bg-muted`, recomputed
from the real `app/globals.css` using the maths CAM-537 exported from `scripts/check-contrast.mjs`:

| state | light | dark | floor (SC 1.4.11 non-text) | verdict |
|---|---|---|---|---|
| before — `text-muted-foreground/40` | **1.63:1** | **2.15:1** | 3:1 | ✗ fails both themes |
| after — `text-muted-foreground` | **4.15:1** | **6.05:1** | 3:1 | ✓ passes both, 1.38× / 2.02× margin |

So "ลด Gray scell" was not only an aesthetic request. The placeholder was a real WCAG 2.1 SC 1.4.11
failure in both themes, and the `/40` alpha was the cause of it.

## Non-goals
Not a redesign of the empty slot. The frame keeps `bg-muted`, the glyph keeps `w-8 h-8` (32px), the layout,
the fade/LCP path and the a11y wiring are untouched. The owner reported a glyph that reads as broken, and
the fix is scoped to the glyph's identity and its colour — nothing else.

## Alternatives considered
- **A camping-specific mark (`Tent`, `Mountain`).** Rejected: this one primitive also backs `LogoUpload`,
  where a tent glyph in the host's logo slot would be actively wrong. A subject mark also reads as *content*
  ("a tent photo") rather than as *absence*. The universal picture glyph is the honest one across all four
  call sites.
- **`ImagePlus`.** Rejected: the plus reads as an affordance ("add a photo"), but three of the four call
  sites are read-only camper surfaces where nothing can be added. Promising an action that is not there is
  worse than the current problem.
- **`--primary` (teal) for the glyph.** Rejected on measurement, not taste: **2.79:1 in dark mode**, below
  the 3:1 floor — it would have swapped one contrast failure for another. `DESIGN.md` §2 independently warns
  against `text-primary` in dark. Teal would also give an empty slot brand emphasis it has not earned.
- **`--foreground`.** Rejected: 17.72:1 light / 14.25:1 dark. A near-black glyph in every empty card would
  shout louder than the real photos beside it and invert the page's hierarchy. The empty state should be
  legible, not loud.
- **A new dedicated token.** Rejected per BR-4: `muted-foreground` is already the role `DESIGN.md` §2 assigns
  to "placeholder", and it clears the floor. A new token would be unjustified surface, and `app/globals.css`
  needs no edit at all — which also keeps this story clear of the file another agent is working near.

## States (8)
This primitive is not interactive: it renders no control, takes no focus, and has no disabled or loading
concept of its own (the loading affordance is the parent's skeleton plus the CAM-393 opacity fade). The
honest state table is therefore per-state, with the inapplicable ones named as such rather than invented.

| state | treatment |
|---|---|
| default (photo present) | `<Image>` fades 0→100 over the reserved `bg-muted` frame. Unchanged by this story. |
| **empty (no `src`)** | **this story** — `ImageIcon` `w-8 h-8` `text-muted-foreground` centred in the `bg-muted` frame |
| **error (`src` failed)** | **this story** — deliberately identical to empty; to a camper both mean "no photo here", and a distinct error mark is what caused this defect |
| loading | the frame is reserved instantly and the photo fades in (CAM-393); a `priority` hero renders opaque immediately to protect LCP. Unchanged. |
| hover / focus / active / disabled | N/A — the element is a `div` + glyph with no interactive role. Where a caller makes the wrapper clickable, the caller owns those states, as it does today. |

## Validation UX
N/A — this component takes no user input and surfaces no validation. `story.md` carries no `BR-n` that
produces a user-facing message, and no copy string is added or changed, so nothing enters `locales/`.

## Components & tokens
- **Component:** `components/ui/image-with-fallback.tsx` — reused, not rebuilt. It is the single fallback
  site for the camp card, the detail hero, the album and `LogoUpload`, so no caller is patched.
- **Icon:** lucide `ImageIcon` (the library's own alias for `Image`), imported under the alias to avoid the
  `Image` already imported from `next/image` in the same file. lucide-only per `DESIGN.md` §7 / DS-5 —
  `@tabler/icons-react` has been removed from the codebase, so tabler was not an option here.
- **Tokens:** `muted` (frame, unchanged) · `muted-foreground` (glyph, now at full opacity). **No new token;
  `app/globals.css` is not edited.**
- **Scale:** `w-8 h-8` (32px) unchanged — the size was never the complaint.

## a11y
- **Contrast:** 4.15:1 light / 6.05:1 dark against `bg-muted`, both clearing the 3:1 non-text floor
  (WCAG 2.1 SC 1.4.11). Computed, not estimated — recomputed at test time from the real `app/globals.css`.
- **Accessible name:** unchanged. The wrapper keeps `role="img"` + `aria-label={alt}` when the caller passes
  `alt`; the glyph keeps `aria-hidden="true"` so the slot announces once, not twice.
- **Decorative case:** unchanged — no `alt` means the wrapper stays `aria-hidden="true"` with no `role`.
- **Colour-not-only:** the information is carried by the glyph's shape, not by its colour; the contrast fix
  makes that shape legible rather than making colour load-bearing.
- **Tap target:** N/A — not interactive. Where a caller makes the wrapper clickable, the caller sets the size.
- **Reduced motion:** unaffected; the fallback branch has no animation.

## Design-gate note (§6)
Token-only ✓ (no hex/px added, no `app/globals.css` change) · component-in-system ✓ (existing primitive,
lucide-only) · scale matches role ✓ (unchanged) · states ✓ (table above, empty + error are the subject) ·
a11y AA ✓ (measured, both themes, `check:contrast` green) · i18n ✓ (no copy touched) · motion ✓ (untouched) ·
anti-slop ✓ (removes a broken-looking mark; no gradient, no shadow, no new chrome) · test-id ✓
(`--fallback-placeholder` preserved).

## Links
`../../feature.md` · `DESIGN.md` §2 / §5 / §6 / §7 · `story.md` (BR-1..BR-5) · `.claude/rules/ux.md` ·
CAM-537 `scripts/check-contrast.mjs`

## Changelog
- v1 (2026-07-26) — created
