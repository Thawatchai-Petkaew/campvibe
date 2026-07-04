<!--
ticket: CAM-353
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold) (CAM-22)
feature: Data & Trust
status: Draft (proposed for G1)
version: v1
spec-class: FULL (M) — camper-facing UI story: new spot section on the public camp-detail page +
  ONE read-path Prisma-include change (no schema, no migration, no new endpoint). Does NOT qualify
  spec-lite: multi-file surface (catalog-cache read model + detail component + locales) and expected
  diff > ~150 lines. Separate spec PR + full G1 tap.
persona: Camper
-->

## Story
As a **Camper**, I want to see a camp's individual spots — each spot's name, zone, how many people it holds, its price, and its own photos (a panorama marked as such) — on the camp detail page, so that I can judge which zone/spot fits my group before I book, instead of guessing from camp-level photos alone.
Why: the owner (2026-07-04) asked that spots "keep their own photos, displayed on the camp DETAIL page." CAM-352 built the host side (hosts author spots + per-spot photos + the `Image.kind` panorama marker); this story is the camper-facing half that surfaces that data. Ground-truth correction: the detail page renders from `getCampBySlug` (`lib/catalog-cache.ts`), NOT `getCampSiteWithCapacity` — and `getCampBySlug`'s `spots: true` include carries NEITHER `spots.images` NOR a `deletedAt` filter, so spot photos do NOT ride the payload today (a CAM-342 field-does-not-ride-through trap). The include must be extended (read-path only, no schema change).
Scope: a new read-only spot section on the public camp-detail page (`components/CampgroundDetailClient.tsx`) that lists each live spot with its name, zone, capacity, price, and per-spot photo gallery (panoramas shown as regular images with a `พาโนรามา` badge), gated to PER-SPOT-mode camps that actually have spots. Plus the one `getCampBySlug` include change that makes the data ride the existing server payload. No new fetch, no schema change, no interactive panorama viewer.
Depends on: CAM-352 (spot photos + `Image.kind`, MERGED) · CAM-351 (`useSpotView` capacity/display mode, MERGED).

## AC
<!-- Then = user-visible (verbatim Thai) · System effect = data outcome, plain language · Neg/edge = failure twin. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A PER-SPOT camp (`useSpotView = true`) with 3 live spots | Camper opens the camp detail page | Sees a spot section headed `จุดกางเต็นท์ในแคมป์นี้` listing all 3 spots | Section server-rendered from the existing camp-detail page payload; no client fetch | EC-2 |
| AC-2 | A live spot named `โซนริมน้ำ A1`, zone `โซน A`, holds 6 people, price 500/night | Camper views that spot's row | Sees `โซนริมน้ำ A1`, `โซน A`, `รองรับได้ 6 คน`, and the price `฿500` `คืน` | Values read from the spot's Pixels (name/zone/maxCampers/pricePerNight) | EC-4, EC-6 |
| AC-3 | A live spot with 4 photos | Camper views that spot's row | Sees the spot's 4 photo thumbnails; tapping one opens the full-screen photo viewer | Spot photos rendered lazily, ordered by sort order; reuses the existing camp photo viewer | EC-1 |
| AC-4 | A spot photo the host marked as a panorama (`Image.kind = PANORAMA`) | Camper views that photo in the spot gallery | Sees a `พาโนรามา` badge on that photo (it still opens as a regular image, no 360 pan) | Badge driven by `Image.kind`; no special projection or new viewer | EC-5 |
| AC-5 | A WHOLE-CAMP camp (`useSpotView = false`) OR a camp with 0 live spots | Camper opens the camp detail page | Sees NO spot section at all (no heading, no empty placeholder) | Section not rendered; rest of the page unchanged | EC-2, EC-7 |
| AC-6 | A live spot that has no photos | Camper views that spot's row | Sees the spot's name, zone, `รองรับได้ {N} คน`, and price, with no photo gallery and no broken-image box | Row renders; spot's `images` array is empty | EC-1 |

