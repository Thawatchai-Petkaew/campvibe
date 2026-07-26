---
linear: CAM-558
feature: Platform hardening
epic: Taxonomy UI foundation
persona: CAMPER
artifact: story
owner: frontend-engineer
status: In Progress
version: v1
updated: 2026-07-26
---

## Story
As a **Camper** tapping any control on CampVibe with my thumb, I want every tappable control to be at least 44×44 CSS px, so that I do not mis-tap the wrong thing on a phone.
Why: CAM-552 measured 4 controls under the 44px touch floor it wrote into `DESIGN.md` §2.0 while defining the mobile scale, and reported rather than fixed them (they sit outside that story's file surface): the camp-card carousel arrows (28×28px, ~48 instances per catalog page), the navbar language switcher (36px), the profile menu button (42px), and the logo link (32px). CAM-549 then shipped and re-scoped this ticket in its own comments: (a) the language switcher no longer renders on mobile at all (owner-authorized drop, `hidden md:flex`), narrowing its entry to a desktop-only check; (b) CAM-549 traced the last ~15px of horizontal overflow at 320px (logged in) to this same profile-menu button and deliberately left it for this ticket to fix against the DESIGN.md rule rather than shave pixels to pass one viewport.
Scope: resize the 4 named controls' TAP TARGET (not necessarily their visible glyph) to clear 44×44px, in `components/CampgroundCard.tsx` (carousel arrows) and `components/Navbar.tsx` + `components/LanguageSwitcher.tsx` (profile menu, logo, language switcher). Verify the 320px logged-in overflow closes as a side effect of the profile-menu fix.
Depends on: CAM-552 (wrote the 44px floor into `DESIGN.md` §2.0) · CAM-549 (re-scoped the language switcher + traced the 320px overflow here)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper is looking at a camp card with more than one photo, on any viewport | They tap or click a carousel arrow | The arrow still shows the same small chevron glyph, but the tappable area around it is big enough that a thumb reliably lands on it | Prev/next arrow buttons measure ≥44×44px in real geometry (was 28×28px); the `ChevronLeft`/`ChevronRight` glyph itself stays `w-4 h-4` | EC-1 |
| AC-2 | A camper (logged in) is looking at the navbar, on any viewport | They tap the profile menu (avatar + hamburger) button | The menu opens exactly as before; the button just has more room around the same avatar/icon | Profile menu button measures ≥44×44px tall (was 42px measured); width was already >44px, unchanged | EC-2 |
| AC-3 | A camper is looking at the navbar, on any viewport | They tap the CampVibe logo | They land on the home page exactly as before; the logo image itself stays the same visible size | The logo `<Link>`'s tappable box measures ≥44×44px (was 32px mobile / 40px desktop); the `<img>` visible size (`h-8 md:h-10`) is unchanged | EC-3 |
| AC-4 | A camper is looking at the navbar on a desktop-width viewport (≥768px, the only width it renders at since CAM-549) | They tap the language switcher | Language toggles exactly as before | Language switcher button measures ≥44×44px tall (was 36px measured) | EC-4 |
| AC-5 | A camper is logged in, on a 320px-wide viewport (iPhone SE 1st-gen class) | Page loads | No horizontal scrollbar | `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at 320px logged in (CAM-549 measured ~15px overflow here, traced to the profile-menu button this story resizes) | EC-5 |

## Rules
- BR-1 Touch floor = 44×44 CSS px in both dimensions, per `DESIGN.md` §2.0 (CAM-552) — a control's TAP TARGET must reach the floor; its visible glyph does not have to grow to match (padding / a larger hit area around a small icon is the correct lever, not enlarging the icon). (proves AC-1, AC-2, AC-3, AC-4)
- BR-2 The icon-button role is `size-11` (`w-11 h-11` = 44px), the same token already used by this file's own wishlist-heart button and by `AiChatCardCarousel.tsx`'s prev/next arrows — reuse it rather than a new ad hoc size. (proves AC-1)
- BR-3 No visible glyph grows as part of this fix — `ChevronLeft`/`ChevronRight` stay `w-4 h-4`, the logo `<img>` stays `h-8 md:h-10`, the profile-menu avatar/icon sizing is unchanged. Only the tappable box (padding/height/min-height) changes. (proves AC-1, AC-2, AC-3)
- BR-4 The language switcher's mobile entry from CAM-552's original measurement no longer applies — CAM-549 hides it below `md` entirely (owner-authorized drop). Only its desktop (≥768px) rendering is in scope here. (proves AC-4)

## Edge cases
- EC-1 IF a camp card has exactly 1 photo THEN no carousel arrows render at all (pre-existing behavior, unchanged by this fix) — nothing to measure (BR-1)
- EC-2 IF the camper is logged out THEN the profile menu button still renders (guest state) and must still clear the 44px floor — the fix is not conditional on auth state (BR-1)
- EC-3 IF the logo link sits next to the host `Badge` (dashboard context) THEN growing its own tap target must not shift the badge or wrap the row (BR-1)
- EC-4 IF the viewport is <768px THEN the language switcher is not in the DOM at all (`hidden md:flex`, CAM-549) — AC-4 is desktop-only, verified not to regress the CAM-549 mobile-hidden guarantee (BR-4)
- EC-5 IF text is scaled to 150% (browser zoom / OS text-scale) THEN every control resized by this story still measures ≥44×44px and the 320px overflow assertion (AC-5) still holds — CAM-560 shipped a defect that was invisible at default zoom, so 150% is checked explicitly (BR-1)

## Data
- None. Presentation-layer sizing only (className changes) · migration: none.

## Seams & refs
- Reuse: the icon-button size token is `size-11` / `w-11 h-11`, already declared as the shared convention across `components/ui/button.tsx` (`size: "icon"`), this file's own wishlist-heart button (`CampgroundCard.tsx` line ~381, `w-11 h-11`), and `AiChatCardCarousel.tsx`'s prev/next buttons (`h-11 w-11`, small `size-5` glyph) — the carousel-arrow fix follows that exact established pattern (grow the box, keep the glyph small), not a new size.
- Refs: `DESIGN.md` §2.0 "Responsive scale" (CAM-552, the 44px touch-floor rule this story fixes against) · CAM-549 `story.md` "Seams & refs" (the 320px overflow root-cause trace, reused verbatim here as the starting measurement).

## Out of scope
- The pre-existing hardcoded English `aria-label`s on the carousel arrows (`"Previous image"`/`"Next image"`) and the language switcher (`"Switch language"`) — an i18n-copy issue unrelated to touch-target sizing, not touched here so the CAM-549 e2e assertion on the exact `"Switch language"` accessible name keeps passing. Flagged for a follow-up i18n ticket.
- The carousel arrows' `opacity-0 group-hover:opacity-100` (mouse-only) reveal — a pre-existing keyboard-focus visibility gap unrelated to this story's AC, not touched beyond adding the same focus-visible ring convention already used elsewhere in this file (bonus a11y, not a scope item on its own).
- Any change to `CampgroundCard.tsx`'s card layout/design (owned by CAM-541/545/547/550) beyond the two arrow buttons' tap-target size.

## Self-verify
- AC-1..4 → e2e (`e2e/regression/cam-558-touch-targets.spec.ts`), real bounding-box geometry via `getBoundingClientRect()` in a real Chromium browser at a phone viewport (390px) and desktop (1280px), plus a 150% CSS-zoom pass (EC-5) — not className inspection
- AC-5 → e2e (same spec / a sibling spec), `document.documentElement.scrollWidth <= clientWidth` at 320px, logged in via the existing regression storageState, before/after numbers reported
- Story-specific: unit test (`__tests__/cam-558-touch-floor.test.ts`) source-asserts the three resized elements use the `size-11`/`h-11`/`min-h-11`/`min-w-11` tokens (not an arbitrary px literal) and that no test elsewhere in the repo pins the old smaller classes
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
