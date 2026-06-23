# CAM-157 (S7) — Technical Notes

## Files touched

| File | Change |
|---|---|
| `app/status/map/campsite-scene.tsx` | Agent `<div>` → `<button>`; You `<div>` → `<button>`; `role="img"` + `aria-label` on `.map-stage`; `.rm-label` CSS block; `engineReady` state for deep-link fix; you-alert becomes `<span>` (aria-hidden, visual only); `onActivate` prop opens Crew panel |
| `app/status/map/page.tsx` | Error copy changed to match `/status` verbatim (`โหลดข้อมูลจาก Linear ไม่ได้:`); `data-testid` added to error container |
| `app/status/map/scene-loader.tsx` | Loading div gets `role="status"` + `aria-live="polite"` + `…` ellipsis + testid |
| `__tests__/status-map.test.ts` | 27 new source-inspection tests for S7 AC1–AC5, AC7 |
| `docs/delivery/.../CAM-157-s7-a11y-perf/` | 5 delivery artifacts (story/design/tech/test/delivery) |

## Key decisions

### Agent `<button>` vs `<div role="button">`
Used a real `<button>` element (not `role="button"` on a div) because:
1. Native keyboard support (Enter/Space) without extra keydown handlers
2. Correct default focus ring from the UA stylesheet
3. tab index handled automatically (no `tabIndex={0}` needed)

The button's visual appearance is unchanged — the `.scout` CSS class applies all visual styling; the button's own default styles (background, border) are reset inline to `none`.

### You alert: `<button>` → `<span aria-hidden>`
The `.you-alert` element was previously a `<button>` inside `YouScout`. Since `YouScout` itself is now a `<button>`, nesting a button inside a button would be invalid HTML. Solution: make `.you-alert` a visual-only `<span aria-hidden="true">`. The accessible action (open gates panel) is now on the outer `<button>` element's `onClick`. This is semantically correct: one interactive element, one accessible action.

### `engineReady` state for deep-link fix (AC7)
The root cause of the S5 deep-link bug: the scope `useEffect` checks `engineRef.current` but if the engine hasn't started yet (it starts async in its own `useEffect`), `engineRef.current` is `null` and the scope is never applied.

Fix: add `engineReady` boolean state that is set to `true` inside `startLoop()` (via `setEngineReady(true)`), and include `engineReady` in the scope effect's dependency array. This causes the scope effect to re-run once the engine is ready, applying the initial `?scope=epic&epic=X` deep-link correctly.

The effect is idempotent — running it twice when `engineReady` becomes `true` costs one extra `engine.setScope()` call with the same arguments as the first run.

### Tab order: You first
The DOM order in `<div class="scout-layer">` is now: `<YouScout>` then `{agents.map(...)}`. Since these are absolutely-positioned elements in a `position:absolute` layer, DOM order determines tab order. This satisfies AC2's requirement for You to come first.

### `rm-label` accessibility tree membership
The `.rm-label` has `aria-hidden="true"` to prevent double-reading (the button itself has `aria-label` with the full description). The label is *visually* present under reduced-motion for sighted users who have reduced motion enabled. Screen reader users get the information from the button's `aria-label`.

This is intentional: the `rm-label` is a visual aid, not an accessibility mechanism. The accessibility mechanism is the button's `aria-label`.

## No-change items
- `campsite-overlays.tsx` — no changes needed; all empty states verified as already present
- `campsite-engine.ts` — no changes; `setScope` + `stop` + `triggerWalk` API unchanged
- `campsite-assets.ts` — no changes; night-scene SCENE HTML unchanged
- `lib/status-map-model.ts`, `lib/status-derive.ts`, `lib/status-model.ts` — no changes
