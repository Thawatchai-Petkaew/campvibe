---
linear: CAM-194
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
artifact: test
status: In Progress
version: v1
updated: 2026-06-26
---
# Test — PERF-4 next/image migration (CAM-194)

## AC → Test matrix

| AC# | Test ID | Layer | Description | Pass/Fail |
|---|---|---|---|---|
| AC-1 | img--iwf-imports-next-image | unit/source-inspect | imports Image from "next/image" | PASS |
| AC-1 | img--iwf-import-is-default | unit/source-inspect | import is default (not named) | PASS |
| AC-1 | img--iwf-no-raw-img-tag | unit/source-inspect | no raw `<img` tag in JSX render path | PASS |
| AC-1 | img--iwf-fill-present | unit/source-inspect | `<Image` element present with fill attribute | PASS |
| AC-2 | img--iwf-blob-guard | unit/source-inspect | isUnoptimized: startsWith("blob:") check | PASS |
| AC-2 | img--iwf-data-guard | unit/source-inspect | isUnoptimized: startsWith("data:") check | PASS |
| AC-2 | img--iwf-unoptimized-passthrough | unit/source-inspect | explicit unoptimized prop sets isUnoptimized | PASS |
| AC-2 | img--iwf-or-combination | unit/source-inspect | all three conditions combined with `\|\|` | PASS |
| AC-2 | img--iwf-unoptimized-wired-both-branches | unit/source-inspect | isUnoptimized forwarded to both Image branches | PASS |
| AC-3 | img--iwf-fixed-mode-gate | unit/source-inspect | isFixedMode: typeof width/height === "number" | PASS |
| AC-3 | img--iwf-fill-standalone-attr | unit/source-inspect | fill branch has standalone `fill` attribute | PASS |
| AC-3 | img--iwf-fill-sizes-prop | unit/source-inspect | fill branch passes sizes={sizes} | PASS |
| AC-3 | img--iwf-fixed-width-height | unit/source-inspect | fixed branch passes width={width} height={height} | PASS |
| AC-3 | img--iwf-fixed-no-fill | unit/source-inspect | fixed branch does NOT have fill attr | PASS |
| AC-3 | img--logo-fixed-mode | unit/source-inspect | LogoUpload passes width={128} height={128} | PASS |
| AC-3 | img--detail-fill-no-dims | unit/source-inspect | CampgroundDetailClient uses fill mode (no width/height) | PASS |
| AC-3 | img--gallery-fill-no-dims | unit/source-inspect | ImageGallery uses fill mode (no width/height) | PASS |
| AC-4 | img--hero-mobile-priority | unit/source-inspect | mobile hero carries priority | PASS |
| AC-4 | img--hero-1img-priority | unit/source-inspect | 1-image desktop branch has priority | PASS |
| AC-4 | img--hero-2img-priority-conditional | unit/source-inspect | 2-image branch: priority={i === 0} | PASS |
| AC-4 | img--hero-3img-priority | unit/source-inspect | 3-image hero carries priority | PASS |
| AC-4 | img--hero-3img-secondary-no-priority | unit/source-inspect | 3-image secondary cells: 1 priority occurrence only | PASS |
| AC-4 | img--hero-4img-priority | unit/source-inspect | 4-image hero carries priority | PASS |
| AC-4 | img--hero-4img-secondary-no-priority | unit/source-inspect | 4-image secondary cells: 1 priority occurrence only | PASS |
| AC-4 | img--hero-5img-priority | unit/source-inspect | 5+ image hero carries priority | PASS |
| AC-4 | img--hero-5img-secondary-no-priority | unit/source-inspect | 5+ image secondary cells: 1 priority occurrence only | PASS |
| AC-4 | img--gallery-no-priority | unit/source-inspect | ImageGallery has NO priority | PASS |
| AC-4 | img--card-no-priority | unit/source-inspect | CampgroundCard has NO priority | PASS |
| AC-4 | img--bookings-no-priority | unit/source-inspect | bookings page has NO priority | PASS |
| AC-4 | img--dashboard-no-priority | unit/source-inspect | dashboard/campsites has NO priority | PASS |
| AC-4 | img--image-upload-no-priority | unit/source-inspect | ImageUpload has NO priority | PASS |
| AC-4 | img--logo-upload-no-priority | unit/source-inspect | LogoUpload has NO priority | PASS |
| AC-5 | img--config-webp | unit/source-inspect | formats includes "image/webp" | PASS |
| AC-5 | img--config-no-avif | unit/source-inspect | formats does NOT include "image/avif" | PASS |
| AC-5 | img--config-no-svg | unit/source-inspect | dangerouslyAllowSVG: false | PASS |
| AC-5 | img--config-blob-remote | unit/source-inspect | remotePatterns includes blob.vercel-storage.com | PASS |
| AC-5 | img--config-unsplash-retained | unit/source-inspect | remotePatterns includes images.unsplash.com | PASS |
| AC-5 | img--config-min-cache-ttl-key | unit/source-inspect | minimumCacheTTL key present | PASS |
| AC-5 | img--config-min-cache-ttl-value | unit/source-inspect | minimumCacheTTL = 60*60*24*31 (31 days) | PASS |
| AC-5 | img--config-qualities-75 | unit/source-inspect | qualities: [75] | PASS |
| AC-6 | img--fallback-errored-state | unit/source-inspect | useState(false) for errored present | PASS |
| AC-6 | img--fallback-show-logic | unit/source-inspect | showFallback = !src \|\| errored | PASS |
| AC-6 | img--fallback-on-error-wired | unit/source-inspect | onError wired on both Image branches | PASS |
| AC-6 | img--fallback-imageoff-import | unit/source-inspect | ImageOff from lucide-react imported | PASS |
| AC-6 | img--fallback-imageoff-renders | unit/source-inspect | ImageOff renders in showFallback branch | PASS |
| AC-6 | img--fallback-aria-hidden | unit/source-inspect | fallback icon has aria-hidden="true" | PASS |
| AC-6 | img--fallback-testid-suffix | unit/source-inspect | fallback keeps --fallback-placeholder testid | PASS |
| AC-7 | img--bookings-aspect-ratio | unit/source-inspect | bookings wrapper has aspect-[4/3] | PASS |
| AC-7 | img--bookings-no-h-auto | unit/source-inspect | bookings wrapper does NOT use h-auto | PASS |
| AC-7 | img--bookings-adoption | unit/source-inspect | bookings page imports ImageWithFallback | PASS |
| AC-7 | img--bookings-sizes | unit/source-inspect | bookings ImageWithFallback passes sizes= | PASS |

