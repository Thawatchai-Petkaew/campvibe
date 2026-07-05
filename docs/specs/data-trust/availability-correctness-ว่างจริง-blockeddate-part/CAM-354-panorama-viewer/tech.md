---
ticket: CAM-354
feature: Data & Trust
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold) (CAM-22)
persona: Camper
artifact: tech
owner: architect
status: Draft — G2 design pass (interactive panorama viewer + dependency decision)
version: v1
updated: 2026-07-05
---
# Tech — Spot-photo panorama viewer + dependency decision (CAM-354)

> Scope of THIS artifact: the **G2 Technical dimension** for the interactive spot-photo panorama
> viewer — the dependency evaluation + decision, the component boundary + lazy-load architecture,
> the partial-panorama (iPhone) handling contract, the CSP/security assessment, the perf-budget math,
> and the test plan `backend`/`frontend` build against. This is a **docs-only** design hand-off:
> NO `package.json` change, NO code, NO migration was written — the build story installs anything and
> writes the component. `Image.kind` (the data) already shipped in CAM-352; there is no data-model or
> API change in this ticket (confirmed against `prisma/schema.prisma` `model Image` + `getCampBySlug`).

---

## 0. Headline decision (the one recommendation)

**Ship the panorama viewer with ZERO new npm dependency in v1: an in-house horizontal pan-strip
viewer** (candidate 4). Defer a true WebGL sphere viewer to a follow-up; if/when GPano-tagged
equirectangular 360s are actually validated, the pre-vetted follow-up library is **pannellum**
(standalone, no three.js) — NOT Photo Sphere Viewer.

**Why (one paragraph).** A plain iPhone Pano is a wide *flat* JPEG with no GPano/XMP projection
metadata — every WebGL viewer (Photo Sphere Viewer, pannellum, view360) projects the image onto a
sphere, which *distorts* a photo that was never captured as one, while a horizontal pan across the
strip is *exactly* what the photo is. The pan-strip needs no dependency (0 KB added, **0 First-Load-JS
delta**, no CSP/worker/CORS cost, native keyboard + touch + reduced-motion a11y), whereas the lightest
sphere viewer still ships a **~50–210 KB gzipped** lazy WebGL chunk *and* models the iPhone-pano case
wrong. A real sphere viewer only earns its cost once genuine equirectangular 360s exist — so it is a
follow-up, not v1. The dispatch's own decision rule ("weigh whether a real sphere viewer is even
needed for v1 vs the pan-strip fallback with a follow-up") lands here decisively.

---

## 1. Dependency evaluation (adversarial — the core of this spec)

### 1.1 Metric honesty note

- **Registry facts below are MEASURED** this session via `npm view <pkg> version license
  peerDependencies dependencies dist.unpackedSize time.modified` against the live npm registry
  (mid-2026). `unpackedSize` = the published tarball unpacked (authoritative), NOT the gzipped
  browser bundle.
- **Gzipped-runtime figures are ESTIMATES** from published bundlephobia-class figures / prior
  knowledge — I could **not** reach bundlephobia or run a per-library `ANALYZE=1` build this session
  (docs-only; the libs are not installed, as required). They are labelled *(est.)* and given as
  ranges. The build story must confirm the real chunk size with `ANALYZE=1 npm run build` before it
  relies on any exact number.
- The detail route's own First-Load JS is reported honestly in §5 (the Next 16 Turbopack build
  **omits the size table**, so it is stated `not reliably measured` with the reason).

### 1.2 Candidates + measured registry facts

| Candidate | Version (measured) | License (measured) | Peer/deps (measured) | Unpacked pkg (measured) | Last modified (measured) |
|---|---|---|---|---|---|
| 1. `@photo-sphere-viewer/core` (PSV v5) | 5.14.3 | MIT | dep `three@^0.184.0` | 1.46 MB (+ `three` 23.2 MB) | 2026-06-25 (active) |
| 2a. `pannellum` (standalone) | 2.5.7 | MIT | none (self-contained WebGL) | 780 KB | 2026-02-19 (active) |
| 2b. `react-pannellum` (wrapper) | 1.1.2-**alpha**.1 | MIT | peer react 18/19 | 254 KB | 2026-04-05 (alpha, single-maintainer) |
| 3. `@egjs/view360` (Naver egjs) | 3.6.4 | MIT | `gl-matrix`, 4×`@egjs/*`, `promise-polyfill` | 6.0 MB | 2025-10-24 (~9 mo stale) |
| 4. **In-house pan-strip** (zero-dep) | n/a | n/a (our code) | none | 0 | owned in-repo |

