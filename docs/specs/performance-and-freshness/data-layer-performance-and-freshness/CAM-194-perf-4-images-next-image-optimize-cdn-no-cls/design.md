---
linear: CAM-194
feature: performance-and-freshness
epic: data-layer-performance-and-freshness
persona: Camper, Host, Admin
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-26
---
# Design — PERF-4 Migrate images to next/image, no CLS (CAM-194)

## Flow

This story has no user-visible flow change. The migration is a structural replacement: every `<img>` inside `ImageWithFallback` becomes `<Image>` from `next/image`. The user experience is identical; the observable outcome is elimination of network-waterfall delays (CDN optimisation + lazy decode) and a guaranteed CLS = 0 because every call site already provides a sized wrapper or explicit dimensions.

The delivery flow is:
1. Update `next.config.ts` — add the Vercel Blob hostname, `formats`, `qualities`, `deviceSizes`, `imageSizes`, `minimumCacheTTL`.
2. Update `components/ui/image-with-fallback.tsx` — replace `<img>` with `<Image>`; expose `sizes`, `priority`, `unoptimized` props; keep the `onError`→`ImageOff` fallback.
3. Update every consumer — pass `sizes` (required when `fill`) and `priority` (detail hero only) per the per-context table below.
4. Verify `npm run lint && npm run typecheck` green; screenshot every context against CLS = 0 baseline; confirm on Staging URL.

## States (8)

All states apply to `ImageWithFallback` in its role as an image container. The component renders one of two branches: the optimised image, or the fallback placeholder.

| State | Image branch | Fallback branch |
|---|---|---|
| default | `next/image` renders; `object-cover` or `object-contain` per consumer | `bg-muted` + `ImageOff` lucide icon centred |
| hover | No change to image itself; consumers add `group-hover:scale-105` or `hover:brightness-95` via `imgClassName` — this is unchanged | No change |
| focus | Component is not focusable itself; interactive wrappers (buttons in `CampgroundDetailClient.tsx`, `ImageGallery.tsx`) carry `focus-visible:ring-2 focus-visible:ring-ring` — unchanged | Same |
| active | Not applicable to the image container; active state lives on wrapping `<button>` elements | Not applicable |
| loading | `next/image` handles its own decode/fade. The wrapper `bg-muted` remains visible until the image paints, giving a consistent muted background placeholder — no skeleton is required for this migration (skeleton is a consumer-level concern, not added here) | Not applicable — fallback shows immediately |
| error | `onError` fires → `setErrored(true)` → fallback branch renders: `bg-muted` + `ImageOff` centred + `aria-label` on wrapper | Is the fallback branch |
| empty | `src` is `null`/`undefined`/`""` → fallback branch renders immediately — no network request | Is the fallback branch |
| disabled | Not applicable to image display | Not applicable |

Note: the `loading` state visual (muted background while image decodes) is already provided by the wrapper's `bg-muted` class (token, not a hardcoded color). No new shimmer or skeleton is added — that is out of scope for PERF-4.

## Validation UX

This story has no form fields, no validation, and no user-input error states. Not applicable.

## Component API

### New `ImageWithFallback` props interface

```ts
interface ImageWithFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt: string;
  className?: string;         // wrapper sizing/rounding (same as before)
  imgClassName?: string;      // passed to next/image className (object-fit etc.)
  onClick?: () => void;
  loading?: "lazy" | "eager"; // kept for back-compat; maps to next/image loading prop
  "data-testid"?: string;

  // ---- new props ----
  sizes?: string;             // REQUIRED when fill=true (omitting it degrades perf)
  priority?: boolean;         // pass true only for the LCP element (detail hero, index 0)
  unoptimized?: boolean;      // pass true for blob:/data: src; auto-detected too (see below)
}
```

### Two rendering modes

**Mode A — `fill` (default, dominant pattern)**

Used for every context where the wrapper already has an explicit size (width + height or aspect-ratio). The `next/image` component is rendered with `fill` and `style={{ objectFit }}` derived from `imgClassName` (extract `object-cover` / `object-contain`).

```tsx
// Simplified render branch (fill mode)
<Image
  fill
  src={src}
  alt={alt}
  sizes={sizes}           // required; Frontend must always pass it
  priority={priority}
  unoptimized={isUnoptimized}
  className={cn("object-cover", imgClassName)}  // imgClassName merged
  onError={() => setErrored(true)}
/>
```

