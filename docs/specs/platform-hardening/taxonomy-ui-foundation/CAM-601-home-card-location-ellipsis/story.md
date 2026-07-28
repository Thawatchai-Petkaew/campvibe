## Story
As a **Camper**, I want the Home catalog card's location line to keep all its detail on one line and end in "…" when it's too long, so that a camp with a long district/province name never makes its card taller than the other cards in the same grid row.
Why: reported by CAM-598 while fixing the identical defect on the assistant cards, and deliberately not fixed there (different component, out of bounds for that ticket) — this is the follow-up. Same owner decision as CAM-598 (2026-07-28): keep all three location levels, cut with an ellipsis rather than dropping one.
Scope: `components/CampgroundCard.tsx`'s location `<p data-testid="text--card-location">` (rendered on Home / search results / wishlist, via `InfiniteScrollGrid` and `WishlistPageClient`) stays on one visible line and truncates with a native ellipsis instead of wrapping, at every responsive grid breakpoint. No location level dropped, no font-size change, no new component.
Depends on: CAM-598 (recorded the same defect against `CampgroundCard.tsx` as out-of-scope, and the mechanism this story follows); CAM-573 (the id-derived bilingual district/sub-district chain that made the location line long enough to matter).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A card's location text is short enough to fit its grid column's width | The card renders at any breakpoint | The full text is visible on one line, e.g. `เมืองนครราชสีมา, นครราชสีมา` | No truncation applied; `line-clamp-1` never visually engages because content already fits | EC-1 |
| AC-2 | A card's location text (all 3 levels) is longer than its grid column's available width | The card renders at the `md` breakpoint (768-1023px, 3-column grid — the narrowest card in the whole responsive grid) | The text stays on ONE line and ends in `…` — never wraps onto a second line, never makes the card taller than its row siblings | The location `<p>` carries `line-clamp-1`; box height stays one line-height; no data is dropped from the underlying string | EC-2 |
| AC-3 | Any of the above | The camper resizes the viewport or the text is very long | No location level (sub-district/district/province) is removed to make it fit — only the CSS visual box clips, the underlying text still carries every level | The full string is always present in `textContent`; only the rendered box is visually clipped | EC-3 |

## Rules
- BR-1 The location `<p>` renders on exactly one visible line at every grid breakpoint (mobile 1-col through 2xl 5-col) — never 2+ lines — regardless of content length (proves AC-2).
- BR-2 Truncation never removes a location level from the underlying text/data — only the rendered CSS box may clip it (proves AC-3).
- BR-3 The fix reuses the same visual mechanism CAM-598 chose for the assistant cards (`line-clamp-1`, not `truncate`'s nowrap+ellipsis) so the two cards answer "what happens when a location line is too long" the same way.

## Edge cases
- EC-1 IF the location text fits within the grid column's width THEN it renders unclipped, no ellipsis shown (BR-1)
- EC-2 IF the location text exceeds the column width THEN the row height stays one line (measured: it wrapped to 2 lines at the `md` breakpoint before this fix) (BR-1)
- EC-3 IF the combined text is inspected via `textContent` (not the rendered box) THEN every level (sub-district + district + province) is present, char-for-char, even when visually clipped (BR-2)

## Data
No schema/API change. Presentation-only: one Tailwind class (`line-clamp-1`) added to an existing `<p>` in `components/CampgroundCard.tsx`. `buildLocationText` (CAM-545/573/597) is unchanged.

## Seams & refs
- Reuse: `buildLocationText` (CAM-545/573/597) is the string source; unchanged by this story.
- Refs: CAM-598 (the sibling story that fixed the identical defect on the assistant cards and flagged this one); CAM-573 (the id-derived bilingual chain that made the line long enough to wrap).

## Out of scope
- `components/ai-chat/**` — CAM-598's territory, already fixed, untouched here.
- Which location parts are produced/resolved (`buildLocationText`, `AdminArea` chain) — unchanged.
- Any DB/API change — presentation-only fix.

## Self-verify
- AC-1/AC-2/AC-3 → `e2e/regression/cam-601-home-card-location-ellipsis.spec.ts` (behavioural: real Chromium, seeded e2e DB, real Home grid, the real worst-case string `ในเมือง, เมืองนครราชสีมา, นครราชสีมา` substituted onto the first real rendered card via `page.evaluate` — see design.md for why SSR content can't be network-mocked here — asserting `scrollWidth<=clientWidth` + one-line-height at mobile/md/lg widths)
- Prove-It: the e2e spec was run with the fix removed (`git diff` reverted on the one class) — failed at the `md` breakpoint (height=40, 2 wrapped lines) — then restored and passed (4/4) — see design.md "Measured — before/after"
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-28) — created