## Rules
- BR-1 **Section render gate — `useSpotView === true` AND ≥ 1 live spot.** The spot section renders only for a PER-SPOT-mode camp that has at least one non-deleted spot. Rationale: (a) `CampSite.useSpotView`'s own schema comment defines it as the "Display แบบ camp spot" switch, not merely capacity entry; (b) CAM-351 lets a host switch PER-SPOT to WHOLE-CAMP **without deleting spots**, so a "spots exist = show them" rule would leak stale spots onto a camp that deliberately chose a whole-camp presentation; (c) per-spot booking selection does not exist yet (CAM-354, out of scope), so showing a per-spot breakdown on a whole-camp camp would imply a selectability the checkout can't honor. **Owner-vetoable** — if the owner wants "any camp with live spots shows them," relax to `>= 1 live spot` regardless of mode. (proves AC-1, AC-5, EC-7)
- BR-2 **Payload — extend the read-path include (no schema, no new endpoint).** Change `getCampBySlug` (`lib/catalog-cache.ts`) from `spots: true` to `spots: { where: { deletedAt: null }, include: { images: { orderBy: { sortOrder: 'asc' } } } }`. This is the SAME single query with a richer include (no N+1, no extra round-trip) — it simply makes live spots + their photos ride the existing server payload. Use `include: { images: ... }` (full rows) so `Image.kind` rides at runtime — do NOT use an enumerating `select` (the CAM-342 field-does-not-ride-through trap). The added `deletedAt: null` filter also closes the latent (currently unconsumed) gap where `spots: true` returned soft-deleted rows. (proves AC-1, AC-3, EC-3)
- BR-3 **Capacity copy — `รองรับได้ {N} คน`, shown only when `maxCampers >= 1`.** `{N}` = the spot's `maxCampers`. If `maxCampers` is null or 0, omit the capacity line entirely for that spot — never render `รองรับได้ 0 คน`. Reuses the established phrasing already shipped on the host screen (CAM-352 `spotManagement.capacityLabel`); the camper-facing key SHOULD live under `campground.*` with the identical verbatim text. (proves AC-2, EC-4)
- BR-4 **Price — the existing render pattern.** Show `formatCurrency(spot.pricePerNight)` followed by `คืน` (`t.common.night`), the same pattern the catalog card and booking widget use. When `pricePerNight` is 0, show `ฟรี` (`t.common.free`) instead of `฿0` — consistent with the card's `priceLow ? formatCurrency : ฟรี` logic. Price is `Decimal(12,2)`; `serializeDecimals` already recurses nested `spots[].pricePerNight` to a plain number before it reaches the client. (proves AC-2, EC-6)
- BR-5 **Panorama marker — badge now, viewer later.** A photo whose `Image.kind === 'PANORAMA'` shows a `พาโนรามา` badge (reuse `<Badge>` + the verbatim text already shipped as `spotManagement.panoramaBadge`); it still renders and opens as a regular image — NO 360/pan projection. A photo with `kind === 'PHOTO'` (the default) shows no badge. The interactive panorama viewer is CAM-354 (out of scope). Decision rationale: the marker data already rides the payload once BR-2 lands, the Badge primitive + copy already exist (zero new dependency, zero new UI primitive), and an honest badge sets camper expectation before the viewer ships — cheap and fully reversible. (proves AC-4, EC-5)
- BR-6 **No-CLS, lazy, ordered.** Spot photos are below the fold: render them with `loading="lazy"` (NOT `priority` — the camp hero keeps `priority`) and explicit dimensions / a fixed aspect-ratio so the new section adds no layout shift (CLS target <= 0.1). Images render in `sortOrder asc`. (proves AC-3)
- BR-7 **List, not paginate.** Render every live spot in a single vertical list — no pagination, no "show more". Spot counts are host-authored and bounded (typically < 20). **Owner-vetoable** — revisit only if real data shows very large spot counts; a `take` cap + "ดูทั้งหมด" would be the follow-up, not now. (proves AC-1)
- BR-8 **Cache-freshness seam (Important — recommend folding a 1-line fix into this PR).** `getCampBySlug` is an `unstable_cache` read (5-min TTL, busted by `revalidateTag(campTag(id))` / `campSlugTag(slug)`). CAM-352's spot create/edit/delete handlers (`app/api/campsites/[id]/spots/route.ts`, `[spotId]/route.ts`) currently call NO `revalidateTag` — so a host's spot/photo edit will not surface on the cached detail page until the TTL lapses. Recommend adding `revalidateTag(campTag(campSiteId))` + `revalidateTag(campSlugTag(slug))` to those three handlers in this PR (tiny, directly enables the "host edits, camper sees it" expectation). If the owner/architect prefers to keep this story display-only, peel it to a one-line follow-up; the 5-min TTL is the safety net either way. **[Architect/owner note at G1/G2: in-scope vs peel.]** (supports AC-3)

