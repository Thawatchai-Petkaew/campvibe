<!--
ticket: CAM-354
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold) (CAM-22)
feature: Data & Trust
status: Draft (proposed for G1/G2)
version: v1
spec-class: FULL (M) — camper-facing UI story: a NEW interactive client component (PanoramaViewer)
  on the public camp-detail spot gallery + a G2 dependency evaluation. Multi-file surface
  (CampgroundDetailClient + new component + locales) and a hard-to-reverse "which viewer library"
  call → separate spec + full G2 tap. NOTE: the evaluation CONCLUDED zero new npm dependency for v1
  (a pan-strip, see tech.md) — that does NOT downgrade the class; the new interactive component +
  the dependency decision keep it M.
persona: Camper
-->

## Story
As a **Camper**, I want to open a spot's panorama photo in a viewer I can pan across, so that I can explore the wide view of a campsite spot before I book — instead of the panorama opening as a static image I cannot scan.
Why: CAM-352 shipped the `Image.kind = PANORAMA` marker and CAM-353 surfaced spot photos on the public detail page, where a panorama today shows a `พาโนรามา` badge but still opens in the FLAT lightbox (CAM-353 BR-5 explicitly deferred the interactive viewer to this ticket). Owner intent (2026-07-04): "Spot จะมีการเก็บรูปแยกไว้ display อยู่ที่หน้า Detail. Maybe 360° from iPhone" then "เอาแน่ วางโครงสร้างไว้เลย". iPhone panoramas are wide flat JPEGs (partial, aspect ~2:1..~10:1), NOT full spheres — the viewer must pan a strip, not project a sphere.
Scope: the public camp-detail spot gallery only (`components/CampgroundDetailClient.tsx`, the CAM-353 section). A PANORAMA thumbnail gains a distinguishing pan affordance and opens a new pan viewer; a PHOTO thumbnail keeps the existing flat lightbox path byte-for-byte. Client-only, lazy-loaded. NO schema change, NO migration, NO new endpoint, NO new fetch — `Image.kind` already rides the detail payload.
Depends on: CAM-352 (`Image.kind`, MERGED) · CAM-353 (spot galleries + `พาโนรามา` badge on the detail page, MERGED) · CAM-358 (`imageUrlValue` URL contract, MERGED). Design decision: tech.md (dependency evaluation + D1/D2).

