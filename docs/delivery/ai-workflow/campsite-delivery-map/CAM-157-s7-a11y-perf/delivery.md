# CAM-157 (S7) — Delivery Record

## Status

Branch: `feature/cam-157-status-map-a11y-perf` — build + self-verify complete. No git commit made (per task instruction).

## Quality gate results (self-verify)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors · 224 pre-existing warnings (unchanged) |
| `npm run typecheck` | Clean (0 errors) |
| `npm test` | 2309 passed (2282 pre-S7 + 27 new S7 tests) |
| `npm run build` | Success |
| `npm run check:palette` | PASS — 0 violations |

## Performance budget (AC6) — MEASURED

Build environment: Next.js 16.2.9 (Turbopack), local macOS.

### Route: `/status/map`

The Turbopack build does not print per-route "First Load JS" in its console output. Bundle sizes measured directly from `.next/static/chunks/` using `gzip -c | wc -c`.

**Entry chunks (loaded on initial page load):**

| Chunk file | Raw size | Gzip |
|---|---|---|
| `1-9iwb0z_f13c.js` | 5.7KB | 2.4KB |
| `2-f1k9b-9ks24.js` | 58KB | 15.8KB |
| `2nzpd566_u8re.js` | 41KB | 12.3KB |
| `1ntn7efqc-iiw.js` | 53KB | 12.9KB |
| `2pzh-e2bzvgxc.js` (scene-loader) | 3.7KB | 1.6KB |
| **Total entry** | **~161KB** | **~45KB** |

**Dynamically loaded chunks (lazy, loaded after hydration — `dynamic ssr:false`):**

| Chunk | Gzip | Contents |
|---|---|---|
| `1k3g43kbbb1ve.js` (scene + overlays) | ~10.8KB | campsite-scene + campsite-overlays |
| `1b4ww3gsrdz9b.js` (engine + deps) | ~7.3KB | campsite-engine + status-derive |
| **Total lazy** | **~18KB** | — |

**Grand total (entry + lazy):** ~162KB raw / **~63KB gzipped** — well under the 200KB budget.

Note: the chunks shared with other routes (2-f1k9b, 2nzpd566, 1ntn7efqc) are shared framework/vendor code that the browser likely has cached after visiting any other route. The route-specific incremental cost is ~1.6KB gzipped (scene-loader entry) + ~18KB gzipped (lazy scene) = ~20KB.

### Sprites (`public/status-map/sprites/`)

All sprites measured — all under 200KB budget:

| File | Size |
|---|---|
| relax-0.webp | 15.9KB |
| relax-1.webp | 15.1KB |
| relax-2.webp | 13.7KB |
| relax-3.webp | 12.3KB |
| relax-4.webp | 11.7KB |
| relax-5.webp | 13.0KB |
| walk-back-left-0.webp | 11.7KB |
| walk-back-left-1.webp | 11.7KB |
| walk-back-right-0.webp | 12.4KB |
| walk-back-right-1.webp | 11.2KB |
| walk-front-left-0.webp | 12.9KB |
| walk-front-left-1.webp | 12.0KB |
| walk-front-right-0.webp | 12.5KB |
| walk-front-right-1.webp | 12.1KB |
| you.webp | 18.1KB |
| **Max sprite** | **18.1KB** — under 200KB |

### Core Web Vitals

LCP, CLS, INP: **not measured** (requires Lighthouse/web-vitals on the real Staging URL in a browser session). No numbers fabricated.

Potential CWV risks (not measured):
- CLS risk: the scene uses absolute positioning + CSS `transform:translate(-50%,-100%)` — no layout shift expected as elements are positioned out of normal flow. Risk: Low.
- LCP risk: the night background is CSS-only (no `<img>` LCP candidate). Main text content is the placeholder/error state. Risk: Low.
- INP risk: rAF loop writes DOM style properties at 60fps — measured only during the walk animation (entering state ~2s). Under reduced-motion: no rAF, no INP risk. Risk: Low / not measured.

## A11y additions summary (AC2)

| Addition | Where |
|---|---|
| `role="img"` + computed `aria-label` | `.map-stage` (stage div) |
| `<button>` with `aria-label` + `min-width/height:44px` | Each `AgentScout` (7 agents) |
| `<button>` with `aria-label` + `min-width/height:44px` | `YouScout` |
| Tab order: You first in DOM | DOM order changed — `<YouScout>` before `{agents.map(...)}` |
| Keyboard-triggerable: agent click opens Crew panel | `onActivate` → `openPanel("crew")` |
| `role="status"` + `aria-live="polite"` | Loading placeholder |
| `data-testid` on error container | QA assertion target |

## Remaining browser-only risks

The following were not and cannot be verified in automated tests or build output. QA must verify on the real Staging URL:

- **Critical for AC2:** VoiceOver/NVDA announcement of `role="img"` scene label
- **Important for AC2:** axe contrast check for rm-label status pills (teal/amber text on dark panel)
- **Important for AC1:** OS reduced-motion toggle in a real browser shows rm-labels and hides animations
- **Not measured / potential risk:** LCP/CLS/INP (Core Web Vitals) — require field measurement
