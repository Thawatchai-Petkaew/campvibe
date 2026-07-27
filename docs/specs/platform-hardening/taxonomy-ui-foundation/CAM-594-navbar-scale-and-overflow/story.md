## Story
As a **Camper** browsing CampVibe on a phone, I want the header to take a compact, on-scale slice of the screen and to stay inside the viewport when I turn my text size up, so that I get more camp above the fold and never a sideways-scrolling page.
Why: two owner-raised tickets over the same rows, merged into one piece of work (owner-approved 2026-07-27). CAM-593: the title row is `h-20`, the DESKTOP value, and never got a mobile step, so the header + search + category strip eat ~245px of an 844px phone screen. CAM-594: at a 150% text scale the same row overflows the viewport, and `scrollWidth` sits at a near-constant ~452px regardless of viewport width, so the cause is the whole row growing with the type, not one control. Splitting them would put two agents in the same file measuring different things.
Scope: `components/Navbar.tsx` (the title row's height, the row's overflow behaviour, the mobile search bar's box) plus the two `DESIGN.md` §2.0 rows those values now come from. `components/CategoryBar.tsx` is verified unchanged. Desktop (`md:` and above) is deliberately byte-identical, which is what keeps the `CategoryBar` sticky offset in `app/page.tsx` correct without editing it.
Depends on: CAM-552 (defined §2.0 but excluded the navbar from its file surface) · CAM-549 (the sticky-offset trap and the owner-authorised drop of the language switcher) · CAM-558 / CAM-590 / CAM-592 (the 44px logo link, wishlist box and 44×44 account button this story must not undo) · CAM-565 (the 150% text-scale contract this story measures against)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | Camper opens Home at 320px or 390px wide at the default text size | Page loads | The header band above the camp list is visibly shorter: the logo row is 64px tall (was 80px) and the search pill reading `ที่ไหนก็ได้` is 44px tall (was 54px), with the category tabs unchanged below it | Title row height 80→64px, search-bar height 54→44px, total header chrome 245→211px measured at 390px | EC-4 |
| AC-2 | Camper is logged in (worst-case icon row: heart, bell, account) at 320px or 390px wide with the phone text size set to 150% | Page loads | Nothing is cut off at the right edge and the page does not scroll sideways; the account icons move onto a second line under the logo rather than running off-screen | `document.documentElement.scrollWidth <= clientWidth` at both widths (before: 452 vs 320 = 132px over, 452 vs 390 = 62px over) | EC-1, EC-2 |
| AC-3 | Camper is on Home at 320px or 390px, at either text size | Camper scrolls down and back up | The category tabs strip is never left as a stuck sliver behind the header; it scrolls with the page and, at the top of the page, is fully visible | The category strip stays `position: static` below `md`; its full height (85px at default, 126px at 150%) is visible with no part hidden behind sticky chrome at scroll 0 | EC-3 |
| AC-4 | Camper is on Home at 320px or 390px, logged in, at either text size | Camper looks at anything tappable in the header | Every tappable control in the header is still at least as big as a fingertip, including the search pill | Every header tap target measures ≥44px in both dimensions at 100% and at 150% (search pill exactly 44px at 100%, the floor) | EC-2 |
| AC-5 | Camper is on a desktop-width viewport (≥768px), at either text size | Camper scrolls Home | Unchanged from before this story: the full navbar stays pinned and the category tabs stay pinned directly beneath it, with no gap and no overlap | Nav height stays 80px at `md:` and above, so the category wrapper's `top-20` offset still lands flush (measured gap −1px at both text scales, identical before and after) | — regression guard: proven by keeping every `md:` value byte-identical, not by a new behaviour |

## Rules
- BR-1 Both new heights come from `DESIGN.md` §2.0, not from arithmetic: the title row is `min-h-16 md:h-20` (64/80px) and the search bar is `h-11` (44px, which is simultaneously the touch floor and the `md` control-height role). Content is centred inside each box; no padding is computed to reach a total (the CAM-592 rule).
- BR-2 44px is a floor, never a target to go under. The search bar lands exactly on it at the default text size and grows with the scale above it; no control in the header drops below 44px at any viewport or text size.
- BR-3 The overflow at an increased text scale is closed by **wrapping**, not by dropping a control. Below `md` the title row is `flex-wrap` with a `min-h-*` (not a fixed `h-*`), so when the row's intrinsic width exceeds the viewport it becomes a second line. The language switcher stays the only item ever dropped from this row (CAM-549's owner authorisation); nothing further is dropped.
- BR-4 Desktop is untouched. `md:h-20`, `md:flex-nowrap` and `md:ms-0` restore the exact pre-story desktop row, which is what keeps the `CategoryBar` sticky offset (`md:top-20`, in `app/page.tsx`, outside this story's file surface) correct by construction rather than by a second edit.
- BR-5 No new user-facing copy. The search pill keeps the existing `search.anywhere` key; at a narrow width and a large text size that label truncates with an ellipsis rather than wrapping the fixed-height box.

## Edge cases
- EC-1 IF the text scale is raised to 150% at 320px, the narrowest supported phone, THEN the title row wraps to two lines (logo above, account icons below, right-aligned) and the page still does not scroll sideways — the wrap is the designed relief valve, not a defect.
- EC-2 IF the camper is logged out THEN the row carries fewer icons, so it never reaches the wrap threshold at either text size and every remaining tap target is unchanged (measured 0px overflow before and after at both widths and both scales).
- EC-3 IF the header's height changes THEN the category strip's sticky offset must change with it, or the strip hides behind the header and leaks a sliver (the CAM-549 defect). This story changes only the height below `md`, where the strip is not sticky at all, and leaves `md:h-20` intact, so the offset needs no change — asserted, not assumed.
- EC-4 IF the search pill's label is longer than the pill at a large text size THEN the label truncates on one line; the pill's height stays fixed at the scale value and never grows to 98px/128px as it did before (measured at 390px/150% and 320px/150%).

## Data
- No schema, API or data change. Client-side layout only, in `components/Navbar.tsx`, plus two rows and one rule paragraph in `DESIGN.md` §2.0. Migration: none.

## Seams & refs
- Reuse: the two heights are §2.0 table values (`min-h-16`/`md:h-20`, `h-11`), not new numbers; the 44px floor is the same token the wishlist link and account button on this row already use.
- Readers of the navbar's height: `app/page.tsx`'s `md:sticky md:top-20` category wrapper (NO-CHANGE — desktop height is unchanged) · `e2e/regression/cam-549-sticky-search-only.spec.ts` (NO-CHANGE — asserts positions, not heights) · `e2e/regression/cam-590-avatar-centring.spec.ts` + `__tests__/cam-590-*`/`cam-592-*` (NO-CHANGE — pin the account button box, untouched here). Grepped; no other reader pins the navbar's row height.
- Refs: `DESIGN.md` §2.0 (mobile step, touch floor, size-from-the-scale, text-scale contract).

## Out of scope
- Compacting the category strip itself (85px). Its geometry is CAM-552/CAM-560 territory and touching the tab box risks re-opening the label-overlap defect → follow-up ticket if the owner still wants that 85px down.
- The full-screen search modal the pill opens (CAM-561) — this story changes the BAR, not the modal.
- The desktop centre search bar's own scale — not reported, and measured correct.

## Self-verify
- AC-1, AC-2, AC-4 → e2e (`e2e/regression/cam-594-navbar-scale-and-overflow.spec.ts`, at 320/390 × 100%/150% × logged-out/logged-in) + unit source pins (`__tests__/cam-594-navbar-scale.test.ts`)
- AC-3, AC-5 → e2e (sticky offset and strip visibility measured at both text scales, mobile and desktop)
- Story-specific: assert CAM-558's `min-h-11 min-w-11` logo link, CAM-590/592's `h-11 w-11` account box, CAM-549's `hidden md:flex` language switcher and sibling sticky search bar, and CAM-570's translated aria-labels are all unchanged.
- Gate = /quality-gate (`lint`, `typecheck`, `check:ds`, `check:palette`, `check:contrast`, full vitest) · Done = every AC verified on the real Staging URL

## Changelog
- v1 (2026-07-27) — created; merges CAM-593 (mobile step for the header and search bar) and CAM-594 (150% text-scale overflow) into one story per owner approval.
