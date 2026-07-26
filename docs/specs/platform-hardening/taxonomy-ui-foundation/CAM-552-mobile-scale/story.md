---
linear: CAM-552
feature: Platform hardening
epic: Taxonomy UI foundation
persona: CAMPER
artifact: story
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-26
---

## Story
As a **Camper**, I want every screen to shrink its controls, spacing and type when I open it on a phone, so that I see more of the actual camp content per screen instead of a desktop layout squeezed into 390px.

Why: the rule never existed. `DESIGN.md` carried responsive pairs for three properties only (card padding, modal padding, gutter), the height scale `sm h-9 · md h-11 · lg h-12` had no breakpoint variant at all, and no typography token changed by breakpoint. Owner reported it after testing on a phone (2026-07-26).

Scope: write the mobile scale + breakpoint typography roles into `DESIGN.md` + `app/globals.css`; apply them to the shared primitives and the three reported surfaces; guard them; show them on `/preview`.
Depends on: CAM-542 (absorbed — see `## Out of scope`)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper is on a viewport narrower than 768px | They open the filter modal | Section titles render one step smaller than on desktop and the modal's inner padding is 16px instead of 24px, so more chips fit per screen | Type roles resolve to their mobile values; `p-4` applies below the `md` breakpoint | EC-1 |
| AC-2 | A camper is on a viewport narrower than 768px | They look at any tappable control | Every control they can tap is still at least 44px tall and 44px wide | No control class in the scale resolves below 44px on mobile | EC-2 |
| AC-3 | A camper is on a viewport narrower than 768px | They open the search modal | The date buttons and the province/guests pickers are the same height as each other | `lg` resolves to 44px below 768px; the date buttons use the default size | EC-3 |
| AC-4 | A developer adds a control sized only for desktop | They run the design-system guard | The guard names the file, the line and the fix | `check:ds` exits 1 for a blocking-scope finding; report-scope findings print with a backlog count | EC-4 |
| AC-5 | A developer wants to see the mobile rule | They open `/preview` | A "Mobile scale" section shows the type roles and the control heights at both steps | `/preview` renders the mobile view; `DESIGN.md` §8's "mobile view" backlog item is closed | — |

## Rules
- BR-1 There is exactly **one** sizing breakpoint: `md` = **768px**. Mobile-first — the bare utility carries the mobile value, `md:` carries the desktop step. No `sm:` / `lg:` / `xl:` variant may be used for size, height, padding, gap or type. (proves AC-1)
- BR-2 **Touch floor = 44×44 CSS px at every viewport.** `h-11` = 44px IS the floor and therefore never steps down. Compaction on mobile comes from horizontal padding, gaps, section rhythm, non-control block heights, and type — never from a tap target. (proves AC-2)
- BR-3 Control height: `sm` = `h-9` both steps (non-tappable / inside a ≥44px hit area only) · `md` = `h-11` both steps (at the floor) · `lg` = `h-11 md:h-12` (the ONE height that steps) · icon button = `size-11` both steps. (proves AC-2, AC-3)
- BR-4 Seven type roles, four of which step at 768px: `text-display` 30→36 · `text-heading-1` 24→30 · `text-heading-2` 20→24 · `text-heading-3` 16→18. Three do NOT step, on purpose: `text-body` 16px (below 16px iOS Safari auto-zooms a focused input, and 16px is the body-copy floor), `text-label` 14px, `text-caption` 12px. (proves AC-1)
- BR-5 Within one control row, every control uses the same height role. A `lg` control may not sit beside an `md` control. (proves AC-3)
- BR-6 Guard rollout follows `.claude/rules/ops.md`: a rule ships **blocking** only where this PR clears its backlog to 0; everywhere else it ships **report-mode** with the backlog counted and its owner named. (proves AC-4)

## Edge cases
- EC-1 IF a component sets a raw `text-2xl`..`text-6xl` with no `md:` twin THEN the guard reports it as non-responsive display type and points at the `text-heading-*` role (BR-4)
- EC-2 IF someone writes a mobile step that lands under the floor (`h-9 md:h-12`, `h-10 md:h-11`) THEN the guard blocks repo-wide — this rule has a 0 backlog by construction and can never be "cleared later" (BR-2)
- EC-3 IF a `lg` control sits in a row with `md` controls THEN it is changed to `md`, not the row to `lg` — the smaller consistent height wins (BR-5)
- EC-4 IF a blocking-scope file gains a bare `h-12` control height THEN `check:ds` exits 1 naming the file, the line and `h-11 md:h-12` as the fix (BR-6)
- EC-5 IF a primitive's sizing is pinned char-for-char by a test outside this story's file surface THEN it is NOT migrated; it goes to the report backlog with the pinning test named (STOP RULE 3)

## Data
- None. Presentation layer only · migration: none.

## Seams & refs
- Reuse: `app/globals.css` (`--type-*` custom properties + the role utilities) is the single declaration of every type role; `components/ui/button.tsx` + `components/ui/input.tsx` cva `size`/`inputSize` are the single declaration of control height. No consumer re-declares either.
- Refs: `DESIGN.md` §2 "Responsive scale" (authored by this story) · `.claude/rules/ops.md` (guard rollout) · CAM-532 (`FilterChip` is the only file that styles a chip)

## Out of scope
- **CAM-542 is absorbed by this story, not duplicated.** Its two halves are settled here: (a) ONE height step per control row — the SearchModal date buttons drop from `lg` to the default size so they match the province/guests pickers (BR-5); (b) ONE horizontal padding scale by role — chip `px-4 md:px-5`, button/input `px-4`, leading-icon inset `pl-10 md:pl-12`. CAM-542 should be closed as absorbed.
- Touch-floor violations in surfaces this story may not edit: `components/CampgroundCard.tsx` carousel arrows (28×28px, measured), `components/Navbar.tsx` language switcher (36px) and profile menu (42px) → follow-up ticket; the card is owned by CAM-541/547/550.
- `components/ui/option-group-section.tsx` heading (`text-2xl`, non-responsive) → its className is pinned char-for-char by `__tests__/cam-528-detail-taxonomy.test.ts:140`, which is outside this story's file surface. Left in the report backlog.
- Migrating every `app/**` page heading to the type roles → report backlog, follow-up.

## Self-verify
- AC-1..3 → measured in a real browser at 390×844 via Playwright, before and after (pixel heights, not classNames)
- AC-4 → `__tests__/cam-552-mobile-scale.test.ts` proves the guard in BOTH directions (fires on a synthetic violation, silent on the fixed tree)
- AC-5 → `/preview` rendered and screenshotted at 390px
- Story-specific: touch-floor sweep over every interactive element confirms nothing this story changed fell below 44px
- Gate = /quality-gate · Done = every AC verified on the real Staging URL

## Changelog
- v1 (2026-07-26) — created
