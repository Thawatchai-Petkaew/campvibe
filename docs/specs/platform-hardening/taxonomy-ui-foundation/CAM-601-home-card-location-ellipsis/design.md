# CAM-601 — design notes

## Why this measures differently from CAM-598

`AiChatCampCard`/`AiChatDetailCard` get their camp data from a CLIENT fetch
(`/api/ai/chat`), so CAM-598 could mock the network boundary and drive an
arbitrary location string straight through. `CampgroundCard`'s first-page
data on Home comes from an async Server Component reading Prisma directly
(`CatalogResults.tsx`) — there is no browser-side network call to intercept
for the first page (SSR happens in the Next.js server process, invisible to
Playwright's `page.route`). So the real worst-case string was injected onto
the real, already-rendered `<p data-testid="text--card-location">` via
`page.evaluate` — the same technique CAM-598 itself used to test its
min-w-0 hypothesis, and the one `e2e/README.md` documents as the
"direct-browser fallback". Every class, every pixel of card width, and the
whole grid/container CSS cascade is the real, compiled app; only the text
itself is synthetic, and only because the DB content can't be.

## Measured — before/after (real Chromium, local dev server, real grid)

Worst-case real string (the same live camp CAM-598 used):
`ในเมือง, เมืองนครราชสีมา, นครราชสีมา` (sub-district, district, province all
repeat "เมือง").

The Home grid (`InfiniteScrollGrid.tsx` / `WishlistPageClient.tsx`) is
`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
gap-x-6` inside a `container mx-auto px-6` (24px fixed padding at every
breakpoint). Card width is therefore NOT monotonic with viewport width —
it depends on which breakpoint's container max-width and column count are
active. Measured (before this fix, no clamp/truncate class on the `<p>`):

| Breakpoint | Card width | Before | After (`line-clamp-1`) |
|---|---|---|---|
| mobile (1-col) | 342px | height=20px (1 line) — already fits | unchanged, height=20px |
| sm (2-col) | 284px | height=20px (1 line) — already fits | unchanged, height=20px |
| **md (3-col) — narrowest card in the whole grid** | **224px** | **height=40px (2 wrapped lines)** — the real defect | **height=20px (1 line)** |
| lg (4-col) | 226px | height=20px (1 line) — fits by ~1.5px margin | unchanged, height=20px |
| xl (5-col) | 227px | height=20px (1 line) — fits by ~2.5px margin | unchanged, height=20px |
| 2xl (5-col, wide) | 278px | height=20px (1 line) — already fits | unchanged, height=20px |

The intrinsic (unwrapped) width of the worst-case string at this card's font
(`text-sm`, 14px/20px, Inter+Sarabun) measures ~224.6px. That is why every
tier except `md` happens to fit "by a hair" (1-3px of margin) without ever
needing to wrap — `md` is the one tier where the container hasn't grown past
768px yet but the grid has already split into 3 columns, making it the
**narrowest card width in the entire responsive grid** (narrower than both
the 2-column `sm` tier and the 4/5-column `lg`/`xl` tiers, because those
have a proportionally wider container). This is a **real, reproducible
defect**, not a theoretical one — it was reproduced and screenshotted at
900px viewport width before any code change, and the fix (`line-clamp-1`)
was verified to close it while leaving every other tier visually unchanged
(they were never wrapping to begin with).

## Decision — `line-clamp-1`, not `truncate`

Two candidates were tried:

1. **`truncate`** (Tailwind's `overflow-hidden + text-overflow:ellipsis +
   white-space:nowrap`) — matches the sibling `<h3>` name element in the
   same file. Tried first; it does keep the row to one visible line
   (confirmed: height stayed 20px at every tier). Rejected as the SHIPPED
   fix because of how it reports `scrollWidth`: `white-space:nowrap` lays
   the text out as one long unclipped line first, so `scrollWidth` reflects
   that WIDER virtual line (measured 225px vs a 224px box at `md`) even once
   the visual ellipsis is correctly showing — that is the expected, correct
   behavior for `text-overflow:ellipsis`, but it does not match the
   behavioral invariant this story's regression test (and CAM-598's) uses to
   prove "still one line, nothing overflowed": `scrollWidth <= clientWidth`.
2. **`line-clamp-1`** (chosen) — `-webkit-line-clamp:1` lets the browser lay
   the text out with its NORMAL wrapping algorithm first, then clips after
   the first visible line and shows the ellipsis at the clip point. Because
   wrapping (not nowrap-overflow) is the underlying mechanism, the box never
   reports a `scrollWidth` wider than its `clientWidth` even while actively
   clamping — confirmed behaviourally in the regression spec below. This is
   also the EXACT mechanism CAM-598 chose for both assistant cards, so the
   two sibling tickets now answer "what happens when a location line is too
   long" with the same CSS contract, not two superficially-similar but
   mechanically-different ones.

No `min-w-0` was added: the location `<p>` is a plain block child of a
non-flex `<div className="space-y-1 mt-3">` (unlike `AiChatDetailCard`'s
flex row), so the flex min-content trap CAM-598's Decision 1 investigated
does not apply here at all — there is no flex item involved.

## Regression spec — why it substitutes text via `page.evaluate`

See the file-level comment in
`e2e/regression/cam-601-home-card-location-ellipsis.spec.ts`. Short version:
Home's first page has no client-fetch boundary to mock, so the spec grabs
whichever real seeded camp renders first (any of them — every card at a
given breakpoint shares the identical grid column width) and substitutes the
real worst-case string onto its real, already-hydrated `<p>`. Tested at
mobile (390px, no-regression check), `md` (900px, the tier that actually
wrapped pre-fix — the real regression net), and `lg` (1200px, a second
no-regression check at a borderline-margin tier).

## Prove-It (teeth)

With the fix's one class removed (`line-clamp-1` deleted from the `<p>`),
the spec's `md` case failed: `height=40 vs one line-height=20` (2 wrapped
lines) — the real, reproduced defect. Restored, all 4 cases passed. The
`mobile`/`lg` cases stayed green in both runs (as expected — those tiers
never wrapped, with or without the fix), which is itself the honest
confirmation that this fix changes nothing visually except at the one
breakpoint where the defect was real.

## Out of scope, not touched

`components/ai-chat/**` (CAM-598's cards, already fixed) · `buildLocationText`
/ the `AdminArea` chain (which parts are produced) · any DB/API change.
