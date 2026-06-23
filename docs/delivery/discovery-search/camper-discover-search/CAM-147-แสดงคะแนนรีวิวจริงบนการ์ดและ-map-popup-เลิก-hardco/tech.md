---
linear: CAM-147
feature: discovery-search
epic: camper-discover-search (CAM-33)
artifact: tech
owner: frontend
status: Done
version: v1
updated: 2026-06-23
---
# Tech — แสดงคะแนนรีวิวจริงบนการ์ดและ map popup (เลิก hardcode 4.8) (CAM-147)

## Query changes

### app/page.tsx — both sort branches

Previously, only the `rating` sort branch included `reviews` (for `sortByRating`). The `else` branch (related/price_asc/price_desc) fetched no reviews, leaving cards with no real avg data.

Change: both branches now include:

```ts
reviews: { where: { deletedAt: null }, select: { rating: true } }
```

After the include, both branches map rows through:

```ts
({ reviews: _reviews, ...rest }) => ({
  ...rest,
  avgRating: roundAvgRating(computeAvgRating(_reviews)),
  reviewCount: _reviews.length,
})
```

The `reviews` array is stripped (via `_reviews` rename-and-discard) before forwarding to `CampgroundGrid`. Only `avgRating: number | null` and `reviewCount: number` reach the client. No PII, no `authorId`, no review content enters the client bundle.

### app/wishlist/page.tsx

The Prisma `wishlist.findMany` now selects `reviews: { where: { deletedAt: null }, select: { rating: true } }` inside the `campSite` nested select. The mapping destructs `{ reviews, ...campSite }` and computes `avgRating`/`reviewCount` before building the `CampSiteCardData` item. Reviews array is stripped.

### MapComponent data source

`MapComponent` is used exclusively from `CampgroundDetailClient` (the camp detail page). The detail page already received `avgRating` and `reviewCount` as computed props from CAM-79 (the detail page review section). This story threads those existing props into the `DynamicMap` call:

```tsx
<DynamicMap
  latitude={campground.latitude}
  longitude={campground.longitude}
  campground={campground}
  avgRating={avgRating}
  reviewCount={reviewCount}
/>
```

No additional query was required for the map. The map shows the single current campsite's rating — not a list of nearby campsites — so the avg was already available on the page.

## Prop contract added

### CampSiteCardData (components/CampgroundGrid.tsx)

```ts
avgRating?: number | null;  // CAM-147: server-computed 1dp avg or null
reviewCount?: number;        // CAM-147: total non-deleted review count
```

### CampgroundCardProps (components/CampgroundCard.tsx)

```ts
avgRating?: number | null;
reviewCount?: number;
```

### MapComponent props (components/MapComponent.tsx)

```ts
avgRating?: number | null;
reviewCount?: number;
```

## Reviews stripped — no PII to client

All three data paths (home page, wishlist, map) follow the same stripping pattern:

- Prisma query uses `select: { rating: true }` only — no `content`, no `authorId`, no author relation.
- After computation, the `reviews` array is destructured out (`reviews: _reviews`) and discarded.
- `CampgroundGrid`, `CampgroundCard`, and `MapComponent` receive only the two scalar numbers `avgRating` + `reviewCount`.
- No review array, no author data, no PII appears in the forwarded props or the rendered HTML.

## Helpers reused — no new avg logic

- `computeAvgRating(reviews)` from `lib/sort-utils.ts` (CAM-76) — computes raw avg; returns `null` for empty array.
- `roundAvgRating(avg)` from `lib/review-summary.ts` (CAM-79) — rounds to 1 decimal, returns `null` when avg is `null`.

No new averaging or rounding logic was written. Card and detail page now round identically.

## i18n key added

Added `reviews.ratingAriaLabelShort` to both `en` and `th` blocks in `locales/translations.json`:

- EN: `"Rating {avg} out of 5 stars"`
- TH: `"คะแนน {avg} จาก 5 ดาว"`

Used by `CampgroundCard` and `MapComponent` popup for the `aria-label` on the rating wrapper. The existing `reviews.noReviews` key (CAM-79) is reused for the empty state — no duplicate added.

## Test IDs present

Per design.md spec:

- `rating--card-avg` — card rating slot (has-reviews)
- `empty--card-rating` — card rating slot (no-reviews)
- `rating--map-popup-avg` — map popup rating row (has-reviews)
- `empty--map-popup-rating` — map popup rating row (no-reviews)

## Files changed

| File | Change |
|---|---|
| `app/page.tsx` | Added `computeAvgRating`/`roundAvgRating` imports; added reviews include + avg/count map + strip to both sort branches |
| `app/wishlist/page.tsx` | Added same imports; added reviews include to nested campSite select; computed avgRating/reviewCount; stripped reviews array |
| `components/CampgroundGrid.tsx` | Added `avgRating`/`reviewCount` to `CampSiteCardData`; passed them to `CampgroundCard` |
| `components/CampgroundCard.tsx` | Added props; replaced hardcoded `4.8` with conditional rating/empty-state render |
| `components/WishlistPageClient.tsx` | Passed `avgRating`/`reviewCount` from `camp` item to `CampgroundCard` |
| `components/MapComponent.tsx` | Added props; replaced hardcoded `4.8` with conditional rating/empty-state render |
| `components/CampgroundDetailClient.tsx` | Threaded `avgRating`/`reviewCount` into `DynamicMap` call |
| `locales/translations.json` | Added `reviews.ratingAriaLabelShort` (EN + TH) |

## Limitation note

The map displays the **current campsite only** (single marker at the detail page coordinates). It does not display a list of nearby campsites. Therefore no additional query is needed — the avg already exists as a prop from the detail page server render (CAM-79). If a future story adds multi-campsite map views, each campsite in that list would need avgRating/reviewCount computed server-side and passed in.
