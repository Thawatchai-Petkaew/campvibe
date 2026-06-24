## Delivery

CAM-164 — Grid + portrait fix + layout rebalance

**Status:** Done (pending AC verification on Staging URL)

### Self-verify results

- `npm run lint` — PASS (0 errors; pre-existing warnings only)
- `npm run typecheck` — PASS (clean)
- `npm test` — PASS (2393/2393; 134 status-map tests including 21 new CAM-164 assertions)
- `npm run build` — PASS (`/status/map` builds as dynamic route)
- `npm run check:palette` — PASS (0 violations)

### AC verification (reasoning)

- **AC-1 (?grid=1):** `DebugGrid` renders inside `.scout-layer` only when `debugGrid === true`.
  `page.tsx` sets `debugGrid = sp.grid === "1"`. Absent without `?grid=1`. `data-testid="debug--map-grid"` present.
- **AC-2 (portrait no-flash):** Lazy `useState` initializer reads `matchMedia` on first render.
  `layoutKey` and `currentLayout` are both correct from frame zero — `YouScout` renders at
  `YOU_POS_NARROW = {x:50, y:22}` and `homeStyle()` returns LAYOUT_NARROW positions. No flash.
- **AC-3 (wide layout):** Characters spread across the full camp — You at upper-left (38,24),
  DevOps + Frontend at lower tables (35,72) and (63,72) filling the previously empty lower third.
- **AC-4 (resize/rotate):** `arMq.addEventListener("change", onArChange)` unchanged — layout
  switches correctly on resize.

### Engine / motion / HUD unchanged

- `campsite-engine.ts` — not touched
- `campsite-overlays.tsx` — not touched
- Reduced-motion branch, SSE reconcile, `setScope`, `triggerWalk` — unchanged

### Portrait root cause (verbatim)

The `useState<"wide" | "narrow">("wide")` hardcoded initial state caused `YouScout` and
`homeStyle()` to render at LAYOUT_WIDE positions on the first client paint on portrait screens.
The `useEffect` corrected them after the first frame, producing a visible layout flash.

Fixed by replacing the hardcoded initial with a lazy initializer that reads
`window.matchMedia("(min-aspect-ratio: 7/5)")` synchronously before the first render — since the
scene is `ssr:false`, `window` is always available at this point.

### CWV scorecard

- LCP: not measured (internal ops dashboard, not a public page — CWV not a gate requirement)
- CLS: not measured (no layout shift risk introduced — DebugGrid is inside `.scout-layer`,
  existing absolute-positioned layer; lazy state init removes a previous layout shift)
- INP: not measured
- Bundle impact: `DebugGrid` is a tiny inline component (< 1KB minified); only rendered when
  `?grid=1` is explicitly passed — no production bundle cost in the normal path.

### Next

- Owner verifies AC on Staging URL at `/status/map?grid=1` and `/status/map` (wide + portrait)
- Next tuning round: use `?grid=1` screenshot to adjust coordinates to exact art positions
- QA to assert AC per test suite; Security: no user input, no PII — no security follow-up needed