**Total: 51 tests — 51 PASS / 0 FAIL**

## Coverage on new code

Layer: source-inspection (static analysis via `fs.readFileSync`), not runtime execution.  
`image-with-fallback.tsx` is a `"use client"` component; the vitest `node` environment cannot
execute client component JSX.  The v8 coverage tool reports 0% statement coverage for this file
because it is never `import`-ed into the test runner — this is expected and is the same result
produced by `ir1-image-resilience.test.ts` (the existing test for this component).

All new logic paths in `image-with-fallback.tsx` are exercised by source-inspection assertions:
- `isUnoptimized` computation (blob:/data: auto-detect) — AC-2 tests
- `isFixedMode` gate (typeof width/height) — AC-3 tests
- fill branch (no width/height) — AC-3 tests
- fixed branch (width+height) — AC-3 tests
- fallback branch (onError + errored) — AC-6 tests

`next.config.ts` is a config file (not a module with runtime logic); source-inspection is the
correct layer. Coverage on config files: not measured / not applicable.

**Reported coverage: not measured (source-inspection layer — same precedent as ir1, cam-193, cam-192).**

## Staging-only ACs (not automatable at unit layer)

The following AC outcomes require a live browser on the real Staging URL:

| AC# | What to verify on Staging | Notes |
|---|---|---|
| AC-1 | Images actually load; response headers show `content-type: image/webp` | DevTools Network tab |
| AC-2 | LCP ≥ improvement vs baseline (Lighthouse mobile, before: 9.0s) | Chrome DevTools Lighthouse |
| AC-2 | CLS = 0 on detail page hero (no layout shift) | Lighthouse / CLS metric |
| AC-3 | blob: preview URL (during upload) displays correctly without optimization errors | Manual test in ImageUpload |
| AC-4 | Broken image shows ImageOff placeholder (onError fires in browser) | Open a detail page with a bad URL |

## Defects

None found. All ACs pass static-inspection.

## Notes

- No production code was written or edited by this test file.
- No files were pushed.
- `npm run lint`: 0 errors, 244 warnings (all pre-existing tech-debt; 0 new warnings added).
- `npm run typecheck`: clean (no errors).
- `npm test`: 3099 tests pass (3048 baseline + 51 new).