`fill` requires the wrapper to be `position: relative` — the existing wrapper already has `relative overflow-hidden` (line 45 of `image-with-fallback.tsx`), so no wrapper change is needed.

**Mode B — `fixed` (avatar / logo preview)**

Used when the wrapper is a fixed pixel square and the image maps 1:1. In this mode `width` and `height` are passed explicitly and `fill` is omitted.

For this migration, Mode B is only needed for `LogoUpload.tsx` (128x128 px, `w-32 h-32`). All other contexts use Mode A. Frontend should implement this as the same component: if `width` and `height` are provided as additional props, use fixed mode; otherwise default to fill.

The cleanest API is: **`fill` is always used unless the caller passes both `width` and `height`**. For PERF-4, only `LogoUpload` passes explicit dimensions.

### Auto-detect `unoptimized`

The component auto-sets `unoptimized={true}` when the `src` starts with `blob:` or `data:`. This prevents `next/image` from trying to optimise an object URL or base64 string (which would 500). Callers may also pass `unoptimized` explicitly.

```ts
const isUnoptimized = unoptimized || src?.startsWith("blob:") || src?.startsWith("data:");
```

### Keep the fallback unchanged

The `ImageOff` lucide icon fallback, the `setErrored` state, the `showFallback` logic, and the wrapper `role`/`aria-label`/`aria-hidden` logic are all preserved exactly as in the current component (lines 35–73 of `image-with-fallback.tsx`). Do not remove them.

## Per-context `sizes` table (build checklist)

Every call site in the codebase, grounded in the grep. "Wrapper sized?" = the wrapper has an explicit CSS height or aspect-ratio so `fill` has a box to fill. "Priority?" = is this the LCP candidate (above-the-fold at page load, not behind a user interaction).