### 1.3 Scorecard (against the dispatch's criteria)

Legend: ✅ strong · ⚠️ caveat · ❌ blocker-class for our case.

| Criterion (weight for CampVibe) | 1. PSV + three | 2. pannellum (+alpha wrapper) | 3. @egjs/view360 | 4. **Pan-strip (rec.)** |
|---|---|---|---|---|
| **gzip runtime added, LAZY chunk** *(est.)* vs 200 KB/route budget | ❌ ~170–210 KB gz (three subset ~130–160 + PSV ~40) — the *entire* route budget in one lazy chunk | ⚠️ ~50–58 KB gz (no three) | ⚠️ ~60–75 KB gz (+ gl-matrix) | ✅ **~0** (few hundred bytes, shares React; itself lazy) |
| **partial iPhone pano** (flat strip, no XMP) | ❌ needs `panoData`/XMP crop; a plain iPhone pano has NO GPano XMP → sphere stretches it | ⚠️ `haov`/`vaov`/`vOffset` first-class, but still projects a flat photo onto a partial sphere (wrong model) | ⚠️ equirect/cubemap-oriented; partial support weaker | ✅ **native** — a wide strip IS a horizontal pan; zero distortion, any aspect ~2:1..~10:1 |
| **CSP / CORS cost** (see §4) | ❌ may need `worker-src blob:` (absent today); WebGL texture from cross-origin blob host needs CORS-clean or the canvas taints | ⚠️ WebGL texture CORS concern; no worker typically | ⚠️ WebGL similar | ✅ **none** — reuses the existing `<img>` (`img-src` already allows it) |
| **a11y** (keyboard pan, reduced-motion) | ⚠️ WebGL canvas — keyboard + reduced-motion hand-wired | ⚠️ same | ⚠️ same | ✅ native scroll = keyboard-accessible; reduced-motion trivial |
| **maintenance** (measured) | ✅ active (2026-06-25) | ⚠️ core active; **wrapper alpha** (would hand-roll) | ❌ ~9 mo stale (2025-10-24) | ✅ owned in-repo |
| **SSR / Next 16 App Router** | ⚠️ client-only, `dynamic({ssr:false})` mandatory (touches `window`) | ⚠️ same | ⚠️ same | ✅ trivially client-only |
| **touch / gyro mobile UX** | ✅ drag + gyro | ✅ drag + gyro | ✅ drag | ⚠️ drag/scroll native; **no gyro** (out of scope this ticket) |
| **npm audit surface** | ❌ three + PSV transitive | ⚠️ pannellum + alpha wrapper | ❌ gl-matrix + 4×egjs + promise-polyfill | ✅ none |
| **license** | ✅ MIT | ✅ MIT | ✅ MIT | ✅ our code |

**Read of the table.** For CampVibe's *actual* input — an iPhone wide-strip pano — the three WebGL
options are all paying a real download + a CSP/CORS/a11y integration cost to *misrepresent* the photo
(sphere projection of a non-spherical image). The pan-strip is both the cheapest AND the most correct
for v1. The one thing a sphere viewer buys (immersive 360 for a *true* equirectangular capture) is not
what an iPhone Pano is, so it is deferred until that input actually exists.

### 1.4 Rejected alternatives (MADR)

- **REJECT 1 — Photo Sphere Viewer + three.js.** Best-maintained and best UX *for real 360s*, but
  `three` is a hard peer dependency; even a tree-shaken subset is *(est.)* ~130–160 KB gz, so the lazy
  chunk is ~170–210 KB gz — it consumes the whole per-route budget in a single chunk (`performance.md`
  §2). It also needs the most CSP/CORS work (§4) and still cannot render a metadata-less iPhone strip
  correctly. Wrong tool for v1's input at the highest cost. *(If a true-360 need is later validated and
  the projected chunk is acceptable, PSV is the premium option — but pannellum wins on size, see below.)*
