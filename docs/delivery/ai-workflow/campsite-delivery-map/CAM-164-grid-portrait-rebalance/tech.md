## Tech

CAM-164 — Grid + portrait fix + layout rebalance

### Portrait root cause

`CampsiteScene` used `useState<"wide" | "narrow">("wide")` — a hardcoded initial value. On
portrait, the `useEffect` fires asynchronously after the first client paint and calls
`setLayoutKey("narrow")`, but the first render already completed with `"wide"`. This caused:

- `YouScout` to render at `YOU_POS_WIDE` on the first frame (reading `layoutKey === "wide"`).
- `homeStyle()` to read `LAYOUT_WIDE` positions for all agents (reading module-level
  `currentLayout` which is initialized to `LAYOUT_WIDE`).

### Fix

Replaced the hardcoded initial value with a lazy state initializer:

```ts
const [layoutKey, setLayoutKey] = useState<"wide" | "narrow">(() => {
  if (typeof window === "undefined") return "wide"; // SSR guard (never reached — ssr:false)
  const isWide = window.matchMedia("(min-aspect-ratio: 7/5)").matches;
  currentLayout = isWide ? LAYOUT_WIDE : LAYOUT_NARROW;
  return isWide ? "wide" : "narrow";
});
```

Since `campsite-scene.tsx` is loaded with `ssr: false` (via `scene-loader.tsx`), `window` is
always available on the first client render. The lazy initializer runs synchronously before the
first render, so `layoutKey` and `currentLayout` are both correct from frame zero — no flash.

The `useEffect` still calls `setLayoutKey` and updates `currentLayout` for correctness/idempotency
(and to wire the `change` listener), but the initial render is now already at the right layout.

### Debug coordinate grid

`DebugGrid` is a zero-overhead dev component (no state, no effects):

- Renders inside `.scout-layer` so its `%` positions map exactly to the character coordinate space.
- Vertical + horizontal lines every 10% drawn as `position:absolute` divs with
  `background: rgba(255,255,255,0.25)`.
- Numeric labels on the top (x axis) and left (y axis) edges in monospace yellow-white.
- `pointer-events:none` — invisible to all interactions.
- `aria-hidden="true"` — invisible to screen readers.
- Rendered only when `debugGrid === true` (passed from `page.tsx` reading `sp.grid === "1"`).

### Layout tables (screenshot-tuned, further refinement via ?grid=1)

**LAYOUT_WIDE** — spread to use the whole camp:

| Role | x | y | Location |
|---|---|---|---|
| You | 38 | 24 | Upper-left clearing (dock area) |
| Architect | 50 | 32 | Upper-center clearing |
| Designer | 66 | 33 | Upper-right |
| Security | 28 | 42 | Left mid |
| QA | 27 | 55 | Lower-left |
| Backend | 73 | 52 | Right mid |
| DevOps | 35 | 72 | Lower-left table |
| Frontend | 63 | 72 | Lower-right table |

**LAYOUT_NARROW** — tight x∈[40,60] centered cluster for portrait:

| Role | x | y | Location |
|---|---|---|---|
| You | 50 | 22 | Top center |
| Architect | 40 | 34 | Left column row 1 |
| Designer | 60 | 34 | Right column row 1 |
| Security | 50 | 42 | Center row 2 |
| QA | 40 | 50 | Left column row 3 |
| Backend | 60 | 50 | Right column row 3 |
| DevOps | 40 | 64 | Left column row 4 |
| Frontend | 60 | 64 | Right column row 4 |

**Scout sizes:** root `116px` (bumped from 104px), narrow MQ override `90px` (from 82px).

### Files changed

- `app/status/map/campsite-scene.tsx` — layout tables, scout sizes, `DebugGrid`, portrait fix
- `app/status/map/scene-loader.tsx` — `debugGrid` prop forwarded
- `app/status/map/page.tsx` — reads `sp.grid`, passes `debugGrid`
- `__tests__/status-map.test.ts` — updated `--scout-size` assertion, added CAM-164 test suite
- `docs/delivery/ai-workflow/campsite-delivery-map/CAM-164-grid-portrait-rebalance/` — this dir
