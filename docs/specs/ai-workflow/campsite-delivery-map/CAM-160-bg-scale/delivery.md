# CAM-160 delivery notes — overlay removal + cover-scale technique

## Files changed

- `app/status/map/campsite-assets.ts` — removed `linear-gradient` overlay from `.map-scene`,
  removed `.map-aurora` and `.map-stars` CSS rules and their HTML elements from `SCENE`.
  `.map-scene` is now a minimal `#070d1c` fallback (used by the token-gate and error states).
- `app/status/map/campsite-scene.tsx` — rewrote `.map-wrap` and `.map-stage` CSS in `SCENE_CSS`.

## Key technique: coupled cover-scale stage

The root bug was that the forest background (on `.map-scene`, `position:fixed;inset:0`) and the
character stage (`.map-stage`, `position:relative;width:100%;height:100vh`) were independent
layers. Characters used `%` positions relative to `.map-stage` but the background scaled to the
viewport independently — so they could not stay aligned across different aspect ratios.

The fix couples both into one element: `.map-stage` now carries the forest background and is
sized to always cover the viewport at the image's native 16:9 aspect ratio.

### Final CSS

```css
.map-wrap {
  position: fixed; inset: 0; overflow: hidden;
  background: #070d1c;  /* fallback during WebP load */
  z-index: 5;
}
.map-stage {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  --ar: calc(16 / 9);
  --zoom: 1.12;
  width:  calc(max(100vw, 100vh * var(--ar)) * var(--zoom));
  height: calc(max(100vh, 100vw / var(--ar)) * var(--zoom));
  background: url("/status-map/campsite-forest.webp") center/cover no-repeat;
}
.scout-layer { position: absolute; inset: 0; z-index: 30; }
```

### Zoom factor chosen: 1.12

Tuning range is 1.05–1.20. 1.12 gives a noticeable "zoomed in" feel without cropping too
aggressively on 16:9 screens. The owner should confirm this on staging screenshot; it is the
one visual judgment that requires human approval.

### Behaviour by screen shape

| Screen | width formula | height formula | result |
|---|---|---|---|
| 16:9 (1920×1080, 2k, 4k) | `max(100vw, 100vh×ar)×zoom = 100vw×1.12` | `max(100vh, 100vw/ar)×zoom = 100vh×1.12` | fills viewport, 12% crop on all sides, campsite centred |
| Wider than 16:9 (ultrawide) | `100vw×1.12` | `100vw/ar×1.12` (taller than vh) | top/bottom crop; campsite horizontal centre visible |
| Portrait (mobile/tablet) | `100vh×ar×1.12` (wider than vw, sides overflow) | `100vh×1.12` | left/right sides overflow but campsite vertical centre stays visible |

In all cases the centre of the image (the main campsite area) stays visible and the characters
(positioned as `%` of `.map-stage`) remain properly aligned to the image.

## Overlay elements removed

- `linear-gradient(180deg, rgba(6,11,26,.52) …)` — the gradient darkening the forest
- `.map-aurora` div + CSS rule — blurred multi-colour glow overlay
- `.map-stars span` CSS rule — star particles (the span elements were never populated at runtime
  but the CSS rule existed)

The dock, badges, and panels all have their own `rgba` glass backgrounds so text legibility is
unaffected by removing the full-scene overlay.

## Tests updated

No test assertions existed for the aurora/stars/gradient content. The two assertions that do
exist (`export const SCENE` present and `dangerouslySetInnerHTML={{ __html: SCENE }}` in page.tsx)
both continue to pass — `SCENE` still exports a string and page.tsx still renders it.

## Self-verify results

- `npm run lint` — 0 errors (225 pre-existing warnings, unchanged)
- `npm run typecheck` — clean (0 errors)
- `npm test` — 42 test files, 2342 tests, all passed
- `npm run build` — compiled successfully
- `npm run check:palette` — PASS (0 violations)

## CWV scorecard

| Metric | Value | Notes |
|---|---|---|
| LCP | not measured | forest WebP is the LCP candidate; no new `next/image` change (background-image, not `<img>`) |
| CLS | not measured | `.map-stage` has fixed `position:absolute` + translate — no layout shift risk |
| INP | not measured | no new JS interaction added |

Potential regression risk: background-image on `.map-stage` is not preloaded via `<link rel="preload">`.
This is unchanged from the CAM-158 baseline. The `#070d1c` fallback in `.map-wrap` prevents a
white flash while the WebP loads. If LCP regression is measured on staging, a `<link rel="preload">`
for the forest WebP can be added as a follow-up.

## Browser-only tuning caveat

The zoom factor (1.12) and the resulting crop are a visual judgment. They cannot be fully
verified without a real browser screenshot at each target resolution. The owner should confirm
the campsite centering and crop level on the staging URL before this story is marked Done.