- **REJECT 2 — pannellum (+ react-pannellum).** Standalone (no three.js), MIT, actively maintained,
  and — decisively for a *future* sphere story — it has **first-class partial-panorama config**
  (`haov`/`vaov`/`vOffset`) which is the cleanest fit for a *tagged* partial equirectangular. Rejected
  **for v1** only because (a) it still projects a flat iPhone strip onto a sphere (distortion), and
  (b) `react-pannellum` is `1.1.2-alpha.1`, single-maintainer — we would hand-roll a thin
  dynamic-import wrapper around vanilla `pannellum` rather than depend on the alpha. **This is the
  pre-selected library for the sphere-viewer FOLLOW-UP** (recorded as D2 + Open trade-off OT-2).
- **REJECT 3 — @egjs/view360.** Larger install (6 MB unpacked), an extra `gl-matrix` + 4×`@egjs/*` +
  `promise-polyfill` dependency chain, ~9-months stale (2025-10-24), and equirect/cubemap-oriented
  with weaker partial support. Highest audit surface, weakest maintenance signal, no compensating
  advantage over pannellum. Rejected outright.

---

## 2. Chosen architecture — the in-house pan-strip viewer

### 2.1 Component boundary + lazy-load (mandatory constraint honored)

```
CampgroundDetailClient ("use client", already loaded on the detail route)
  └─ spot gallery thumbnail (CAM-353 section, ~line 828–859)
       onClick → branch on img.kind
         ├─ 'PHOTO'     → openSpotGallery(spotImages, i)   // EXISTING flat ImageGallery — unchanged
         └─ 'PANORAMA'  → open <PanoramaViewer url={img.url} />
                             ▲ dynamic(() => import('@/components/PanoramaViewer'), { ssr: false })
```

- **`PanoramaViewer` is a NEW client component, `dynamic()`-imported with `ssr:false`.** It is loaded
  ONLY when a PANORAMA thumbnail is first opened — never in the detail route's initial bundle, never
  downloaded for a spot whose images are all PHOTO. This satisfies the dispatch's non-negotiable
  ("lazy-load ONLY when a panorama image is opened … never in the route's initial bundle").
- **Boundary intact:** client component → renders the SAME `img.url` via `<ImageWithFallback>` (which
  wraps `next/image`). No DB, no API, no server call added. The viewer is a pure presentational leaf.
- **State:** reuse the existing `CampgroundDetailClient` state pattern — add a `panoramaUrl:
  string | null` (open when non-null), mirroring how `galleryImages`/`isGalleryOpen` already work
  (lines 62–67). One viewer instance, opened with a URL; no prop-drilling.

### 2.2 Where it mounts + the affordance

- **Mount point:** the CAM-353 spot gallery in `components/CampgroundDetailClient.tsx`. The map at
  ~line 830 already exposes `img.kind`; the click handler at ~line 836
  (`onClick={() => openSpotGallery(spotImages, i)}`) becomes a `kind` branch (BR-1). The existing
  `พาโนรามา` `<Badge variant="overlay">` at ~line 847 stays.
- **Affordance (BR-4):** on a PANORAMA thumbnail, add a lucide pan icon overlay in addition to the
  existing badge, so the thumbnail *reads* as "opens a wide, scannable view", and set the button's
  `aria-label` = `เปิดภาพพาโนรามา`. Icon: **`MoveHorizontal`** (verified present:
  `node_modules/lucide-react/dist/esm/icons/move-horizontal.js`) — it matches the actual pan
  interaction. Alternates for the designer: `Orbit`, `ScanEye`, `Expand` (all verified present).
  `Panorama` is NOT in this lucide version — do not reach for it. lucide-only per `DESIGN.md` §7;
  never an emoji.
- **PHOTO path is untouched:** a `PHOTO` (default) thumbnail keeps the existing `openSpotGallery`
  flat-lightbox path byte-for-byte (BR-1, AC-2). No change to `components/ImageGallery.tsx` props or
  behavior.

### 2.3 Partial-panorama handling contract (the iPhone case — load-bearing)

The rule is: **render the image at its true pixels; pan horizontally; never project.**