| # | File : line(s) | Context label | Wrapper sized? | Mode | `sizes` value | `priority` | `unoptimized` | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | `components/CampgroundCard.tsx:120` | Card grid image (slider) | Yes — `aspect-square rounded-3xl overflow-hidden` parent; inner `relative w-full h-full` | fill | `"(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"` | false | false | Cards appear in a 1–4 column grid. 25vw at desktop is correct for 4 cols. |
| 2 | `components/CampgroundDetailClient.tsx:430` | Detail hero — mobile single (h-[300px]) | Yes — `md:hidden h-[300px] w-full relative` | fill | `"100vw"` | **true** | false | LCP element on mobile. This is the only `priority=true` in the codebase. |
| 3 | `components/CampgroundDetailClient.tsx:458` | Detail hero — desktop 1-image (h-[480px]) | Yes — `hidden md:block h-[480px]` | fill | `"100vw"` | **true** | false | LCP on desktop single-image layout. |
| 4 | `components/CampgroundDetailClient.tsx:477` | Detail hero — desktop 2-image grid col 0 | Yes — `grid-cols-2 h-[480px]` cell | fill | `"(max-width: 1024px) 100vw, 50vw"` | **true** | false | Left cell = dominant, LCP. |
| 5 | `components/CampgroundDetailClient.tsx:495` | Detail hero — desktop 2-image grid col 1 | Yes — same grid | fill | `"(max-width: 1024px) 100vw, 50vw"` | false | false | |
| 6 | `components/CampgroundDetailClient.tsx:510` | Detail hero — desktop 3-image grid col-span-2 | Yes — `grid-cols-3 h-[480px]` col-span-2 | fill | `"(max-width: 1024px) 100vw, 66vw"` | **true** | false | |
| 7 | `components/CampgroundDetailClient.tsx:528` | Detail hero — desktop 3-image grid col 1 | Yes — remaining `grid-cols-3` cell | fill | `"(max-width: 1024px) 50vw, 33vw"` | false | false | |
| 8 | `components/CampgroundDetailClient.tsx:541` | Detail hero — desktop 3-image grid col 2 | Yes — same | fill | `"(max-width: 1024px) 50vw, 33vw"` | false | false | |
| 9 | `components/CampgroundDetailClient.tsx:554` | Detail hero — desktop 4-image col-span-2 row-span-2 | Yes — `grid-cols-4 grid-rows-2 h-[480px]` col-span-2 | fill | `"(max-width: 1024px) 100vw, 50vw"` | **true** | false | |
| 10 | `components/CampgroundDetailClient.tsx:567,584` | Detail hero — desktop 4-image secondary cells (×2) | Yes — single grid cell | fill | `"(max-width: 1024px) 50vw, 25vw"` | false | false | |
| 11 | `components/CampgroundDetailClient.tsx:599` | Detail hero — desktop 5-image col-span-2 row-span-2 | Yes — same grid | fill | `"(max-width: 1024px) 100vw, 50vw"` | **true** | false | |
| 12 | `components/CampgroundDetailClient.tsx:613` | Detail hero — desktop 5-image remaining cells (×3 + last) | Yes — single grid cell | fill | `"(max-width: 1024px) 50vw, 25vw"` | false | false | Last cell may have an overlay (+N more); fill still valid. |
| 13 | `components/ImageGallery.tsx:97` | Lightbox main image | Yes — `relative w-full h-full` inside `flex items-center justify-center p-20` | fill | `"(max-width: 1024px) 100vw, 80vw"` | false | false | Lightbox is modal, never the LCP. `object-contain` must be preserved. |
| 14 | `components/ImageGallery.tsx:126` | Lightbox thumbnail strip | Yes — `w-20 h-20 rounded-lg overflow-hidden` (fixed size button) | fill | `"80px"` | false | false | 80px fixed square; `sizes="80px"` tells the browser exactly what to fetch. |
| 15 | `components/ImageUpload.tsx:67` | Upload preview grid cell | Yes — `aspect-square rounded-xl overflow-hidden` | fill | `"(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"` | false | **true (auto)** | URLs are Vercel Blob (`https://*.public.blob.vercel-storage.com`) after upload but may be `blob:` object URLs before server confirmation. Auto-detect covers this. |
| 16 | `components/LogoUpload.tsx:68` | Logo preview | Yes — `w-32 h-32 rounded-xl overflow-hidden` (fixed 128px square) | **fixed** `width={128} height={128}` | N/A (fixed mode, no `fill`) | false | **true (auto)** | Logo src is `blob:` during upload or a remote URL after save. Auto-detect covers `blob:`. `object-contain` required. |
| 17 | `app/bookings/page.tsx:135` | Booking list thumbnail | Yes — `md:w-64 h-48 md:h-auto overflow-hidden relative` | fill | `"(max-width: 768px) 100vw, 256px"` | false | false | On mobile takes full width; on md+ is a fixed 256px sidebar. |
| 18 | `app/bookings/[id]/BookingDetailClient.tsx:130` | Booking detail cover | Yes — `w-full h-48 md:h-64` (explicit heights) | fill | `"100vw"` | false | false | Full-width cover, not above fold at page load (user must navigate to this route). |
| 19 | `app/dashboard/campsites/page.tsx:222` | Dashboard list thumbnail | Yes — `w-16 h-16 rounded-xl` (fixed 64px square) | fill | `"64px"` | false | false | Fixed 64px thumb in a table row. `alt=""` is correct (decorative, name is in adjacent cell). |
| 20 | `app/preview/PreviewClient.tsx:641,651,660` | Preview kitchen-sink (3 cells) | Yes — `aspect-square rounded-xl` | fill | `"(max-width: 640px) 33vw, 200px"` | false | **true** for broken/nosrc examples | Preview is `noindex`; these are demo cells. Pass `unoptimized` explicitly on the broken-URL example to avoid a 500 from next/image trying to optimise `https://broken.invalid/404.jpg`. The `data:` and `undefined` examples trigger auto-detect. |

### Summary of `priority=true` contexts

Only the **detail hero images at index 0** are `priority=true`:
- `CampgroundDetailClient.tsx` mobile single (context 2)
- `CampgroundDetailClient.tsx` desktop, all layout variants where the dominant cell is image index 0 (contexts 3, 4, 6, 9, 11)

The lightbox main image (`ImageGallery.tsx`) is NOT `priority`, because it is behind a user interaction (the user must tap to open the gallery). The booking detail cover is NOT `priority` for the same reason (the user must navigate to a specific booking). Card grid images are NOT `priority` because they are below the fold at page load (the map or search UI is above them).

## next.config.ts images block

Replace the existing `images` block in `next.config.ts` with:

