## CAM-166 — Clearing-ring positions for /status/map

**Design correction:** previous round (CAM-165) placed characters ON the furniture (tents/tables/board), which looked cluttered. Owner requested a clean ring on the central dirt clearing around the campfire.

## Change summary

File changed: `app/status/map/campsite-scene.tsx`

Only `LAYOUT_WIDE` coordinate table and `YOU_POS_WIDE` were modified. Engine, HUD, real-time SSE, overlays, reduced-motion, scaling, and `LAYOUT_NARROW` are untouched.

### New LAYOUT_WIDE (ring on central clearing, campfire centre ~50,52)

| Role | x | y | Ring position |
|---|---|---|---|
| architect | 50 | 38 | top-centre |
| ux-designer | 60 | 43 | upper-right |
| backend-engineer | 63 | 52 | right |
| frontend-engineer | 59 | 61 | lower-right |
| devops-release | 41 | 61 | lower-left |
| qa-engineer | 37 | 52 | left |
| security-reviewer | 41 | 43 | upper-left |

### YOU_POS_WIDE

`{x: 38, y: 23}` — dock (upper-left), unchanged role. Nudged y from 24 → 23 for slight visual refinement; functionally equivalent.

### LAYOUT_NARROW (unchanged)

2-column x42/x58 grid remains as set in CAM-165. All x-values stay within [42,58] for the portrait visible band.

## Test assertions updated

File: `__tests__/status-map.test.ts`

- CAM-164 block: `YOU_POS_WIDE` assertion updated from `{x:38, y:24}` to `{x:38, y:23}`
- CAM-165 Fix 2 block: renamed to "CAM-166: LAYOUT_WIDE clearing-ring coords"; all 7 role coordinate assertions updated to ring values; `YOU_POS_WIDE` assertion updated

All other assertions (engine, a11y, reduced-motion, overlays, HUD, srcset, portrait fix) remain intact.
