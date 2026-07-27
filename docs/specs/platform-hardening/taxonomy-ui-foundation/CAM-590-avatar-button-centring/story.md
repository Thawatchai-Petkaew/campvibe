## Story
As a **Camper** viewing the navbar on my phone while logged in, I want the account button's avatar to sit centred inside its tappable box, so that the control does not look visually broken.
Why: owner report 2026-07-27 — with the account button reduced to an avatar alone (CAM-558 hid the hamburger below `md`), the avatar sits noticeably closer to the left edge of the button than the right.
Scope: `components/Navbar.tsx` only — the account-menu trigger `<button>`'s own padding classes. Does NOT touch the logo link, the language switcher, the hidden-hamburger rule, the avatar/User-icon glyph sizes, or any other control CAM-558 fixed.
Depends on: CAM-558 (pinned this button's height to `h-11` and hid the hamburger below `md`, the two facts this story must not regress) · CAM-549 (traced the 320px logged-in horizontal-overflow root cause to this same button's width)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper is logged in, looking at the navbar account button below `md` (avatar-only, no hamburger) | The button renders | The avatar sits centred in the button — the visual gap to its left and the gap to its right read as the same size | The avatar wrapper's real left gap and right gap inside the button, measured by bounding box, differ by ≤1px (was ~8px: 12px left vs 4px right) | EC-1 |
| AC-2 | Same button, any viewport | The button renders | The tappable area is still comfortably large enough for a thumb (no visible change in tap comfort) | The button's real bounding box still measures ≥44px in BOTH width and height (was 50px wide / 44px tall before this fix) | EC-2 |
| AC-3 | A camper is logged in, on a 320px-wide viewport (iPhone SE 1st-gen class) | Page loads | No horizontal scrollbar (unchanged from CAM-558) | `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at 320px logged in — stays 0px over, as CAM-558 left it | EC-3 |
| AC-4 | A camper is logged in, on a desktop-width viewport (≥768px, hamburger + avatar both visible) | The button renders | The button looks exactly as it did before this story (hamburger, gap, avatar, same spacing) | The button's desktop padding is byte-for-byte unchanged (`pl-3`/`pr-1` restore the original 12px-left/4px-right split at `md:` and above) | — (regression-only; this story's fix is scoped to the mobile-only asymmetry, not a redesign of the desktop row) |

## Rules
- BR-1 The button's horizontal padding is decoupled by breakpoint rather than picking one shared value: mobile (`<768px`, base utility) gets symmetric `px-1.5` (6px each side); desktop (`md:` and above) keeps the original asymmetric `pl-3`/`pr-1` (12px left / 4px right) that gives the hamburger glyph its own inset. (proves AC-1, AC-4)
- BR-2 The button's height (`h-11`, CAM-558) and vertical padding (`py-1`, unchanged) are not touched by this fix — the defect and its cause were both horizontal. (proves AC-2)
- BR-3 The new mobile width (46px: 6+32+6+2px border) must stay ≥44px (the DESIGN.md §2.0 touch floor) and must not exceed the previous 50px width that CAM-558 already proved does not reopen the 320px overflow — it is smaller, not larger. (proves AC-2, AC-3)

## Edge cases
- EC-1 IF the camper has no profile image (fallback `User` glyph, `bg-muted rounded-full p-1`) THEN the same wrapper div is still measured and still centres — the fix is not conditional on which avatar path renders (BR-1)
- EC-2 IF text is scaled to a realistic ~150% root font-size (a phone "Larger text" setting) THEN the button still measures ≥44px in both dimensions and the avatar stays centred within 1px — same `html { font-size: 24px }` technique CAM-558's own EC-5 and CAM-565's guard use, since a padding-only fix like this one is exactly the shape of defect that can look fine at default zoom and break at scale (BR-3)
- EC-3 IF the viewport is ≥768px (hamburger visible) THEN this story makes no visible change at all — the desktop padding split is restored byte-for-byte, not just "close enough" (BR-1)

## Data
- None. Presentation-layer sizing only (className changes on one existing button) · migration: none.

## Seams & refs
- Reuse: no new component/token; existing Tailwind padding utilities (`px-1.5`, `py-1`, `md:pl-3`, `md:pr-1`) from the same spacing scale CAM-558 already used on this exact button.
- Refs: CAM-558 `story.md` BR-5 (the hamburger-hide fix + the 320px-overflow trace this story must not regress) · CAM-584 `story.md` (the "decouple, don't shrink" precedent this fix follows — a correct prior fix's side effect is resolved by separating the two concerns, not by picking a smaller shared number) · `DESIGN.md` §2.0 "Responsive scale" (the 44×44px touch floor this fix must keep clearing).

## Out of scope
- Any change to the logo link, the language switcher, or the hidden-below-`md` hamburger rule — all three are asserted unchanged by this story's tests, not touched.
- A general navbar-overflow audit at other viewports/text scales beyond the specific 320px/150%-scale checks this story re-verifies.
- Redesigning the account button (new icon, new shape) — out of scope; this is a padding-symmetry fix only.

## Self-verify
- AC-1 → unit (source: mobile padding is symmetric, `px-1.5` with no bare `pl-3`/`pr-1` outside an `md:` prefix) + e2e (real bounding-box geometry: avatar-wrapper left/right gap inside the button, ≤1px difference, at 390px and 320px, logged in)
- AC-2 → e2e (real bounding-box: button ≥44×44px at 390px and 320px, logged in)
- AC-3 → e2e (`document.documentElement.scrollWidth <= clientWidth` at 320px, logged in — reused from CAM-558's own assertion)
- AC-4 → unit (source: `md:pl-3 md:pr-1` present, restoring the exact original desktop split) + e2e (button width/geometry at 1280px unchanged from before, hamburger + avatar still both visible)
- EC-2 → e2e (same geometry + centring assertions re-run at `html { font-size: 24px }`, ~150% text scale)
- Story-specific: full suite re-run as the last act (grep `__tests__/` + `e2e/` for `cam-558`, `Navbar`, `accountMenuAriaLabel` before handoff — all must still pass unmodified)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-27) — created