## Edge cases
<!-- cover: invalid · empty/zero · concurrent/duplicate · permission · boundary. -->
- EC-1 IF a live spot has no photos THEN render its row (name / zone / capacity / price) with no gallery and no broken-image placeholder (BR-2, AC-6)
- EC-2 IF the camp has zero live spots THEN the entire spot section is absent — no heading, no empty scaffold on the public page (BR-1)
- EC-3 IF a spot was soft-deleted (`deletedAt` set) THEN it never appears in the section (excluded by the `where: { deletedAt: null }` include filter) (BR-2)
- EC-4 IF a spot's `maxCampers` is null or 0 THEN omit the capacity line for that spot (never `รองรับได้ 0 คน`) (BR-3)
- EC-5 IF a spot photo's `kind` is `PHOTO` (default) THEN show no badge; only `kind = PANORAMA` shows `พาโนรามา` (BR-5)
- EC-6 IF a spot's `pricePerNight` is 0 THEN show `ฟรี` instead of `฿0` (BR-4)
- EC-7 IF the camp is WHOLE-CAMP mode (`useSpotView = false`) but still has live spot rows (e.g. after a PER-SPOT to WHOLE-CAMP switch that kept the spots) THEN the section stays absent — spots are not shown on a whole-camp presentation (BR-1)

## Data
- **Read-only. No schema change. No migration.** Every field already exists: `Spot` (`zone`, `name`, `viewType`, `maxCampers`, `maxTents`, `pricePerNight`, `pricePerSite`, `deletedAt`) and `Spot.images` -> `Image` (`url`, `alt`, `kind` = `PHOTO | PANORAMA`, `sortOrder`), all shipped by CAM-352. Classification: all displayed fields are `[Public]`.
- The ONLY data-layer change is the read-path include in `getCampBySlug` (BR-2): `spots: true` -> `spots: { where: { deletedAt: null }, include: { images: { orderBy: { sortOrder: 'asc' } } } }`. Same query, richer include — no new fetch, no N+1.
- `serializeDecimals` (`lib/serialize.ts`) already recurses arrays/objects, so nested `spots[].pricePerNight` / `pricePerSite` Decimals serialize to numbers before the client boundary — no serialization change needed.
- `types/api.ts` `SpotDTO` already carries `images?: { url: string; kind?: ImageKind }[]` (CAM-352). The detail component receives `campground: any` (reads `spot.images[].kind` off the runtime payload), so no `types/api.ts` change is required for this story — noted only to confirm the shape is already contract-aligned.
- migration: none.

## Seams & refs
- Reuse (edit/add these): `lib/catalog-cache.ts` `getCampBySlug` (extend the `spots` include ONLY — BR-2) · `components/CampgroundDetailClient.tsx` (add the new section; extract a presentational `SpotSection` / `SpotCard` client subcomponent if it keeps the file readable) · `components/ImageGallery.tsx` (reuse the existing `images: string[]` lightbox for the per-spot viewer — NO change to its props) · `components/ui/image-with-fallback.tsx` (lazy spot thumbnails, `loading="lazy"`, explicit `width`/`height`) · `components/ui/badge.tsx` (the `พาโนรามา` badge) · `locales/translations.json` (add camper-facing spot-section keys under `campground.*` — `spotsHeading` = `จุดกางเต็นท์ในแคมป์นี้`; reuse the verbatim text of `spotManagement.capacityLabel` `รองรับได้ {N} คน`, `spotManagement.panoramaBadge` `พาโนรามา`, and the `viewType*` labels; TH + EN both) · `formatCurrency` + `t.common.night` (`คืน`) / `t.common.free` (`ฟรี`).
- Do NOT change: `lib/read-models/camp-card.ts` `campCardSelect` (catalog cards do not show spots — no over-fetch) · `lib/spot-aggregation.ts` `getCampSiteWithCapacity` (that feeds the `/api/campgrounds/[id]` + `/api/campsites/[id]` API routes, NOT the detail render — leave it) · the `Spot` / `Image` schema (read-only).
- Refs: CAM-352 (host authoring of spots + photos + `Image.kind` — the data producer) · CAM-351 (`useSpotView` = the capacity/display mode BR-1 gates on; note it allows PER-SPOT <-> WHOLE-CAMP switching without deleting spots) · CAM-342 (field-rides-through trap — use `include: { images }`, never an enumerating `select`) · CACHE-1/CAM-195 (`getCampBySlug` cache + `revalidateTag` freshness — see BR-8).

