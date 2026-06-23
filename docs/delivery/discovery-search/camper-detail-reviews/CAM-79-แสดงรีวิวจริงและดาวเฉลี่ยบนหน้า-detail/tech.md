---
linear: CAM-79
feature: discovery-search
epic: camper-detail-reviews (CAM-34)
persona: camper
artifact: tech
owner: frontend
status: In Progress
version: v1
updated: 2026-06-23
---
# Tech — แสดงรีวิวจริงและดาวเฉลี่ยบนหน้า detail (CAM-79)

## Files Changed

| File | Type | Role |
|---|---|---|
| `lib/review-summary.ts` | NEW | Pure helper functions — no Prisma import, unit-testable |
| `app/campgrounds/[slug]/page.tsx` | MODIFIED | Server Component — adds review queries, passes props |
| `components/CampgroundDetailClient.tsx` | MODIFIED | Client Component — new props, rating display, review section |
| `locales/translations.json` | MODIFIED | Adds `reviews` namespace (TH + EN) |
| `docs/delivery/.../tech.md` | NEW | This file |

---

## 1. Pure helper — `lib/review-summary.ts`

### Exports

```ts
roundAvgRating(avg: number | null): number | null
// Math.round(avg * 10) / 10; returns null when avg is null.

buildReviewSummary({ avg, count }): ReviewSummary
// { hasReviews: boolean; avgRating: number | null; count: number }
// hasReviews = count > 0; avgRating = null when count === 0.

toReviewListItem(review): ReviewListItem
// Maps a Prisma row → client-safe DTO.
// SECURITY: excludes authorId and author.id entirely.
```

### Client-safe DTO

```ts
interface ReviewListItem {
    name: string;       // author.name ?? 'ผู้ใช้งาน'
    rating: number;     // 1–5
    content: string | null;
    createdAt: string | Date;
}
```

`authorId` and `author.id` are **never included** (security rule: authorId must not be exposed to client).

---

## 2. Server-side data — `app/campgrounds/[slug]/page.tsx`

### Two Prisma queries (isolated try/catch — AC-6)

```ts
// Run both in parallel after campSite is resolved:
const [agg, latest] = await Promise.all([
    prisma.review.aggregate({
        where: { campSiteId, deletedAt: null },   // soft-delete filter required
        _avg: { rating: true },
        _count: { rating: true },
    }),
    prisma.review.findMany({
        where: { campSiteId, deletedAt: null },   // soft-delete filter required
        include: { author: { select: { name: true } } },  // name only, no id
        orderBy: { createdAt: 'desc' },
        take: 10,
    }),
]);
```

**`deletedAt: null` filter is required on BOTH queries** — Review is soft-deleted. The existing POST route omits this filter; this implementation corrects it for the read path.

### Error isolation (AC-6)

The review try/catch is **separate** from the campsite lookup. A review DB error sets `reviewsError = true` and returns early; it does NOT call `notFound()` and does NOT throw. The rest of the page (images, facilities, calendar, booking widget) remains usable.

### New props passed to `CampgroundDetailClient`

```ts
avgRating: number | null    // rounded to 1dp; null when no reviews
reviewCount: number         // total (used for >10 "view all" trigger)
reviews: ReviewListItem[]   // up to 10, newest first
reviewsError: boolean       // true when review query threw
```

---

## 3. Client Component contract — `CampgroundDetailClient.tsx`

### New prop signature (additive, all optional with defaults)

```ts
avgRating?: number | null   // default: null
reviewCount?: number        // default: 0
reviews?: ReviewListItem[]  // default: []
reviewsError?: boolean      // default: false
```

### Surface A — Rating display (two locations)

Both locations replaced from hardcoded `4.8`/`12` to:
- **has-reviews** (`reviewCount > 0 && avgRating !== null`): `★ {avgRating} ({reviewCount} รีวิว)` with `aria-label`.
- **empty** (`reviewCount === 0`): plain text `ยังไม่มีรีวิว`, no star, no number.
- Star icon: `aria-hidden="true"`, `fill-foreground text-foreground`.
- Average span: `tabular-nums` class, `font-semibold text-foreground`.
- Wrapper `aria-label` interpolates avg + count or the no-review message.
- `data-testid`: title area = `rating--detail-title`; widget = `rating--detail-widget`.

### Surface B — Review section

- `data-testid="section--reviews"` on the container `<div>`.
- Section heading `<h2>` with `text-2xl font-bold font-display text-foreground` (matches adjacent section headings).
- **has-reviews**: semantic `<ul data-testid="list--reviews">` with `<li data-testid="item--review-{index}">` children.
  - Each item: name (`font-semibold text-foreground text-sm`), star group (`role="img" aria-label="คะแนน {rating} จาก 5 ดาว"`, all icons `aria-hidden="true"`), date (`text-sm text-muted-foreground tabular-nums`), content paragraph only when non-null and non-empty.
  - Divider: `border-b border-border last:border-b-0`.
- **empty**: `<p data-testid="empty--reviews" className="text-muted-foreground text-sm">ยังไม่มีรีวิวสำหรับแคมป์นี้</p>`.
- **error** (`reviewsError`): `<p data-testid="error--reviews" className="text-muted-foreground text-sm">ไม่สามารถโหลดรีวิวได้ในขณะนี้</p>` — NOT a full-page ErrorBanner.
- **"ดูรีวิวทั้งหมด"**: rendered when `reviewCount > 10` (strict); `<Button variant="outline" size="default" disabled aria-disabled="true" aria-label="..." data-testid="btn--reviews-view-all">`. No `onClick` handler.

---

## 4. i18n — new `reviews` namespace in `locales/translations.json`

Keys added (TH + EN):

| Key | TH | EN |
|---|---|---|
| `reviews.noReviews` | ยังไม่มีรีวิว | No reviews yet |
| `reviews.noReviewsSection` | ยังไม่มีรีวิวสำหรับแคมป์นี้ | No reviews for this camp yet |
| `reviews.loadError` | ไม่สามารถโหลดรีวิวได้ในขณะนี้ | Reviews could not be loaded right now |
| `reviews.sectionHeading` | รีวิว | Reviews |
| `reviews.viewAll` | ดูรีวิวทั้งหมด | View all reviews |
| `reviews.authorFallback` | ผู้ใช้งาน | User |
| `reviews.ratingAriaLabel` | คะแนน {avg} จาก 5 ดาว จาก {count} รีวิว | Rating {avg} out of 5 stars from {count} reviews |
| `reviews.itemRatingAriaLabel` | คะแนน {rating} จาก 5 ดาว | Rating {rating} out of 5 stars |
| `reviews.viewAllAriaLabel` | ดูรีวิวทั้งหมด (ยังไม่พร้อมใช้งาน) | View all reviews (not available yet) |

---

## 5. Security notes

- `authorId` is never in the `include` select list; only `author: { select: { name: true } }`.
- `toReviewListItem` produces a DTO without any ID field — authorId cannot leak via the rendered HTML or the serialized prop.
- `deletedAt: null` on both queries ensures soft-deleted reviews are excluded from public display.

---

## 6. Out of scope (not touched)

- `components/CampgroundCard.tsx` — still shows hardcoded `4.8` (listing-surface follow-up, different story).
- `components/MapComponent.tsx` — unchanged.
- POST review form, histogram, pagination — separate stories (C-1.4, C-2.6, C-2.7, C-2.8).

---

## Changelog

- v1 (2026-06-23) — created by Frontend (CAM-79)
