# CAM-162 — Test Coverage

## Test location

`__tests__/status-map.test.ts` — "CAM-162 — Responsive background: srcset hi-res WebP" block.

## AC coverage

| AC | Test | Result |
|---|---|---|
| fallback src is forest-1920.webp (not campsite-forest.webp) | `uses forest-1920.webp as the fallback src` | green |
| srcSet has all four widths | `has srcSet with all four responsive widths` | green |
| sizes attribute uses cover-aware formula | `has sizes='max(100vw, 177.78vh)'` | green |
| fetchPriority="high" present | `has fetchPriority='high' for LCP` | green |
| old single-size src is removed | `does NOT reference the removed campsite-forest.webp` | green |
| CAM-161 bg assertion updated | `has .map-bg full-viewport background image` — now asserts forest-1920.webp | green |

## Updated assertion

CAM-161 test at line 171 was updated to assert `forest-1920.webp` instead of `campsite-forest.webp`, consistent with the replacement.

## What QA should manually verify on Staging

- On a 4K monitor (or via DevTools device emulation at 3840px DPR 1), network tab shows `forest-3840.webp` downloaded.
- On a 1080p monitor, network tab shows `forest-1920.webp`.
- On a portrait phone (e.g. iPhone 14, 390px), network tab shows `forest-1920.webp` (cover overscale forces a larger source).
- No blur visible on 4K (compare to before — should look crisp).
- Image loads as LCP candidate (DevTools Performance panel — main thread shows LCP attributed to the `<img>`).