## Out of scope
- Interactive 360 / panorama **viewer** (pan / projection / a panorama-viewer dependency) -> **CAM-354.** This story shows the `พาโนรามา` badge over a regular image only; the viewer needs a new, security-gated dependency and its own design.
- Per-spot **booking selection** (choosing a specific spot at checkout, per-spot capacity enforcement) -> the CAM-351 enforcement-parity follow-up / a dedicated booking-per-spot story. Booking stays whole-camp; this section is informational.
- Host-facing spot surfaces (create / edit / delete / photo upload) -> CAM-352 (done).
- Showing spots on WHOLE-CAMP camps -> deliberately excluded by BR-1 (owner-vetoable).
- Per-spot availability / remaining-capacity on the detail page -> the availability epic (CAM-267 / CAM-303).
- Adding `revalidateTag` to CAM-352's spot write paths, if the owner/architect chooses to keep this story display-only -> a 1-line follow-up (see BR-8).

## Self-verify
- AC-1..AC-6 -> integration (render the detail section from a PER-SPOT camp payload) + owner-verify on the real Staging URL — use **แคมป์เขาค้อ `954cb547`** (has spots): confirm the `จุดกางเต็นท์ในแคมป์นี้` section, each spot's name/zone/`รองรับได้ {N} คน`/price, the photo thumbnails + lightbox, a `พาโนรามา` badge on a panorama photo, a photo-less spot row, and that a whole-camp/0-spot camp shows no section. All Thai copy verbatim.
- BR-2 -> integration: the extended `getCampBySlug` include returns live spots each with `images` (incl. `kind`); a soft-deleted spot is absent; the catalog-card payload (`campCardSelect`) is unchanged; the read stays a single query (no N+1).
- BR-1, EC-2, EC-7 -> integration: PER-SPOT + >=1 spot renders the section; WHOLE-CAMP (even with stray live spots) and 0-live-spot render nothing.
- EC-1, EC-4, EC-5, EC-6 -> integration: photo-less row renders without a gallery; null/0 `maxCampers` omits the capacity line; `PHOTO` shows no badge / `PANORAMA` shows `พาโนรามา`; `pricePerNight = 0` shows `ฟรี`.
- Public-page perf/SEO: spot images are lazy + carry explicit dimensions (CLS <= 0.1, or state "not measured"); the section is server-rendered in the HTML (crawlable, no client-only fetch); no new dependency added.
- States note (DESIGN.md §5): loading / error client states are **N/A** — the section rides the existing SSR payload (no client fetch). The covered states are: empty (section absent, EC-2) and the photo-less row (EC-1). CLS guard (BR-6) replaces the loading concern.
- Story-specific: reuse `ImageGallery` / `Badge` / `ImageWithFallback` / `formatCurrency` (no parallel logic) · Thai copy verbatim, no em-dash separator, no technical jargon · design gate (token-only) green.
- Atomic / size: UI-only + one read-path include change; est. diff ~200–350 lines across `lib/catalog-cache.ts` + `components/CampgroundDetailClient.tsx` (+ optional `SpotSection`) + `locales/translations.json`. **FULL (M)** — separate spec PR + G1 tap; does NOT qualify spec-lite (multi-file surface, diff > ~150 lines).
- Gate = /quality-gate · Done = every AC verified on the real Staging URL.

## Changelog
- v1 (2026-07-05) — created. Camper-facing spot section on the camp-detail page (name / zone / capacity / price / per-spot gallery + `พาโนรามา` badge). Ground-truth correction: the detail page reads `getCampBySlug` (not `getCampSiteWithCapacity`), whose `spots: true` carries neither `spots.images` nor a `deletedAt` filter — the include must be extended (read-path, no schema). Decisions: render-gate on `useSpotView === true` + >=1 live spot (owner-vetoable); panorama = badge now / viewer = CAM-354; no pagination (owner-vetoable). Flagged the cache-freshness seam (CAM-352 spot writes call no `revalidateTag`) as BR-8.