```ts
images: {
  formats: ["image/webp"],
  qualities: [75],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [64, 80, 128, 256],
  minimumCacheTTL: 60 * 60 * 24 * 31,   // 31 days in seconds
  remotePatterns: [
    {
      protocol: "https",
      hostname: "images.unsplash.com",
    },
    {
      protocol: "https",
      hostname: "*.public.blob.vercel-storage.com",
    },
  ],
  dangerouslyAllowSVG: false,
},
```

Rationale for each value:

- `formats: ["image/webp"]` — AVIF is excluded deliberately; AVIF encoding is CPU-heavy and CampVibe's Vercel Hobby plan has limited function duration. WebP gives ~30% size reduction vs JPEG with broad browser support and negligible encode cost.
- `qualities: [75]` — default 75 aligns with `.claude/rules/performance.md` image budget (< 200KB/image); reduces CDN bandwidth.
- `deviceSizes` — the default Next.js set, trimmed to remove 390/480 which duplicate 640/750 at this quality level. Matches the `sizes` values used in the table (100vw, 50vw, 25vw at breakpoints 640/768/1024/1920).
- `imageSizes: [64, 80, 128, 256]` — exact fixed sizes used in the per-context table: 64 (dashboard thumb), 80 (lightbox thumb), 128 (logo), 256 (booking sidebar). Adding only what is needed avoids bloating the CDN cache with unused variants.
- `minimumCacheTTL: 2678400` — 31 days. Camp images are immutable after upload (URLs contain a content hash from Vercel Blob); a long TTL maximises CDN cache hit rate.
- `*.public.blob.vercel-storage.com` — Vercel Blob storage hostname used by `ImageUpload` and `LogoUpload`. The wildcard covers all projects/tenants under the account.
- `dangerouslyAllowSVG: false` — SVGs are not used as camp images; disabling prevents XSS via malicious SVG.

## CLS guarantee

CLS is currently measured at 0 (from CAM-192 measurement). This migration must not regress it.

The CLS guarantee is structural: `next/image` with `fill` does not inject an `<img>` with unknown intrinsic dimensions, because the browser never has to guess the size — the wrapper already reserves space via CSS. For `fill` mode, CLS = 0 as long as:

1. The wrapper has `position: relative` and a CSS-defined height or aspect-ratio **before** the image loads.
2. `overflow-hidden` is present (prevents any resize event from the fallback).

The existing wrapper already satisfies both conditions (`relative overflow-hidden` at line 45 of `image-with-fallback.tsx`). No wrapper changes are required.

Per-context confirmation:

| Context group | How space is reserved | CLS risk |
|---|---|---|
| Card grid (CampgroundCard) | `aspect-square` on the `rounded-3xl` parent | None — aspect-ratio reserves the exact box before image loads |
| Detail hero (all variants) | Explicit `h-[300px]` (mobile) or `h-[480px]` (desktop) on the grid container | None — fixed height is set before the image response |
| Lightbox main | `w-full h-full` inside a fixed-position `inset-0` overlay | None — overlay is full viewport, no layout shift possible |
| Lightbox thumbnails | `w-20 h-20` fixed button | None |
| Upload preview | `aspect-square` on the grid cell | None |
| Logo preview | `w-32 h-32` fixed box | None |
| Booking list thumb | `h-48 md:h-auto` — NOTE: `md:h-auto` combined with `fill` is a CLS risk (see open question below) | **OPEN — see below** |
| Booking detail cover | `h-48 md:h-64` explicit heights | None |
| Dashboard thumb | `w-16 h-16` fixed | None |
| Preview kitchen-sink | `aspect-square` | None |

### Open question for the owner — Booking list thumbnail (context 17)

`app/bookings/page.tsx:134` sets `md:w-64 h-48 md:h-auto` on the image wrapper. `h-auto` on the `md:` breakpoint means the wrapper height is governed by the image's intrinsic size once it loads. With `next/image fill`, the image has no intrinsic size — it fills its container — so `h-auto` at md+ causes the wrapper to collapse to zero height until the image loads, creating a CLS event.

**Proposed resolution (preferred):** change `md:h-auto` to an explicit height such as `md:h-64` (matches the booking detail cover height, consistent pattern). This is a design call: the booking card currently allows the image to be as tall as the text content on desktop, which is intentional for varying content lengths.

**Alternative:** use a fixed aspect-ratio (`aspect-video` or `aspect-[4/3]`) instead of `h-auto` on the md+ wrapper so the box is always reserved.

