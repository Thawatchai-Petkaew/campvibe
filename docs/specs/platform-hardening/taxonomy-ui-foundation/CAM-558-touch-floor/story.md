---
linear: CAM-558
feature: Platform hardening
epic: Taxonomy UI foundation
persona: CAMPER
artifact: story
owner: frontend-engineer
status: In Progress
version: v2
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
| AC-2 | A camper (logged in) is looking at the navbar, on any viewport | They tap the profile menu (avatar + hamburger) button | The menu opens exactly as before; the same avatar renders; on a phone the hamburger icon next to it is no longer shown (the avatar alone is the tap target) | Profile menu button measures ≥44×44px tall (was 42px measured, height-only fix); the button also narrows from ~78px to ~50px wide on mobile because the redundant hamburger glyph is hidden below `md` (unchanged at desktop) | EC-2 |
| AC-3 | A camper is looking at the navbar, on any viewport | They tap the CampVibe logo | They land on the home page exactly as before; the logo image itself stays the same visible size | The logo `<Link>`'s tappable box measures ≥44×44px (was 32px mobile / 40px desktop); the `<img>` visible size (`h-8 md:h-10`) is unchanged | EC-3 |
| AC-4 | A camper is looking at the navbar on a desktop-width viewport (≥768px, the only width it renders at since CAM-549) | They tap the language switcher | Language toggles exactly as before | Language switcher button measures ≥44×44px tall (was 36px measured) | EC-4 |
| AC-5 | A camper is logged in, on a 320px-wide viewport (iPhone SE 1st-gen class) | Page loads | No horizontal scrollbar | `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at 320px logged in — measured **335px vs 320px (15px over) before this fix, 320px vs 320px (0px over) after** | EC-5 |

## Rules
- BR-1 Touch floor = 44×44 CSS px in both dimensions, per `DESIGN.md` §2.0 (CAM-552) — a control's TAP TARGET must reach the floor; its visible glyph does not have to grow to match (padding / a larger hit area around a small icon is the correct lever, not enlarging the icon). (proves AC-1, AC-2, AC-3, AC-4)
- BR-2 The icon-button role is `size-11` (`w-11 h-11` = 44px), the same token already used by this file's own wishlist-heart button and by `AiChatCardCarousel.tsx`'s prev/next arrows — reuse it rather than a new ad hoc size. (proves AC-1)
- BR-3 No visible glyph grows as part of this fix — `ChevronLeft`/`ChevronRight` stay `w-4 h-4`, the logo `<img>` stays `h-8 md:h-10`. Only the tappable box (padding/height/min-height) changes. (proves AC-1, AC-3)
- BR-4 The language switcher's mobile entry from CAM-552's original measurement no longer applies — CAM-549 hides it below `md` entirely (owner-authorized drop). Only its desktop (≥768px) rendering is in scope here. (proves AC-4)
- BR-5 (added — measured contradiction, see Changelog v2) A height-only fix on the profile-menu button does NOT close the 320px overflow (measured: still 335px after `h-11` alone — the overflow is a WIDTH problem, and the button's own padding/gap were already at the DESIGN.md §2.0 compaction floor). The hamburger glyph next to the avatar is redundant (the avatar alone is an established account-menu affordance) and is hidden below `md` only — the SAME "drop by importance rather than squeeze" call the owner already ratified for the language switcher (CAM-549), applied here to one icon inside an already-visible control rather than to a whole nav item; it is unchanged at `md:` and above. (proves AC-2, AC-5)

## Edge cases
- EC-1 IF a camp card has exactly 1 photo THEN no carousel arrows render at all (pre-existing behavior, unchanged by this fix) — nothing to measure (BR-1)
- EC-2 IF the camper is logged out THEN the profile menu button still renders (guest state) and must still clear the 44px floor — the fix is not conditional on auth state (BR-1)
- EC-3 IF the logo link sits next to the host `Badge` (dashboard context) THEN growing its own tap target must not shift the badge or wrap the row (BR-1)
- EC-4 IF the viewport is <768px THEN the language switcher is not in the DOM at all (`hidden md:flex`, CAM-549) — AC-4 is desktop-only, verified not to regress the CAM-549 mobile-hidden guarantee (BR-4)
- EC-5 IF text is scaled to a realistic ~150% root font-size (a phone "Larger text" setting) THEN the profile-menu button and the carousel arrows still measure ≥44×44px (Tailwind's rem-based `h-11`/`w-11` only grow with the root font-size, so the meaningful regression guarded against is one of them silently NOT scaling) — CAM-560 shipped a defect that was invisible at default zoom, so this is checked explicitly with the same `html { font-size: 24px }` technique CAM-560's own regression spec used (BR-1)

## Data
- None. Presentation-layer sizing only (className changes) · migration: none.

## Seams & refs
- Reuse: the icon-button size token is `size-11` / `w-11 h-11`, already declared as the shared convention across `components/ui/button.tsx` (`size: "icon"`), this file's own wishlist-heart button (`CampgroundCard.tsx` line ~381, `w-11 h-11`), and `AiChatCardCarousel.tsx`'s prev/next buttons (`h-11 w-11`, small `size-5` glyph) — the carousel-arrow fix follows that exact established pattern (grow the box, keep the glyph small), not a new size. The mobile-hidden hamburger icon (`hidden md:block`) reuses the exact responsive-visibility idiom `LanguageSwitcher`'s own wrapper already uses in `Navbar.tsx` (`hidden md:flex`).
- Refs: `DESIGN.md` §2.0 "Responsive scale" (CAM-552, the 44px touch-floor rule this story fixes against) · CAM-549 `story.md` "Seams & refs" (the 320px overflow root-cause trace, reused verbatim here as the starting measurement) · CAM-560 `e2e/regression/cam-560-category-label-overlap.spec.ts` (the `html { font-size: 24px }` 150%-text-scale technique reused here for EC-5).

## Out of scope
- The pre-existing hardcoded English `aria-label`s on the carousel arrows (`"Previous image"`/`"Next image"`) and the language switcher (`"Switch language"`) — an i18n-copy issue unrelated to touch-target sizing, not touched here so the CAM-549 e2e assertion on the exact `"Switch language"` accessible name keeps passing. Flagged for a follow-up i18n ticket.
- The carousel arrows' `opacity-0 group-hover:opacity-100` (mouse-only) reveal — a pre-existing keyboard-focus visibility gap unrelated to this story's AC; a `focus-visible:opacity-100` + ring was bundled in as a low-risk a11y improvement on the exact two buttons already being resized, not a separate scope item.
- Any change to `CampgroundCard.tsx`'s card layout/design (owned by CAM-541/545/547/550) beyond the two arrow buttons' tap-target size.
- Full horizontal-overflow-freedom at 150% text scale — EC-5 only asserts the touch floor still holds at that scale; a systemic "no overflow at any text scale" guarantee across the whole navbar is a bigger, separate concern than this story's 4 named controls.

## Self-verify
- AC-1..4 → e2e (`e2e/regression/cam-558-touch-targets.spec.ts`), real bounding-box geometry via `boundingBox()` in a real Chromium browser at a phone viewport (390px) and desktop (1280px) — not className inspection
- AC-5 → e2e (same spec), `document.documentElement.scrollWidth <= clientWidth` at 320px, logged in via the existing regression storageState; before/after measured 335px vs 320px
- EC-5 → e2e (same spec), the profile-menu button + carousel arrows re-measured at a `html { font-size: 24px }` (~150%) root font-size
- Story-specific: unit test (`__tests__/cam-558-touch-floor.test.ts`) source-asserts the resized elements use the `size-11`/`h-11`/`min-h-11`/`min-w-11` tokens (not an arbitrary px literal), that the chevron/logo glyphs are unchanged, and that no test elsewhere in the repo pins the old smaller classes
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
- v2 (2026-07-26) — self-verify (real bounding-box measurement, not guessed) found AC-5's claim did not hold from a height-only profile-menu fix (335px measured, unchanged); added BR-5 and revised AC-2/AC-5 to the actual fix (hide the redundant hamburger icon below `md`, same "drop by importance" precedent CAM-549 used for the language switcher) — re-measured 320px vs 320px (0px over). EC-5's technique corrected from a nonstandard CSS `zoom` hack to the `html { font-size: 24px }` convention CAM-560 already established (CSS `zoom` does not move `clientWidth`/`scrollWidth` the way a real text-scale does, so it produced a misleading first result).
