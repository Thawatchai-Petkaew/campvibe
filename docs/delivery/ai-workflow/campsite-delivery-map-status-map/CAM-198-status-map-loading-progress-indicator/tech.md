---
linear: CAM-198
feature: ai-workflow
epic: campsite-delivery-map-status-map (CAM-150)
artifact: tech
author: frontend-engineer
status: Done
version: v1
updated: 2026-06-26
---
# CAM-198 — Tech Notes: loading card → progress bar

## What changed

### `app/status/map/scene-loader.tsx`

Replaced the `loading:` fallback inside `dynamic(() => import("./campsite-scene"), { ssr: false })`.

Before: a glass card `.map-placeholder` with a text paragraph `.map-placeholder-text`.

After:
```tsx
<div className="map-wrap" role="status" aria-live="polite" aria-label="กำลังโหลดแผนที่แคมป์">
  <div
    className="map-progress"
    data-testid="loading--status-map"
    role="progressbar"
    aria-busy="true"
    aria-label="กำลังโหลดแผนที่แคมป์"
  >
    <span className="map-progress-bar" aria-hidden="true" />
  </div>
</div>
```

The outer `.map-wrap` + `role="status"` / `aria-live="polite"` are kept for backward compatibility with S7 AC4 tests. The inner element switches to `role="progressbar"` + `aria-busy="true"` per ARIA spec (AC-4). `data-testid="loading--status-map"` is preserved (QA parity).

### `app/status/map/campsite-assets.ts` (CSS string)

Added after the existing `.map-placeholder-text` rule:

```css
.map-progress {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: min(280px, 60vw); height: 3px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
  overflow: hidden;
}
.map-progress-bar {
  display: block; height: 100%; width: 50%;
  border-radius: 999px;
  background: var(--amber);
  box-shadow: 0 0 8px var(--amber), 0 0 16px rgba(255,180,84,.4);
}
@keyframes map-sweep {
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(240%); }
}
@media (prefers-reduced-motion: no-preference) {
  .map-progress-bar { animation: map-sweep 1.4s cubic-bezier(0.65,0,0.35,1) infinite; }
}
```

The `.map-progress` is centered on the night scene (absolute + translate) so it floats pleasantly over the forest background. Colors use scene-local `var(--amber)` (#FFB454) which is defined in the `:root` block at the top of the same CSS string — no Tailwind tokens needed (this CSS runs inside an injected `<style>` in the page's `<head>`, not processed by Tailwind).

## Reduced-motion (AC-3)

The sweep animation (`@keyframes map-sweep`) is unconditionally defined but only *applied* inside `@media (prefers-reduced-motion: no-preference)`. Under `prefers-reduced-motion: reduce`, `.map-progress-bar` renders as a static partial amber fill (50% width, full color, no movement, no flashing) — meets AC-3.

## A11y (AC-4)

- `role="progressbar"` on the inner wrapper (ARIA: indeterminate progressbar = `aria-valuenow` omitted).
- `aria-busy="true"` signals active loading to assistive technology.
- `aria-label="กำลังโหลดแผนที่แคมป์"` (Thai) on both the outer `role="status"` wrapper and inner `role="progressbar"` element — screen readers announce on appearance.
- `aria-hidden="true"` on the decorative `<span>` fill bar.
- No text visible in the UI (clean loading state per AC-1).

## What was preserved

- `.map-placeholder` CSS rule and `.map-placeholder-text` CSS rule remain in `campsite-assets.ts` — used by the error state in `app/status/map/page.tsx` (different state, untouched).
- The `SCENE` background (`<div class="map-scene">`) is rendered unconditionally by `page.tsx` — the night sky is always visible behind the progress bar.
- All modal action spinners in `campsite-overlays.tsx` (approve/approve-all, CAM-184) are untouched.
- The scene engine, campsite-engine.ts, campsite-overlays.tsx, and all other logic files are unchanged.

## Tests added (`__tests__/status-map.test.ts`)

11 new guard tests covering:
- Loading fallback has `.map-progress` (not `.map-placeholder` card) — source-inspect.
- `role="progressbar"` + `aria-busy="true"` present.
- `data-testid="loading--status-map"` preserved (QA parity).
- Thai `aria-label` present.
- `.map-progress-bar` span present; `.map-placeholder-text` absent.
- CSS: `.map-progress` track, `.map-progress-bar` with `var(--amber)`, `@keyframes map-sweep`.
- Sweep animation gated by `prefers-reduced-motion:no-preference`.
- `.map-placeholder` error card CSS still present.

All 3 pre-existing S7 AC4 loading tests continue to pass (Thai text in `aria-label` satisfies the `toContain("กำลังโหลดแผนที่แคมป์")` assertion).

## Self-verify results

- `npm run lint` — 0 errors (249 pre-existing warnings, all outside this story's files)
- `npm run typecheck` — clean (0 errors)
- `npm test` — 23 pre-existing failures (all in `app/page.tsx` home-catalog tests from CAM-197); 0 new failures; all 11 CAM-198 tests green
- `npm run check:palette` — PASS (0 violations)
- `npm run check:ds` — PASS (0 violations)
- `npm run build` — clean, `/status/map` route builds as dynamic