This is a one-line change in `app/bookings/page.tsx` and is within PERF-4 scope if the owner approves the layout fix. If the owner wants to keep `h-auto` for content alignment, the image must remain a raw `<img>` at md+ breakpoint only — which means context 17 stays `unoptimized` until a follow-up story.

**Owner action required before build:** confirm which resolution (explicit height or aspect-ratio) to apply to the booking list thumbnail at md+.

## Components and tokens

- `next/image` (framework, not `components/ui/*`) — replaces the raw `<img>` inside `ImageWithFallback`.
- `ImageOff` from `lucide-react` — unchanged fallback icon (icon policy §7 DESIGN.md: lucide-only).
- Wrapper: `relative overflow-hidden bg-muted flex items-center justify-center` — all token-based (`bg-muted` = `var(--muted)`). No new tokens.
- Fallback icon: `w-8 h-8 text-muted-foreground/40` — token-based. No change.
- No new design tokens are required for this story.
- No new components from `components/ui/*` are required.

## a11y

All a11y properties are unchanged from the current component. Confirming they survive the migration:

- The wrapper `<div>` carries `role="img"` + `aria-label={alt}` when the fallback is showing and `alt` is non-empty (lines 39–51 of current component). This is preserved.
- When the `next/image` renders (non-fallback branch), the `<Image>` component itself carries `alt={alt}` — accessible name is on the `<img>` element.
- `alt=""` is correct and intentional on secondary hero grid cells and decorative thumbnails (dashboard, lightbox strip) where the adjacent label or heading names the content.
- Focus ring: no change — `ImageWithFallback` is not itself focusable; focus rings live on the wrapping `<button>` or `<Link>` elements in each consumer. These are unaffected by this migration.
- Tap target: the component renders a `<div>`, not an interactive element. Tap target rules apply to the consumer-level `<button>` wrappers, which are already `≥44px`.
- `ImageOff` carries `aria-hidden="true"` (line 59 of current component). The semantic role is on the wrapper div, not the decorative icon. Preserved.
- `data-testid` pass-through is preserved — QA assertions on `img--booking-cover`, `img--preview-good` etc. remain valid.

WCAG 2.1 AA: no color, contrast, or focus changes are introduced. The only runtime change is `<img>` → `<Image>` inside the non-fallback branch; both render an `<img>` tag in the DOM with the same `alt` and `src` semantics.

## PR split guidance

This migration touches 1 config file and 10 component/page files. Line count estimate: ~100 lines for `image-with-fallback.tsx` rewrite + ~5 lines each for 9 consumers = ~145 lines total. This fits within the `≤400 line` single-story PR rule.

**Recommended: one PR.**

If the Booking list thumbnail open question adds complexity (wrapper change in `app/bookings/page.tsx`), it is still one PR — the `page.tsx` change is a 1-line fix.

Split into two PRs only if the owner decides to defer the booking list thumbnail to a follow-up (i.e. ship PERF-4 without context 17, then a small follow-up fixes the `h-auto` wrapper and upgrades context 17).

## Design-gate checklist

- [x] Token-only — no hardcoded hex or px in the component. `bg-muted`, `text-muted-foreground/40` are semantic tokens. Wrapper sizing is caller-controlled via Tailwind scale utilities. `npm run check:palette` will pass.
- [x] Lucide icons — `ImageOff` from `lucide-react`. No emoji. No tabler icons.
- [x] All 8 states documented above.
- [x] a11y — `alt` pass-through preserved, `aria-label` on wrapper fallback preserved, `aria-hidden` on `ImageOff` preserved, focus ring not affected.
- [x] CLS = 0 for all contexts except the open question (booking list at md+).
- [x] No new copy strings — this story introduces no user-facing text. No `locales/` changes needed.
- [x] `priority` limited to detail hero index 0 only — the LCP element. Not set on lightbox, card grid, booking, or dashboard.
- [x] `unoptimized` auto-detected for `blob:` / `data:` srcs; explicit flag available for callers (preview broken-URL example).
- [ ] OPEN — Booking list thumbnail CLS at md+ (see open question above). Gate blocked on owner decision for this one context.

## Links

`../../feature.md` (Performance and Freshness) · `DESIGN.md` · `.claude/rules/performance.md` · `.claude/rules/seo.md`

## Changelog

- v1 (2026-06-26) — created; full per-context sizes table, component API, next.config block, CLS analysis, open question on booking list thumbnail.