## AC
<!-- Then = user-visible (verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A spot gallery on the detail page with a photo the host marked panorama (`Image.kind = PANORAMA`) | Camper taps that thumbnail | A full-screen panorama viewer opens showing the wide image, with the hint `ลากหรือเลื่อนเพื่อดูภาพ` | The pan-viewer module loads on demand (dynamic import) and renders the same image URL; the flat lightbox does NOT open | EC-1 |
| AC-2 | A spot gallery with a regular photo (`Image.kind = PHOTO`, the default) | Camper taps that thumbnail | The existing full-screen photo viewer opens (`ดูรูปภาพ`), exactly as today — no panning | Routes to the existing `ImageGallery`; the pan-viewer module never loads | EC-2 |
| AC-3 | A PANORAMA thumbnail in the spot gallery | Camper looks at the thumbnail before tapping | Sees the `พาโนรามา` badge and a pan icon signalling it opens a wide view | Affordance driven by `img.kind === 'PANORAMA'`; text + icon, not color alone | EC-2 |
| AC-4 | The panorama viewer is open on a wide image | Camper drags/swipes horizontally, or focuses the image and presses the arrow keys | The image pans left and right across its full width | Native horizontal scroll of the strip; no sphere projection, no distortion | EC-3 |
| AC-5 | The panorama viewer is open | Camper presses Escape, taps the close control, or taps the dark area outside the image | The viewer closes | Overlay unmounts; focus returns to the thumbnail that opened it | EC-5, EC-7 |
| AC-6 | A PANORAMA photo whose URL fails to load | Camper opens that photo in the viewer | Sees the standard image placeholder inside the viewer, still closable — no broken-image box, no crash | `ImageWithFallback` fallback path renders inside the viewer | EC-4 |
| AC-7 | Camper's device has `prefers-reduced-motion` set | Camper opens the panorama viewer | The viewer opens with no motion/auto-pan animation; manual panning still works | Any open/drift animation gated behind `no-preference` | EC-6 |

## Rules
- BR-1 **Kind branch (no change to the PHOTO path).** The spot-thumbnail click handler branches on the per-image `img.kind` that already rides the detail payload (CAM-352 `include: { images }`, surfaced by CAM-353 BR-2): `PANORAMA` opens the new `PanoramaViewer`; `PHOTO` (default) keeps calling `openSpotGallery(...)` unchanged. The PHOTO experience must stay byte-for-byte identical. (proves AC-1, AC-2)
- BR-2 **Pan a strip, never project a sphere.** The viewer renders the image at its true pixels inside a horizontally-scrollable container — the image's height fits the viewport, its width overflows and scrolls. NO equirectangular / spherical projection, NO `haov`/`vaov`. Rationale: a plain iPhone Pano is a wide flat JPEG with no GPano/XMP projection metadata; wrapping it on a sphere distorts it, whereas a horizontal pan is exactly what the photo is. Any aspect from ~2:1 to ~10:1 is just a wider scroll region. (proves AC-1, AC-4) Refs: tech.md D1.
- BR-3 **Lazy-load, zero First-Load-JS impact.** `PanoramaViewer` is a `dynamic()` client import, loaded only when a PANORAMA thumbnail is first opened. It is NEVER in the detail route's initial bundle, and never loads for a spot whose images are all PHOTO. Its own loading state = a module spinner shown immediately (loading matrix: isolated module/widget → spinner immediate). (proves AC-1, EC-2)
- BR-4 **Affordance — icon + badge, never color alone.** A PANORAMA thumbnail keeps the existing `พาโนรามา` badge (`spotManagement.panoramaBadge`) and adds a lucide pan icon (proposed `MoveHorizontal`; `Orbit`/`ScanEye` are alternates — designer's final pick) so the affordance reads as "opens a wide, scannable view." The clickable thumbnail carries `aria-label` = `เปิดภาพพาโนรามา`. (proves AC-3)
- BR-5 **a11y — a real modal.** The viewer is `role="dialog"` + `aria-modal="true"` + `aria-label` = `ภาพพาโนรามา`; Escape, a close control (`h-11 w-11`, `aria-label` = `ปิดภาพพาโนรามา`), and a backdrop tap all close it and restore focus to the originating thumbnail; the scroll region is keyboard-pannable (Tab to focus, ArrowLeft/ArrowRight pan) and shows the text hint `ลากหรือเลื่อนเพื่อดูภาพ`; the loading region is `role="status"` + `aria-live="polite"` with `กำลังโหลด…`. (proves AC-4, AC-5, AC-7, EC-7)
- BR-6 **Reduced-motion.** Any open/auto-pan animation is gated behind `@media (prefers-reduced-motion: no-preference)`. Under `reduce` the viewer opens statically and only manual pan works. (proves AC-7)
- BR-7 **Graceful image failure.** A failed panorama URL degrades to the existing `ImageWithFallback` placeholder inside the viewer; the viewer never crashes or shows a raw broken-image box, and stays closable. (proves AC-6)
- BR-8 **Scrim idiom, not a token violation.** The full-screen dark scrim reuses the existing `ImageGallery` photo-viewer idiom (`bg-black/95`, exempt per `DESIGN.md` F3); `text-white` over the image is the approved overlay idiom (`DESIGN.md` §2). No hardcoded palette outside that exemption. (proves AC-1)
- BR-9 **Copy is the contract (designer confirms final polish).** New viewer strings: hint `ลากหรือเลื่อนเพื่อดูภาพ`, dialog title `ภาพพาโนรามา`, open aria-label `เปิดภาพพาโนรามา`, close aria-label `ปิดภาพพาโนรามา`, loading `กำลังโหลด…` (reused). All live in `locales/translations.json` (TH + EN), never hardcoded; no em-dash separator, no technical jargon (`DESIGN.md` §4). QA asserts the exact Thai glyphs. (proves AC-1, AC-4, AC-5)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF a PANORAMA thumbnail is tapped THEN the pan viewer opens (not the flat lightbox), showing the wide image and the `ลากหรือเลื่อนเพื่อดูภาพ` hint (BR-1, BR-2)
- EC-2 IF a spot's images are all `PHOTO` THEN no pan affordance renders and the `PanoramaViewer` chunk is never downloaded (BR-1, BR-3, BR-4)
- EC-3 IF a "panorama" image is actually narrower than the viewport (aspect below the viewport ratio) THEN it renders centered with no horizontal overflow and panning is an inert no-op — no scroll jitter, no empty gutter drift (boundary case) (BR-2)
- EC-4 IF the panorama image URL fails to load THEN the `ImageWithFallback` placeholder shows inside the viewer and it stays closable — never a broken-image box (BR-7)
- EC-5 IF the camper presses Escape or taps the close control THEN the viewer unmounts and focus returns to the originating thumbnail (BR-5)
- EC-6 IF `prefers-reduced-motion` is set THEN no auto-pan/motion animation plays; manual pan still works (BR-6)
- EC-7 IF the camper taps the dark backdrop outside the image THEN the viewer closes, mirroring the existing `ImageGallery` backdrop behavior (BR-5)

## Data
- **Read-only. NO schema change. NO migration.** Every field already exists: `Spot.images -> Image` (`url`, `alt`, `kind = PHOTO | PANORAMA`, `sortOrder`) — all shipped by CAM-352. Classification: `[Public]`.
- `Image.kind` already rides the public detail payload at runtime via `getCampBySlug`'s `spots: { include: { images: … } }` (full rows, CAM-353 BR-2) — this story consumes that value, it does not add or move a field.
- No new endpoint, no new fetch surface: the viewer renders the SAME `img.url` the flat gallery already renders, already validated by `imageUrlValue` (CAM-358).
- migration: none.

## Seams & refs
- Reuse (edit/add): `components/CampgroundDetailClient.tsx` (branch the existing spot-thumbnail `onClick` on `img.kind` — the code already reads `img.kind` at the gallery map, ~line 830/847; add the pan icon there) · NEW `components/PanoramaViewer.tsx` (the pan-strip client component, `dynamic()`-imported) · `components/ImageGallery.tsx` (UNCHANGED — the PHOTO path) · `components/ui/image-with-fallback.tsx` (image + fallback inside the viewer) · `components/ui/badge.tsx` (the existing `พาโนรามา` badge) · `lucide-react` (pan icon — `MoveHorizontal`/`Orbit`/`ScanEye`) · `locales/translations.json` (new viewer copy under `gallery.*` or a new `panorama.*` namespace, TH + EN).
- Do NOT change: `prisma/schema.prisma` (`Image.kind` exists) · any `app/api/*` route (kind rides the existing payload) · `lib/catalog-cache.ts` `getCampBySlug` (CAM-353 already extended the include) · the `ImageGallery` props/behavior (the PHOTO path stays identical).
- Refs: tech.md (dependency evaluation + D1/D2) · CAM-352 (`Image.kind`) · CAM-353 (spot galleries + badge) · CAM-358 (`imageUrlValue`). Pointers only — no implementation here.

## Out of scope
- True equirectangular / spherical 360 projection for GPano/XMP-tagged images → follow-up sphere-viewer story (tech.md pre-selects **pannellum**, standalone, no three.js).
- Gyroscope / device-orientation / VR mode → follow-up (needs `Permissions-Policy: gyroscope`, currently disabled).
- Panorama-in-the-camp-hero-gallery (this story is the SPOT gallery only) → follow-up if the owner wants it.
- Panorama capture guidance / "how to shoot a pano" help → not a viewer concern.
- Hotspots / annotations / linked scenes on the panorama → out.
- Auto-pan / drift-on-open motion polish → optional future (kept out to avoid a motion-a11y surface in v1).

## Self-verify
- AC-1..7 → integration (kind-branch render + dynamic-import boundary) + a11y test (keyboard pan / Escape / reduced-motion) + owner-verify (browser: open a PANORAMA spot photo, pan it, on desktop AND mobile touch, on the real Staging URL).
- Story-specific: the `PanoramaViewer` chunk is NOT in the detail route's initial JS (lazy proven) · the PHOTO click path is unchanged (regression) · the image-failure fallback path · the reduced-motion path · a narrower-than-viewport "panorama" (EC-3).
- Gate = /quality-gate (lint · typecheck · test ≥80% new code · build · design gate — loading state + a11y are gate items) · Done = every AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-05) — created. G1/G2 pass for the interactive spot-photo panorama viewer: kind-branch on the CAM-353 gallery, pan-strip (not sphere) for partial iPhone panos, lazy dynamic import (zero First-Load-JS delta), a11y modal + reduced-motion + graceful failure. Dependency evaluation → zero new npm dependency for v1 (tech.md); real sphere viewer deferred to a follow-up with pannellum pre-selected.
