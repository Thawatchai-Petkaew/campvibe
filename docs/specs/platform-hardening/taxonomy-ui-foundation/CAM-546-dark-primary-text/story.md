## Story
As a **Camper** browsing in dark mode, I want teal-coloured words (links, prices, the active menu item,
today's date) to be readable against the dark page, so that I can read them instead of straining at a
teal that sinks into the background.
Why: with dark as the default theme (CAM-544), axe reports a **serious** `color-contrast` violation on
`/preview` — `#257771` on `#090b0c` = **3.71:1** against the **4.5:1** floor for normal text. `#257771`
is dark `--primary`. The defect is pre-existing; making dark the default merely caused axe to evaluate
the dark palette for the first time. **CAM-544 (PR #628) is built and otherwise green and is held only
by this defect.**

Scope: one NEW token for primary-coloured TEXT (both themes) in `app/globals.css`, the `DESIGN.md`
record, migrating the real text call sites onto it, and extending `scripts/check-contrast.mjs` so the
new pair is enforced. `--primary` itself is NOT touched — CAM-537 tuned it deliberately and its fills
currently pass.
Depends on: CAM-537 (measured this exact pair, proved one token cannot fix it, deferred it) · CAM-444
(set the precedent: a separate brighter token for TEXT rather than bending the fill colour)

## AC
<!-- No AC row carries Thai copy: this story changes a token VALUE and the class that reads it. Every
     string on these surfaces is unchanged and still served from `locales/`. The "user sees" column
     therefore describes the visual result, which is what the contrast floor governs. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Dark mode, `/preview` is open | Camper reads the link-variant button | The word separates from the page: **9.68:1** against `--background` (was 3.73:1) | `--primary-ink` dark = `oklch(0.760 0.120 184)`; no data written | EC-1 |
| AC-2 | Dark mode, a dashboard or booking card is on screen | Camper reads a teal price, link, or label on the card | The words separate from the card: **8.52:1** against `--card` (was 3.28:1) | none | EC-1 |
| AC-3 | Dark mode, the operator dashboard is open | Camper reads the active menu item's label, or a guest's initial in an avatar | The words separate from the teal tint behind them: **7.81:1** on a 10%-primary tint over `--card` (was 3.01:1, the worst measured surface) | none | EC-2 |
| AC-4 | Light mode, every surface above | Camper views the screen | Nothing changes: the light value of the new token is byte-identical to light `--primary`, which already measured **5.39:1** on `--card` | no light appearance change | AC-1 |
| AC-5 | Either theme, a teal ICON (not a word) sits on a surface | Camper looks at the icon | Unchanged: icons keep `--primary` and stay above their own **3:1** non-text floor (3.01:1 worst case, dark) | `--primary` unedited | EC-3 |
| AC-6 | Either theme, a chip is selected or a primary button is on screen | Camper looks at the fill and its label | Unchanged from CAM-537: fill **3.28:1** on `--card` / **3.73:1** on `--background`, label **5.08:1** on the fill (dark) | `--primary` and `--primary-foreground` unedited | EC-4 |
| AC-7 | A developer points a migrated call site back at `--primary`, or lowers `--primary-ink` below its floor | The quality gate runs | `npm run check:contrast` exits 1 and names the pair, both themes, with the measured ratio | CI blocks the merge | EC-1 |

## Rules
- BR-1 **Which floor applies to which row.** Body text = **4.5:1** (SC 1.4.3); large text (≥18.66px **bold** or ≥24px) = 3:1 (SC 1.4.3 exception); a non-text graphic that conveys meaning, and a fill that identifies a state = **3:1** (SC 1.4.11). A word is never judged at the non-text floor, and an icon is never judged at the text floor.
- BR-2 **`--primary-ink` is for WORDS; `--primary` stays for fills, borders, rings, and icons.** This is the role split that makes the two-token system enforceable: a reviewer can decide which token applies by asking "is this thing made of letters?".
- BR-3 **`--primary-ink` = `oklch(0.511 0.096 186.391)` light / `oklch(0.760 0.120 184)` dark.** The light value is byte-identical to light `--primary` (which already clears 4.5:1 everywhere it is used), so light mode does not change at all. The dark value is byte-identical to dark `--ai-price`: CampVibe already ships exactly one bright teal for dark-mode text, and inventing a second, nearly-identical teal would itself be drift. Measured minimum across every real surface: **4.68:1** (light, on a 10%-primary tint) and **7.81:1** (dark, same surface).
- BR-4 **`--primary` is not edited.** Its window is `L ∈ [0.499, 0.549]` (CAM-537, re-derived here at [0.499, 0.548]); raising it to clear the text floor would need `L ≥ 0.596` and would drop the near-white label on the fill below 4.5:1. The two requirements are disjoint, which is why a second token exists at all.
- BR-5 **An alpha modifier on body text is not allowed to be the thing that fails the floor.** `text-primary/80` measured **2.56:1** dark and **3.70:1** light — it fails in BOTH themes, so swapping the token alone would not fix it. The alpha is dropped, not re-tinted.
- BR-6 **Guard rollout per `.claude/rules/ops.md`:** report-mode → backlog 0 → blocking. The new pairs join the ENFORCED set only because their measured backlog is 0 in the same PR, proven in both directions (fires on a bad value, quiet on the fixed tree).
- BR-7 **A ratio in a spec, PR, or doc must come from code that was run** (`.claude/rules/performance.md` metric honesty, applied to a11y).

## Edge cases
- EC-1 IF a guarded pair measures below its floor in EITHER theme THEN `check:contrast` exits 1, printing token, context, theme, measured ratio, and floor (BR-6)
- EC-2 IF teal text sits on a `bg-primary/10` or `bg-primary/5` tint rather than a bare surface THEN the tint is composited over its real backdrop before measuring — the tint lightens the surface and is the WORST case, not an equivalent one (3.01:1 vs 3.28:1 on bare `--card`) (BR-1)
- EC-3 IF a teal element is an icon rather than a word THEN it keeps `--primary` and is judged at 3:1; migrating it would be churn AND would make icon chips change weight (BR-2)
- EC-4 IF an icon sits INSIDE the same control as migrated text and inherits its colour THEN it moves with the text, because one control must not render two different teals (BR-2)
- EC-5 IF a `text-primary` call site is a hover-only state (`hover:text-primary`) on a word THEN it is migrated too — a hover state is still text a camper reads (BR-2)
- EC-6 IF the new token were declared only in `.dark` THEN light would silently inherit the `:root` value and go unmeasured; it is declared in BOTH blocks (BR-3)

## Data
- No entity, field, or row is touched. This story adds one CSS custom property and changes a class name at the call sites that read it. · migration: none

## Seams & refs
- Reuse: `app/globals.css` is the single declaration site for every token value, and `@theme inline` is the single place a token becomes a Tailwind utility — so `--primary-ink` needs a `--color-primary-ink` entry there or `text-primary-ink` silently emits nothing. Grep inventory of `text-primary` (47 occurrences, 29 files) tagged NOW (text → migrate) / NO-CHANGE (icon, border, fill) in `design.md`; both lists are written out in full so a later reader can audit the judgement rather than trust it.
- Refs: CAM-537 `story.md` + `design.md` (the deferral this closes) · CAM-444 (`--ai-price`, the precedent) · `DESIGN.md` §2 + §8 item 11 · WCAG 2.1 SC 1.4.3 / 1.4.11

## Out of scope
- `--border` (1.25 light / 1.26 dark), `--input`, `--ai-tint`, `--ring` light — CAM-537's other deferrals. Unrelated to text contrast; each is an owner-visible chrome repaint. They stay in the DEFERRED set and stay loud.
- Consolidating `--ai-price` into `--primary-ink` (they now hold identical values in both themes). `__tests__/cam-444-dark-price-contrast.test.ts` pins `--ai-price:\s*oklch\(` as a literal in both blocks, so aliasing it would break a test outside this story's file surface → follow-up ticket.
- The `💡` emoji in `components/ui/permission-tooltip.tsx` (standing rule: no emoji in UI, use an icon). Noticed while migrating that line; fixing it means adding an icon import, which is a different change → follow-up ticket.

## Self-verify
- AC-1..AC-6 → unit (`__tests__/cam-546-dark-primary-text.test.ts` parses the real `app/globals.css` and recomputes every ratio; no expected ratio is hardcoded)
- AC-7 → unit, both directions: a deliberately-bad token value must make the guard exit 1, and the real tree must make it exit 0
- Story-specific: `--primary`'s CAM-537 fill ratios asserted UNCHANGED · light values proven byte-identical to light `--primary` · every migrated call site proven to no longer read `text-primary` · axe re-run on `/preview` in dark
- Gate = /quality-gate · Done = every AC verified on the real Staging URL

## Changelog
- v1 (2026-07-26) — created
