## Story

CAM-163 — Layout-apply fix: LAYOUT_WIDE / LAYOUT_NARROW never reach characters at runtime

**Version:** 1.0.0
**Status:** Done

## Why

CAM-161 added responsive layout tables (LAYOUT_WIDE / LAYOUT_NARROW) but they were never
actually applied at runtime. Characters rendered at the old radial compass cluster positions
(NODES) on every device/orientation. The bug was a silent data-flow break in the engine.

## AC

| # | Given | When | Result |
|---|---|---|---|
| AC-1 | Wide viewport (aspect >= 7:5) | Page loads | Characters appear at LAYOUT_WIDE positions from first paint; no jump to compass cluster |
| AC-2 | Portrait/narrow viewport (aspect < 7:5) | Page loads | Characters appear at LAYOUT_NARROW positions from first paint; all 8 visible |
| AC-3 | User rotates device / resizes browser | Aspect crosses 7:5 threshold | Characters smoothly snap to the other layout; no remount, no flash |
| AC-4 | Reduced-motion OS setting enabled | Page loads | Characters static at correct layout home; no rAF loop started |
| AC-5 | Engine running; data changes | SSE reconcile | triggerWalk fires; character walks BFS path and arrives at homeX/homeY (layout position) |

## Out of scope

- Changing LAYOUT_WIDE / LAYOUT_NARROW coordinate values (those are screenshot-tuned separately)
- Any visual design change beyond fixing the position bug