- The viewer places the image inside a horizontally-scrollable container: the image's **height = the
  viewport height** (bounded to the scrim padding), its **width = auto** (natural aspect), so a wide
  strip **overflows horizontally and scrolls**. There is NO sphere, NO equirectangular unwrap, NO
  `haov`/`vaov`/`vOffset`, NO WebGL, NO canvas.
- **Why this is correct for the iPhone case:** a plain iPhone Pano carries no GPano/XMP projection
  metadata (unlike Google "Photo Sphere" captures), so its horizontal FOV is unknown — you cannot
  correctly map it to sphere angles. A pan across the flat strip needs no angle metadata and shows the
  photo exactly as shot. Aspect ratios from ~2:1 to ~10:1 are simply wider scroll regions; the contract
  is aspect-agnostic.
- **Boundary case (EC-3):** if the "panorama" is actually *narrower* than the viewport (aspect below
  the viewport ratio — e.g. a near-square mis-marked image), it renders centered with no horizontal
  overflow; panning is an inert no-op (no scroll jitter, no empty gutter). The container must clamp,
  not force-scroll.
- **Interaction:** native horizontal scroll — drag/swipe (touch + pointer), `overflow-x: auto`, and
  keyboard `ArrowLeft`/`ArrowRight` panning when the scroll region is focused (native for a focusable
  scroll container; ensure `tabindex="0"` + an `aria-label`). No custom momentum/inertia physics in v1.

### 2.4 Loading state (per `.claude/rules/loading.md` decision matrix)

- A viewer dialog opened by a user action over a single async image = **"isolated module/widget →
  spinner, shown immediately"** (matrix row). Use `components/ui/loading-spinner.tsx` while the image
  decodes; `<ImageWithFallback>` already owns its own load/fallback lifecycle, so the spinner is the
  overlay-level "opening…" indicator.
- **No progress bar / no `>10s` determinate treatment:** it is the SAME already-optimized image the
  flat lightbox loads (`next/image`, 31-day cache, webp) — not a fresh multi-MB asset. If field data
  later shows very large pano files routinely exceeding ~10 s to load, revisit a determinate bar — but
  do not pre-build it (Lean; `loading.md` "> ~10s OR determinate → progress+cancel" is not met by a
  cached, optimized image). Stated as an assumption, not a measured fact.
- **NOT a skeleton, NOT a full-page loader:** the viewer is a section-level modal over the detail
  page; the detail chrome stays. A skeleton would have no layout to mirror (a full-bleed image) — the
  spinner is correct (`loading.md` §3 full-screen-canvas guidance: progress indicator, never a
  skeleton, for a canvas-like surface).

### 2.5 Accessibility contract (BR-5, BR-6)

- `role="dialog"` + `aria-modal="true"` + `aria-label` = `ภาพพาโนรามา` on the overlay.
- Close on: Escape, a close button (`h-11 w-11`, `aria-label` = `ปิดภาพพาโนรามา`, lucide `X`), and a
  backdrop tap (EC-7) — all restore focus to the originating thumbnail.
- The scroll region is keyboard-pannable (`tabindex="0"`, arrow keys) and carries the visible hint
  `ลากหรือเลื่อนเพื่อดูภาพ` (also its accessible description).
- Loading region: `role="status"` + `aria-live="polite"` + `กำลังโหลด…`.
- `prefers-reduced-motion`: any open/auto-pan animation is gated behind
  `@media (prefers-reduced-motion: no-preference)`. v1 ships NO auto-pan (kept out to shrink the motion
  surface), so under `reduce` the only difference is the open transition is disabled — manual pan
  always works.
- Reuse the proven scrim idiom from `components/ImageGallery.tsx` (`bg-black/95`, `role="dialog"`,
  `aria-modal`, Escape handler, backdrop click) — do NOT hand-roll a second modal pattern.

---

## 3. Data model + API contract — NO CHANGE (confirmed against the repo)

- **Schema:** none. `enum ImageKind { PHOTO PANORAMA }` + `Image.kind ImageKind @default(PHOTO)`
  already exist (`prisma/schema.prisma`, CAM-352). No new field, no migration, `npx prisma validate`
  is a no-op for this ticket. Classification of `kind` = `[Public]` (a photo's medium is not
  PII/Financial/Geo) — unchanged.
