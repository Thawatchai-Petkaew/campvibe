## Story
As a **Camper** browsing in dark mode, I want a chip I have switched on to be clearly distinguishable
from one I have not, so that I can tell at a glance which filters are active instead of guessing from a
teal that reads as another dark rectangle.
Why: CAM-532 measured the selected chip's fill at **2.31:1** against the surface behind it in dark mode,
under the **3:1** floor WCAG 2.1 SC 1.4.11 sets for non-text state information. It was logged to the
`DESIGN.md` §8 backlog rather than fixed inside a single-component story, because the fix is a token
change that touches the whole app and is therefore an owner-visible decision.

Scope: token VALUES in `app/globals.css` (+ the `DESIGN.md` record) and a numeric guard that keeps them
above their floor. No component file is touched, no new token is introduced, no copy changes.
Depends on: CAM-532 (measured the defect, wrote §8 backlog item 11)

## AC
<!-- No AC row carries Thai copy: this story changes token VALUES only. Every string on these surfaces
     is unchanged and still served from `locales/`. The "user sees" column therefore describes the
     visual result, which is what the contrast floor governs. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Dark mode, the filter modal is open with no chip selected | Camper taps one chip | That chip's teal fill separates from the unselected chips beside it and from the modal surface: **3.28:1** against `--card`, **3.73:1** against `--background` (was 2.31 / 2.62) | `--primary` dark = `oklch(0.520 0.078 188.216)`; no data written | EC-1 |
| AC-2 | Dark mode, a chip is selected | Camper reads the chip's label | The label stays legible on the brighter fill: **5.08:1** (was 7.23:1, still ≥ 4.5:1) | none | EC-2 |
| AC-3 | Dark mode, a dropdown or select menu is open | Camper moves focus onto an item | The highlighted item's fill separates from the panel: **3.28:1** (was 2.31:1) | `--accent` stays identical to `--primary` | EC-2 |
| AC-4 | Light mode, any of the surfaces above | Camper views the screen | Nothing changes: every light value is byte-identical to before | no light token edited | AC-1 |
| AC-5 | Either theme, the AI chat card is on screen | Camper reads the price | The price stays legible: **5.39:1** light / **8.52:1** dark on `--card` and **5.14:1** / **8.53:1** on `--ai-surface` | `--ai-price` unchanged (already clears its floor) | — (measured pass, so there is no failure twin to write; the guard pins it) |
| AC-6 | A developer lowers a guarded token below its floor | The quality gate runs | `npm run check:contrast` exits 1 and names the pair, both themes, with the measured ratio | CI blocks the merge | EC-1 |

## Rules
- BR-1 **Which floor applies to which row.** Body text = **4.5:1**; large text (≥18.66px **bold** or ≥24px) = 3:1; non-text UI state + the boundary that identifies a control = **3:1** (WCAG 2.1 SC 1.4.11). A fill is never judged against the text floor and body copy is never judged against the non-text floor. The AI-chat price is `text-lg font-semibold` = 18px/600, which is **not** WCAG "large text" (that needs 18.66px at weight 700), so it is judged at **4.5:1**.
- BR-2 **Dark `--primary` = `oklch(0.520 0.078 188.216)`.** Lightness only: chroma `0.078` and hue `188.216` are unchanged, so the brand teal stays the same colour family. The measured feasible window is **L ∈ [0.499, 0.549]** — below 0.499 the fill drops under 3:1 on `--card`, above 0.549 the near-white label drops under 4.5:1 on the fill. `0.520` sits mid-window (headroom 3.28 vs 3.0 and 5.08 vs 4.5) so neither floor is one rounding step from failing.
- BR-3 **`--accent` tracks `--primary` exactly.** `DESIGN.md` §2 declares `accent = primary` ("single tone with primary"). Changing one and not the other would both falsify that table row and leave the dropdown/select focus fill at 2.31:1.
- BR-4 **Guard rollout per `.claude/rules/ops.md`:** the ENFORCED pair set ships blocking only because its measured backlog is **0**; every pair that still fails is listed in a separate DEFERRED set that the guard prints loudly and does not block on. A pair may never move to DEFERRED silently — each carries a written reason and a `DESIGN.md` §8 pointer.
- BR-5 **A ratio in a spec, PR, or doc must come from code that was run.** No asserted or eyeballed number (`.claude/rules/performance.md` metric honesty, applied to a11y).

