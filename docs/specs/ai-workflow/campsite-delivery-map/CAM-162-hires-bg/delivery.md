# CAM-162 — Delivery Checklist

## Generated WebP file sizes

| File | Dimensions | Exact bytes | Human-readable |
|---|---|---|---|
| forest-1280.webp | 1280×720 | 48 330 | 47.2 KB |
| forest-1920.webp | 1920×1080 | 98 214 | 95.9 KB |
| forest-2560.webp | 2560×1440 | 156 786 | 153.1 KB |
| forest-3840.webp | 3840×2160 | 278 014 | 271.5 KB |
| campsite-forest.webp | deleted | — | replaced |

Total across 4 new files: 580 344 bytes (567 KB).
Only one file is downloaded per page load by the browser.

## Hero-image budget exception

Standard budget: < 200 KB per image.

Granted exception: forest-2560 (153 KB) and forest-3840 (272 KB) exceed 200 KB.

Justification:
1. Only one variant is downloaded per page load — the browser selects via srcset.
2. Static CDN asset, long-cached after first load.
3. Token-gated internal tool — not a public SEO page; LCP does not affect indexing.
4. The 3840 variant at 272 KB is well under the 700 KB target stated in the story brief.

## AVIF decision

Not added. WebP sizes at quality 80 are compact and browser-cached. AVIF would require a `<picture>` wrapper and adds encoding complexity for ~20–30% additional size savings, which is not justified for this use case.

## CWV scorecard

| Metric | Status |
|---|---|
| LCP | not measured — potential improvement: fetchpriority="high" ensures the image is prioritized in the network waterfall; risk was blurry upscaling of a 2x underresolved image |
| CLS | not measured — no layout shift expected; img is position:fixed inset:0, dimensions are fixed 100%/100% |
| INP | not measured — no interaction path changed |

No CWV measurements were taken (no profiling tool available in this run). All values are labeled "not measured" per metric-honesty rules.

## Gate results (verbatim — run before handoff)

See self-verify section in final handoff report.

## Status

Ready for QA verification on Staging URL. Not committed (handoff-only).