- **API / read path:** none. `Image.kind` already rides the public detail payload at runtime via
  `getCampBySlug` (`lib/catalog-cache.ts`) → `spots: { include: { images: … } }` (full rows,
  CAM-353 BR-2). The `CampgroundDetailClient` already reads `img.kind` (verified at ~line 830/847).
  No new endpoint, no new fetch, no response-shape change. `types/api.ts` `SpotDTO.images[].kind?`
  already exists (CAM-352). Nothing to record in `schema/api-schema.json`.
- **Traceability (AC → design):** AC-1/AC-2 → the `img.kind` branch in the click handler (existing
  Pixel, no new field) · AC-3 → the affordance bound to `img.kind === 'PANORAMA'` · AC-4/EC-3 → the
  pan-strip container contract (§2.3) · AC-5/EC-5/EC-7 → the modal close paths (§2.5) · AC-6/EC-4 →
  `ImageWithFallback` inside the viewer · AC-7/EC-6 → the reduced-motion gate. **No orphan design
  element** (nothing maps to no AC) and **no orphan AC** (every AC has a design element). Authz: N/A —
  the detail page and its spot photos are already `[Public]` (no endpoint added, nothing to gate).

---

## 4. Security / CSP assessment (`.claude/rules/security.md`)

Checked the live CSP in `proxy.ts` (`buildCsp`, Next 16 renamed `middleware.ts` → `proxy.ts`):

```
default-src 'self'
script-src 'nonce-{n}' 'strict-dynamic' 'unsafe-inline' https:   (+ 'unsafe-eval' dev-only)
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org https://*.googleusercontent.com
font-src 'self'
connect-src 'self' https://*.tile.openstreetmap.org
media-src 'self'  ·  object-src 'none'  ·  frame-ancestors 'none'  ·  base-uri 'self'  ·  form-action 'self'
```

- **The pan-strip needs ZERO CSP change.** It renders the same `<img>` the flat gallery already shows;
  `img-src` already allows `'self'` (root-relative `/uploads/*`), `blob:`, `data:`, and the Vercel blob
  host. No worker, no WebGL, no canvas, no `fetch()` for the image bytes → `worker-src`/`connect-src`
  are untouched. `'strict-dynamic'` already trusts the nonce'd Next runtime that loads the dynamic
  import chunk — so `dynamic(() => import('@/components/PanoramaViewer'))` runs cleanly under the
  strict nonce CSP.
- **No new fetch surface (dispatch requirement):** the image URL is the same `img.url` already
  validated by `imageUrlValue` (`lib/validations/image.ts`, CAM-358 — rejects protocol-relative,
  backslash, and control-char open-redirect bypasses) and already rendered on the page. This ticket
  adds no URL input, no external origin, no SSRF surface.
- **Contrast — the cost a WebGL viewer would add (recorded for the follow-up):** (a) `worker-src` is
  currently **unset**, so it falls back to `default-src 'self'` — a viewer that spawns a `blob:` Web
  Worker would be **blocked** until CSP adds `worker-src blob:`; (b) a WebGL texture uploaded from a
  **cross-origin** blob-host image needs a CORS-clean response (`crossOrigin="anonymous"` + the host
  returning `Access-Control-Allow-Origin`) or the canvas **taints** and the draw throws — a real
  integration cost the pan-strip avoids entirely. These belong to the sphere-viewer follow-up's
  security review, flagged here so they are not discovered late.
- **STRIDE:** no new Spoofing/Tampering/Repudiation/Info-disclosure/DoS/Elevation surface — no auth,
  no mutation, no secret, no new input. Client-only presentational leaf over already-public data.

---

## 5. Performance-budget math (`.claude/rules/performance.md` — metric honesty)

- **Detail route (`/campgrounds/[slug]`) current First-Load JS: NOT reliably measured this session.**
  I ran `npm run build` (exit 0) but the **Next 16 Turbopack build output omits the per-route
  Size / First-Load-JS table** (0 size columns emitted) and `app-build-manifest.json` is absent, so
  chunks cannot be deterministically attributed to the route without guessing. Reported as
  `not measured` per the honesty rule rather than fabricated. Context measured on disk: the repo's
  `.next/static/chunks` total = **1271 KB gzipped across 104 JS files** (shared across all routes;
  largest single shared chunk 153 KB gz). The build story should get the real per-route number with
  `ANALYZE=1 npm run build` (`.next/analyze/client.html`) before quoting one.
