## Story
As a **Camper** viewing the navbar on my phone while logged in, I want the account button to be a square tap target with the avatar centred in it, so that the control reads as deliberate at every text size and its size stops being an accident of arithmetic.
Why: owner challenge 2026-07-27 on CAM-590's reported "7px". The arithmetic in the shipped code is `px-1.5` (6px) + 32px avatar + 1px border each side = a 46px-wide box; the 7px reported was a MEASURED gap that included the border, not a designed value. The designed value was 6px, still a half-step off the 4px rhythm every DESIGN.md table runs on (4/8/12/16/20/24). The defect is the METHOD, not the number: CAM-590 computed a padding to reach a target size instead of sizing the box from the scale and centring the content, and that method keeps producing off-grid values.
Scope: `components/Navbar.tsx` — the account-menu trigger `<button>`'s own sizing classes below `md` only, plus the one-line sizing rule this story adds to `DESIGN.md` §2.0. Does NOT touch the desktop (`md:` and above) shape, which still holds a hamburger plus the avatar and legitimately needs asymmetric padding.
Depends on: CAM-590 (the padding split this story replaces) · CAM-558 (pinned this button to `h-11` and hid the hamburger below `md`) · CAM-549 (traced the 320px logged-in overflow to this same button's width) · CAM-565 (the 150% text-scale contract this story re-measures at)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper is logged in, looking at the navbar account button below `md` (avatar-only, no hamburger) | The button renders | The avatar sits centred in a square button, the gap to its left and right reading as the same size | The button's real bounding box measures exactly 44×44px and the avatar wrapper's left and right gaps inside it differ by ≤1px (was 46px wide, gaps 7px/7px) | EC-1 |
| AC-2 | Same button, any viewport, any text size | The button renders | The tappable area is still comfortably large enough for a thumb | The button's real bounding box is ≥44px in BOTH width and height — the box now equals the touch floor exactly rather than exceeding it by an arithmetic remainder | EC-2 |
| AC-3 | A camper is logged in, on a 320px-wide viewport | Page loads | No horizontal scrollbar | `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at 320px logged in — the button got 2px narrower (46→44), so the margin CAM-549/558 closed widens, never narrows | EC-3 |
| AC-4 | A camper is logged in, on a desktop-width viewport (≥768px, hamburger + avatar both visible) | The button renders | The button looks exactly as it did before this story | The desktop padding (`md:pl-3` / `md:pr-1`, 12px left / 4px right) and the auto content-driven width are unchanged; only the below-`md` sizing changed | — (regression-only; this story is the avatar-only case by definition, so the desktop row has no positive behaviour of its own to add) |
| AC-5 | A designer or engineer sizing any control and reaching for a computed padding | They open `DESIGN.md` §2.0 | The section states outright that a control's SIZE comes from the scale and its content is centred | `DESIGN.md` §2.0 carries the sizing-method rule; the absence of that rule is what allowed CAM-590's off-grid 6px | — (documentation rule; its failure mode is the recurrence this story exists to stop) |

## Rules
- BR-1 The avatar-only (below `md`) trigger is a fixed square sized from the scale: `h-11 w-11` = 44×44px, with the 32px avatar centred by flex (`justify-center`). No horizontal padding utility participates in its width below `md`. Both operands (44 box, 32 content) are on the scale; the residual 6px gap each side is a CENTRING RESULT, never a value anyone picked. (proves AC-1, AC-2)
- BR-2 Width is restored to content-driven at `md:` and above (`md:w-auto`), where `md:pl-3` / `md:pr-1` / `gap-2` and the hamburger continue to define the shape exactly as CAM-590 left them. Height (`h-11`) is one value at every viewport. (proves AC-4)
- BR-3 The new width (44px) must be ≤ the previous 46px that CAM-558/CAM-590 already proved does not reopen the 320px overflow, and must stay ≥44px (the DESIGN.md §2.0 touch floor). It is exactly the floor: equal, not merely above. (proves AC-2, AC-3)
- BR-4 `DESIGN.md` §2.0 gains a rule, in the section an implementer actually meets while choosing a height: a control's size comes from the scale and its content is centred inside it; a padding computed to reach a target size is the defect, because it lands values off the 4px rhythm. (proves AC-5)

## Edge cases
- EC-1 IF the camper has no profile image (fallback `User` glyph in a `bg-muted rounded-full p-1` wrapper, a 24px icon in a 32px wrapper) THEN the same wrapper is still centred in the same 44×44 box — the square is sized independently of which avatar path renders, which is precisely what the padding method could not guarantee (BR-1)
- EC-2 IF text is scaled to a realistic ~150% root font-size (`html { font-size: 24px }`, this codebase's standing contract per CAM-565) THEN the box stays square and the avatar stays centred within 1px, because `h-11`/`w-11`/`w-8` are all rem-based and scale together — where a mixed px/rem model would drift (BR-1, BR-3)
- EC-3 IF the viewport is ≥768px THEN this story makes no visible change at all — the width returns to `auto` and every desktop padding utility is untouched (BR-2)
- EC-4 IF a future change reintroduces a computed padding to size this control THEN the unit guard fails, because the guard pins the BOX (`h-11 w-11`) and asserts the absence of a bare horizontal padding utility — it does not pin a padding value that a new arithmetic could quietly satisfy (BR-1, BR-4)

## Data
- None. Presentation-layer sizing only (className changes on one existing button) plus one documentation rule · migration: none.

## Seams & refs
- Reuse: no new component/token. `h-11`/`w-11` are the same 44px scale tokens `DESIGN.md` §2.0 already names for an icon button and that CAM-558 already used on the wishlist link in this same navbar row (`w-11 h-11`), so this button now matches its own neighbour instead of being sized by a bespoke sum.
- Refs: CAM-590 `story.md` BR-1 (the padding split this replaces) · CAM-558 `story.md` BR-5 (hamburger-hide + the 320px-overflow trace) · CAM-565 (the 150% text-scale contract) · `DESIGN.md` §2.0 (the touch floor and the control-height table this rule joins).

## Out of scope
- The desktop (`md:` and above) shape — it holds a hamburger plus the avatar and legitimately needs asymmetric padding; converting it to a scale-sized box is a different story with a different AC.
- A repo-wide sweep converting every other computed-padding control to a scale-sized box. This story adds the RULE to `DESIGN.md`; enforcing it retroactively is a follow-up that must first count its own backlog, per the report-mode-before-blocking rule in `.claude/rules/ops.md`.
- Promoting the new rule to a `check:ds` static rule — same reason: a blocking guard never ships with an uncounted backlog.

## Self-verify
- AC-1 → unit (source: the box is pinned `h-11 w-11`, no bare horizontal padding below `md`) + e2e (real bounding box: 44×44 exactly, avatar left/right gaps within 1px, at 390px and 320px, logged in)
- AC-2 → e2e (real bounding box ≥44px in both dimensions at 390px, 320px, and at 150% text scale, logged in)
- AC-3 → e2e (`document.documentElement.scrollWidth <= clientWidth` at 320px logged in, at both text scales)
- AC-4 → unit (source: `md:pl-3 md:pr-1 md:w-auto` present and `gap-2` retained) + e2e (desktop button geometry + hamburger and language switcher still visible at 1280px)
- AC-5 → unit (source: `DESIGN.md` §2.0 states the size-from-scale/centre-the-content rule)
- EC-1..EC-4 → unit (EC-4 pins the box, not a padding) + e2e (EC-2 at `html { font-size: 24px }`)
- Story-specific: CAM-590's and CAM-558's own suites re-run unmodified except for pinned numbers this change legitimately moves; full suite re-run as the LAST act after the final edit.
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-27) — created
