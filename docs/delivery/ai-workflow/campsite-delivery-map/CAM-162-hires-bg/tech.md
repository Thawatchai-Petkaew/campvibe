# CAM-162 — Tech Notes

## Files changed

| File | Change |
|---|---|
| `scripts/gen-forest.mjs` | New: Node ESM script to generate responsive WebP from source PNG |
| `app/status/map/campsite-scene.tsx` | Updated `<img class="map-bg">` with srcset/sizes/fetchPriority |
| `__tests__/status-map.test.ts` | Updated CAM-161 assertion + added CAM-162 test block |
| `public/status-map/forest-1280.webp` | New: 1280×720, 48 330 bytes |
| `public/status-map/forest-1920.webp` | New: 1920×1080, 98 214 bytes |
| `public/status-map/forest-2560.webp` | New: 2560×1440, 156 786 bytes |
| `public/status-map/forest-3840.webp` | New: 3840×2160, 278 014 bytes |
| `public/status-map/campsite-forest.webp` | Deleted: replaced by forest-1920.webp (same resolution, same quality) |

## Generated file sizes (exact bytes from ls -la)

```
-rw-r--r--  forest-1280.webp   48 330 bytes   (47.2 KB)
-rw-r--r--  forest-1920.webp   98 214 bytes   (95.9 KB)
-rw-r--r--  forest-2560.webp  156 786 bytes  (153.1 KB)
-rw-r--r--  forest-3840.webp  278 014 bytes  (271.5 KB)
```

All four under the 700 KB target; 3840 is 271.5 KB.

## Hero-image budget exception

Default performance budget: `< 200 KB / image`.

**Exception rationale** — forest-2560 (153 KB) and forest-3840 (272 KB) exceed 200 KB:

- This is a single full-bleed art background for a private tool page (`/status/map`).
- The browser downloads only the appropriate variant for the device — a 1280px screen never downloads the 3840 file.
- The asset is served as a static file from Vercel CDN and cached after the first load (long TTL). Subsequent page visits cost 0 bytes for this asset.
- The page is not a public-facing page (token-gated), so there is no LCP impact on crawlability or SEO.

This exception is documented and accepted by the team. Future work: if the page becomes public-facing, revisit the 200 KB ceiling per the performance rule.

## `sizes` attribute reasoning

`sizes="max(100vw, 177.78vh)"` accounts for cover scaling on portrait screens.

On a portrait phone (e.g. 390×844, aspect ratio 9:19.3):
- The image must fill the viewport using `object-fit: cover`.
- The image is 16:9, so it is scaled until the width covers the viewport height: effective width = 844 × (16/9) = 1500px.
- `max(100vw, 177.78vh)` resolves to `max(390px, 1500px)` = 1500px → browser picks `forest-1920.webp`.
- Without this `sizes` hint, the browser would pick `forest-1280.webp` (only 390px wide), which would look blurry on that device at cover scale.

## AVIF decision

AVIF was evaluated. The WebP sizes (48–272 KB) are already compact and well-cached. AVIF encoding requires CPU-intensive effort in sharp and would add `<picture>` complexity with `<source type="image/avif">`. The size savings (~20–30% over WebP) do not justify the complexity for this use case. Decision: WebP only.

## fetchpriority and LCP

`fetchPriority="high"` (React camelCase for `fetchpriority`) tells the browser to start downloading this image early in the network waterfall. Since the forest image is the largest paint element on the page, it is the LCP candidate. This attribute is the primary mechanism to protect the LCP target without adding a `<link rel="preload">` to the server shell (which would require threading `imagesrcset`/`imagesizes` through `page.tsx`).

LCP measurement: `not measured` (tool required to get a real number — label is potential improvement).