- **First-Load-JS delta from this ticket: ~0 KB.** The recommendation adds **no npm dependency**, and
  `PanoramaViewer` is `dynamic({ssr:false})` — it is code-split into its own chunk that loads only on
  first PANORAMA open. It never enters the route's initial bundle. Even loaded, it is a few hundred
  bytes of DOM/handlers sharing the already-present React runtime.
- **No impact when no panorama exists:** the branch is `img.kind === 'PANORAMA'`; a spot with only
  PHOTO images never triggers the import (EC-2). The common case pays nothing.
- **CWV:** the viewer opens on user action (not initial paint) → no LCP impact; it renders one
  already-optimized `next/image` (webp, 31-day cache) → no new image-weight budget concern; the fixed
  full-screen overlay reserves its own space → no CLS. All stated as reasoned expectations;
  `not measured` until the build story checks on Staging.
- **Contrast (rejected options):** a WebGL viewer would add a lazy chunk of *(est.)* ~50 KB
  (pannellum) to ~210 KB (PSV+three) gz — for PSV, effectively the whole 200 KB/route budget in one
  chunk, downloaded the first time any camper opens any pano.

---

## 6. Test plan (hand-off to `qa` — `.claude/rules/qa.md`)

1. **kind-branch render** — a PANORAMA thumbnail renders the pan affordance (badge + `MoveHorizontal`
   icon, `aria-label` = `เปิดภาพพาโนรามา`) and, on click, opens `PanoramaViewer` (asserts the hint
   `ลากหรือเลื่อนเพื่อดูภาพ`); a PHOTO thumbnail renders no affordance and, on click, opens the existing
   `ImageGallery` (PHOTO path unchanged — regression guard). (AC-1, AC-2, AC-3, EC-2)
2. **dynamic-import boundary** — assert `PanoramaViewer` is NOT in the detail route's initial chunk
   (module-boundary / lazy-import test); it resolves only after a PANORAMA open. (BR-3)
3. **partial-pano contract** — a wide image (e.g. 4:1) overflows horizontally and pans; a
   narrower-than-viewport image (EC-3) renders centered with no overflow and pan is a no-op. (AC-4)
4. **a11y** — keyboard: Tab focuses the scroll region, ArrowLeft/Right pan, Escape closes and restores
   focus to the thumbnail; `role="dialog"`/`aria-modal`/`aria-label` present; loading region
   `role="status"`+`aria-live`. Reduced-motion: with `prefers-reduced-motion: reduce`, no
   motion/auto-pan animation runs; manual pan still works. (AC-4, AC-5, AC-7, EC-5, EC-6, EC-7)
5. **fallback-on-load-failure** — a broken panorama URL shows the `ImageWithFallback` placeholder
   inside the viewer; the viewer stays closable, no crash, no raw broken-image box. (AC-6, EC-4)
6. **copy** — the Thai strings (`ลากหรือเลื่อนเพื่อดูภาพ`, `ภาพพาโนรามา`, `เปิดภาพพาโนรามา`,
   `ปิดภาพพาโนรามา`) assert char-for-char from `locales/translations.json` (TH + EN present). (BR-9)

Design-gate items that block merge (`DESIGN.md` §6): loading state present + correct loader per the
matrix · all 8 states / a11y wired · reduced-motion · tokens only (scrim exemption noted) · lucide-only
icon.

---

## 7. Decisions (MADR-style — recorded here in lieu of full ADRs; each carries a Confirmation)

### D1 — Pan-strip (flat, DOM/CSS) for v1, NOT a WebGL sphere projection
- **Context.** The confirmed input is an iPhone Pano: a wide flat JPEG, partial vertical FOV, aspect
  ~2:1..~10:1, with NO GPano/XMP projection metadata. Owner: "วางโครงสร้างไว้เลย."