## Edge cases
- EC-1 IF a guarded pair measures below its floor in EITHER theme THEN `check:contrast` exits 1, printing token, context, theme, measured ratio, and floor (BR-4)
- EC-2 IF raising `--primary` would push the near-white label below 4.5:1 on the fill THEN the value is out of the BR-2 window and is rejected — the label pair is guarded in the same run, so the two floors cannot be traded off against each other (BR-2)
- EC-3 IF a token is declared with alpha (`--border` dark = `oklch(1 0 0 / 10%)`) THEN it is composited over its actual backdrop in gamma-encoded sRGB before measuring, never measured as if opaque (BR-5)
- EC-4 IF `globals.css` declares a selector in more than one block (`:root` appears three times, one nested inside `@media`) THEN the parser merges every block in source order; reading only the first block yields no tokens at all (BR-5)
- EC-5 IF a token is defined in `:root` but not in `.dark` THEN dark inherits the `:root` value and is measured with it, rather than being skipped (BR-5)
- EC-6 IF an OKLCH value falls outside the sRGB gamut THEN it is clamped in encoded space before the luminance is taken, matching what a display actually shows (BR-5)

## Data
- No entity, field, or row is touched. This story edits two CSS custom-property values. · migration: none

## Seams & refs
- Reuse: `app/globals.css` is the single declaration site for every token value (`DESIGN.md` frontmatter names it authoritative), so there is no parallel colour definition to keep in step. Grep inventory of readers of dark `--primary`: `bg-primary` fills, `text-primary`, `border-primary`, `ring-primary`, and the `--ai-glow` / `--ai-gradient` shadow stops that embed the old literal — the shadow stops are deliberately NO-CHANGE (a shadow beneath content must stay deeper than the surface it sits on; see `design.md`).
- Refs: CAM-532 `design.md` (the measurement that surfaced this) · `DESIGN.md` §8 item 11 · WCAG 2.1 SC 1.4.11

## Out of scope
- `--border` (1.25:1 light / 1.26:1 dark), `--input` (1.25 / 1.48), `--ai-tint` (1.10 / 1.31) — clearing 3:1 needs `--border` at roughly `L 0.669` (from `0.925`), i.e. every divider and card outline in the app becomes a mid-grey line. That contradicts the `DESIGN.md` §1 POV ("chrome is light, hierarchy through spacing + typography, not heavy lines"), so it is a look change the owner has not asked for → measured options handed back, not shipped.
- `--ring` light (2.44:1) — a real 1.4.11 failure, but the indicator users actually see is composed in the components (`focus-visible:ring-ring/30` on Button, `ring-ring/50` on Badge), so the token alone does not determine it. Fixing it correctly requires editing component alpha, which this story's file surface forbids.
- `text-primary` as body text in dark mode (2.31 → 3.28:1, floor 4.5:1) — **provably unsolvable with one token**: text-on-card needs L ≥ ~0.594 while a near-white label on the fill needs L ≤ ~0.549. It needs a second token, exactly as CAM-444 already did for the price with `--ai-price`.
- All three → follow-up ticket to be opened by the orchestrator; recorded in `DESIGN.md` §8 item 11.

## Self-verify
- AC-1..AC-5 → unit (`__tests__/cam-537-contrast-floor.test.ts` parses the real `app/globals.css` and recomputes every ratio; no expected number is hardcoded)
- AC-6 → unit, both directions: a deliberately-bad token value must make the guard exit 1, and the real tree must make it exit 0
- Story-specific: both themes checked for every touched token · light values proven byte-identical · `--accent` proven equal to `--primary`
- Gate = /quality-gate · Done = every AC verified on the real Staging URL

## Changelog
- v1 (2026-07-26) — created
