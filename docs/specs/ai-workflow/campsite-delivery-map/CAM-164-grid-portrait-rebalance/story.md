## Story

CAM-164 — Grid + portrait fix + layout rebalance

**Version:** 1.0.0
**Status:** Done

## Why

After CAM-163 the fixed-canvas scale works correctly across all screen widths. Three issues
remained from owner screenshots:

1. Wide layout is top-heavy — characters bunch in the upper-central clearing; the lower third
   (the two picnic tables) was empty.
2. Portrait didn't center — characters leaned right and mirrored the wide diagonal rather than
   forming a tight centered cluster. Root cause: `useState("wide")` initial state meant
   `YouScout` rendered at `YOU_POS_WIDE` on the first client paint; `homeStyle()` also read
   `LAYOUT_WIDE` because the module-level `currentLayout` started as `LAYOUT_WIDE`. The
   `useEffect` corrected both, but after the first paint, causing a visible layout flash.
3. Tuning from dark screenshots was imprecise — no way to correlate a visual position with an
   exact % coordinate.

## AC

| # | Given | When | Result |
|---|---|---|---|
| AC-1 | `?grid=1` in URL | Page loads | Semi-transparent % coordinate grid renders inside `.scout-layer`; lines every 10% with top/left edge labels; absent without the param |
| AC-2 | Portrait viewport (aspect < 7:5) | Page loads | Characters form a tight centered cluster at x∈[40,60]; YouScout at (50,22); no layout flash on first paint |
| AC-3 | Wide viewport (aspect >= 7:5) | Page loads | Characters spread across the whole camp (upper, mid, lower tables); You at (38,24) |
| AC-4 | Device rotated / browser resized | Aspect crosses 7:5 | Characters snap to correct layout; all existing engine/motion/HUD behavior unchanged |

## Out of scope

- Final pixel-perfect coordinate tuning (that comes in the next round using the ?grid=1 tool)
- Any overlay, HUD, or engine behavior changes