- **Decision.** Render the image at true pixels in a horizontally-scrollable container (height = viewport,
  width = auto → horizontal pan). No sphere, no equirectangular unwrap, no WebGL. Zero new dependency.
- **Alternatives rejected.** (a) PSV+three — ~170–210 KB gz lazy chunk (whole budget), CSP/CORS cost,
  and still distorts a metadata-less strip. (b) pannellum sphere — ~50–58 KB gz but same
  flat-onto-sphere distortion for v1's input. (c) view360 — heavier, stale, weaker partial support.
  (All three model the photo as something it is not.)
- **Confirmation.** Tests §6.1/§6.3 assert a PANORAMA opens the pan viewer, a wide image pans, and a
  near-square (EC-3) does not force-scroll; §6.2 asserts the chunk is lazy (0 First-Load delta). The
  "no distortion" property is inherent (no projection math) — nothing to assert beyond "the image is
  drawn 1:1".

### D2 — pannellum pre-selected for the FUTURE sphere-viewer follow-up (NOT PSV, NOT view360)
- **Context.** If genuine equirectangular 360s (GPano-tagged, full or partial with `haov`/`vaov`) are
  later validated, a real projection viewer is warranted.
- **Decision.** Pre-select **vanilla `pannellum`** (standalone, no three.js, MIT, active, first-class
  `haov`/`vaov`/`vOffset` partial-pano config), integrated via a hand-rolled thin
  `dynamic({ssr:false})` wrapper — do NOT depend on `react-pannellum@1.1.2-alpha.1`. Reject PSV (three
  peer = ~170–210 KB gz) and view360 (heavier + stale) on size/maintenance.
- **Alternatives rejected.** PSV (premium 360 UX but three.js budget blow-out); view360 (no
  compensating advantage, worst audit surface + staleness).
- **Confirmation.** N/A in this ticket (a follow-up decision). Recorded so the follow-up starts from a
  vetted default instead of re-litigating. Its CSP delta (`worker-src`? CORS-clean textures?) is
  pre-flagged in §4.

### ADR verdict — NOT a full ADR now (recorded here; ONE open trade-off raised at G2)
Judged against `.claude/rules/architecture.md` §16–17 ("hard-to-reverse OR cross-module"):
- The v1 decision (**add no dependency; pan-strip**) is **easily reversible** — it is additive UI; a
  sphere viewer can be added later without undoing the strip. Not ADR-class on the reversibility axis.
- It is **not** cross-module in the data sense (no schema/API change; `Image.kind` already shipped).
- The genuinely sticky, cross-cutting decision is **the projection model + the WebGL dependency
  justification** — and that only materializes **when the sphere-viewer follow-up is actually built**.
  Manufacturing an `ADR-013` now for a decision to *not* add a dependency is premature (Iron Rule 6 /
  architecture §3 "Lean > complete"), and writing to `docs/adr/*` is **outside this dispatch's stated
  file surface** (STOP RULE 3) — so it is raised as an owner choice below, not written silently.
- **What would flip this:** if the owner wants a durable, cross-cutting home for the "wide-strip vs
  sphere" projection decision *before* the follow-up exists, promote D1+D2 to a one-page
  `ADR-013-panorama-viewer-projection.md` (PROPOSED) in a separate ADR-surface PR — low cost. I judged
  it not yet warranted. **→ OT-1.**

---

## 8. Open trade-offs for the human at G2 (do NOT decide silently)

- **OT-1 — ADR now or at the follow-up?** Record D1+D2 as `ADR-013-panorama-viewer-projection.md`
  (PROPOSED) now, or defer the ADR to the sphere-viewer follow-up (my recommendation: defer — the v1
  call is reversible and adds nothing durable). *Impact:* one small extra ADR-surface PR vs a slightly
  later durable record. Not written here because `docs/adr/*` is outside this dispatch's surface.
- **OT-2 — Is a real sphere viewer even on the roadmap?** If the product only ever ingests iPhone
  wide-strip panos, the pan-strip is the *permanent* answer and there is no follow-up. Confirm whether
  true equirectangular 360 capture is a real near-term intent before committing to pannellum. *Impact:*
  scopes (or cancels) the follow-up ticket.
- **OT-3 — v1 auto-pan drift on open?** I kept it OUT (shrinks the motion-a11y surface; manual pan is
  enough). If the owner wants a gentle auto-pan-to-hint-there-is-more nudge, it is a small add gated
  behind `prefers-reduced-motion: no-preference`. *Impact:* a little delight vs a slightly larger a11y
  test surface. My recommendation: ship without it, add later if wanted.
- **OT-4 — affordance icon.** Proposed `MoveHorizontal` (matches the pan interaction); `Orbit`/`ScanEye`
  read more "immersive/360". Designer's final pick. *Impact:* affordance clarity only.

---

## 9. Out of scope (explicit — with the follow-up pointer)

- True equirectangular / spherical 360 projection for GPano/XMP-tagged images → **sphere-viewer
  follow-up** (pannellum pre-selected, D2).
- Gyroscope / device-orientation / VR mode → follow-up. Note: `next.config.ts` currently sets
  `Permissions-Policy: camera=(), microphone=(), geolocation=()` — it does NOT list `gyroscope`, so
  gyroscope sits at the browser default allowlist (`self`); a gyro viewer should still scope it
  explicitly (`gyroscope=(self)`) and verify. Flagged for the follow-up.
- Panorama in the CAMP-hero gallery (this ticket = the SPOT gallery only).
- Panorama capture guidance / hotspots / annotations / linked scenes.
- Auto-pan / drift-on-open motion (see OT-3).

---

## 10. Confirmation summary (what the build must prove — maps to Self-verify)
1. **Lazy** — `PanoramaViewer` is code-split; not in the detail route's initial chunk; loads on first
   PANORAMA open only (0 First-Load-JS delta). Confirm with `ANALYZE=1 npm run build`.
2. **Kind branch** — PANORAMA → pan viewer; PHOTO → existing `ImageGallery`, unchanged (regression).
3. **Partial-pano** — a wide strip pans with no distortion; a near-square (EC-3) does not force-scroll.
4. **a11y** — keyboard pan + Escape + focus return + reduced-motion + `role/aria` all wired.
5. **Graceful failure** — a broken URL → `ImageWithFallback` placeholder inside the viewer, still closable.
6. **No CSP/dep/schema change** — no `package.json`, `proxy.ts`, or `prisma/schema.prisma` edit needed.

## 11. Links
`story.md` (## AC, BR-1..9, EC-1..7, ## Data) · `prisma/schema.prisma` (`enum ImageKind`, `model Image`) ·
`lib/validations/image.ts` (`imageUrlValue`, CAM-358) · `lib/catalog-cache.ts` (`getCampBySlug`, CAM-353 BR-2) ·
`components/CampgroundDetailClient.tsx` (spot gallery ~L790–864) · `components/ImageGallery.tsx` (the PHOTO path) ·
`proxy.ts` (`buildCsp`) · `.claude/rules/architecture.md` (§10 Resolution Boundary, §16–17 ADR) ·
`.claude/rules/performance.md` (200 KB/route budget) · `.claude/rules/loading.md` (module → spinner) ·
`.claude/rules/security.md` (CSP/SSRF) · CAM-352 tech.md (the `Image.kind` groundwork this builds on).

> Ticket-number reconciliation [Info]: CAM-352's tech.md forward-referenced "CAM-355" as the viewer;
> that numbering drifted — the viewer is **CAM-354** (this ticket) and CAM-355 is per-spot capacity
> enforcement (`docs/specs/.../CAM-355-per-spot-capacity-enforcement/` exists). Reconciled here so the
> stale reference does not confuse a reader.

## Changelog
- v1 (2026-07-05) — created. G2 dependency evaluation (measured npm facts + est. gzip, scorecard,
  MADR rejects for PSV/pannellum/view360) → **zero-dependency pan-strip for v1**, pannellum pre-selected
  for a sphere follow-up (D2). Lazy `dynamic({ssr:false})` architecture (0 First-Load-JS delta),
  partial-iPhone-pano pan contract (no sphere), CSP assessment (no change; WebGL worker/CORS cost
  flagged for the follow-up), perf math (detail route First-Load = not measured; Turbopack omits the
  table — honest), test plan, ADR verdict = defer, 4 open trade-offs raised for G2.
