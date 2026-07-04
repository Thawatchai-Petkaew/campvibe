---
linear: CAM-147
feature: discovery-search
epic: camper-discover-search (CAM-33)
artifact: test
owner: qa
status: In Progress
version: v1
updated: 2026-06-23
---
# Test — แสดงคะแนนรีวิวจริงบนการ์ดและ map popup (เลิก hardcode 4.8) (CAM-147)

## Layer rationale

CampgroundCard, MapComponent, CampgroundDetailClient, app/page.tsx, and
app/wishlist/page.tsx are either "use client" components with many shadcn/next/lucide
dependencies, or Next.js async Server Components that call Prisma and auth().
Rendering them inside vitest/jsdom would require mocking more than 15 module
boundaries and would validate the mocks, not the real code.

Per the CAM-79 precedent (review-summary.test.ts AC-5/AC-6 sections), the correct
layer for these surfaces is source-inspection: assert that the exact conditional,
testid, import, and strip pattern are present in the real source files. This is
proportionate — the logic under test (a JSX conditional, a prop forward, a query
include, a destructure strip) is a single, readable construct in each file.

The reused helpers (`computeAvgRating` in `lib/sort-utils.ts`, `roundAvgRating` in
`lib/review-summary.ts`) are already 100%-covered by `sort-utils.test.ts` (CAM-76)
and `review-summary.test.ts` (CAM-79) respectively. This story adds no new averaging
or rounding logic; coverage of the helpers is not re-measured here.

Coverage note: no coverage % is reported for this story's new code (wiring +
display conditionals in Server/Client Components). Stating this honestly per
`.claude/rules/qa.md` "Metric honesty" — "not measured" rather than fabricated.

## AC → test matrix

| AC# | test-id / describe block | layer | pass/fail |
|-----|--------------------------|-------|-----------|
| AC-1 | `AC-1/AC-5 — CampgroundCard: real avgRating conditional + testid + prop forwarding` > `[source] CampgroundCard.tsx renders rating slot only when reviewCount > 0 && avgRating != null` | source-inspection | PASS |
| AC-1 | same describe > `[source] CampgroundCard.tsx renders data-testid="rating--card-avg"` | source-inspection | PASS |
| AC-1 | same describe > `[source] CampgroundCard.tsx renders the Star icon in the has-reviews branch` | source-inspection | PASS |
| AC-1 | same describe > `[source] CampgroundGrid.tsx forwards avgRating to CampgroundCard` | source-inspection | PASS |
| AC-1 | same describe > `[source] CampgroundGrid.tsx forwards reviewCount to CampgroundCard` | source-inspection | PASS |
| AC-2 | `AC-2 — CampgroundCard: empty state + no hardcoded 4.8` > `[source] renders data-testid="empty--card-rating"` | source-inspection | PASS |
| AC-2 | same describe > `[source] empty-state branch uses t.reviews.noReviews` | source-inspection | PASS |
| AC-2 | same describe > `[source] does NOT contain hardcoded "4.8"` | source-inspection | PASS |
| AC-2 | same describe > `[logic] reviewCount=0 && avgRating=null does NOT satisfy guard` | unit-logic | PASS |
| AC-2 | same describe > `[logic] reviewCount=1 && avgRating=4.2 satisfies the guard` | unit-logic | PASS |
| AC-2 | same describe > `[boundary] reviewCount=0 with any avgRating → empty state` | unit-logic | PASS |
| AC-2 | same describe > `[boundary] reviewCount>0 but avgRating=null → empty state (AND guard)` | unit-logic | PASS |
| AC-3 | `AC-3/AC-4 — MapComponent: popup rating conditional + testids + no hardcoded 4.8` > `[source] renders reviewCount > 0 && avgRating != null guard` | source-inspection | PASS |
| AC-3 | same describe > `[source] renders data-testid="rating--map-popup-avg"` | source-inspection | PASS |
| AC-3 | same describe > `[source] CampgroundDetailClient.tsx threads avgRating into DynamicMap` | source-inspection | PASS |
| AC-3 | same describe > `[source] CampgroundDetailClient.tsx threads reviewCount into DynamicMap` | source-inspection | PASS |
| AC-4 | same describe > `[source] renders data-testid="empty--map-popup-rating"` | source-inspection | PASS |
| AC-4 | same describe > `[source] does NOT contain hardcoded "4.8"` | source-inspection | PASS |
| AC-4 | same describe > `[source] empty-state branch uses t.reviews.noReviews` | source-inspection | PASS |
| AC-5 | `AC-1/AC-5` describe > `[source] WishlistPageClient.tsx forwards avgRating from camp to CampgroundCard` | source-inspection | PASS |
| AC-5 | same describe > `[source] WishlistPageClient.tsx forwards reviewCount from camp to CampgroundCard` | source-inspection | PASS |
| data/security | `Data correctness / security — reviews include + avg compute + strip` > `[source] app/page.tsx rating-sort branch includes reviews with deletedAt:null` | source-inspection | PASS |
| data/security | same describe > `[source] app/page.tsx else branch ALSO includes reviews (all sort modes)` | source-inspection | PASS |
| data/security | same describe > `[source] app/page.tsx strips reviews array (no PII leak)` | source-inspection | PASS |
| data/security | same describe > `[source] app/page.tsx computes avgRating via roundAvgRating(computeAvgRating(_reviews))` | source-inspection | PASS |
| data/security | same describe > `[source] app/wishlist/page.tsx includes reviews with deletedAt:null` | source-inspection | PASS |
| data/security | same describe > `[source] app/wishlist/page.tsx strips reviews array` | source-inspection | PASS |
| data/security | same describe > `[security] CampgroundCard.tsx does NOT define its own averaging` | source-inspection | PASS |
| data/security | same describe > `[security] MapComponent.tsx does NOT define its own averaging` | source-inspection | PASS |
| i18n | `i18n verbatim — reviews.noReviews + reviews.ratingAriaLabelShort` > `[copy] th.reviews.noReviews === "ยังไม่มีรีวิว"` | unit (JSON) | PASS |
| i18n | same describe > `[copy] th.reviews.ratingAriaLabelShort === "คะแนน {avg} จาก 5 ดาว"` | unit (JSON) | PASS |
| i18n | same describe > `[copy] th.reviews.ratingAriaLabelShort contains "คะแนน"` | unit (JSON) | PASS |
| i18n | same describe > `[copy] th.reviews.ratingAriaLabelShort contains "จาก 5"` | unit (JSON) | PASS |
| i18n | same describe > `[copy] en.reviews.ratingAriaLabelShort === "Rating {avg} out of 5 stars"` | unit (JSON) | PASS |
| reuse | `Reuse rule — no duplicate avg/rounding logic` > `[reuse] CampgroundCard.tsx does NOT import computeAvgRating` | source-inspection | PASS |
| reuse | same describe > `[reuse] MapComponent.tsx does NOT import computeAvgRating` | source-inspection | PASS |
| reuse | same describe > `[reuse] app/page.tsx imports computeAvgRating from lib/sort-utils` | source-inspection | PASS |
| reuse | same describe > `[reuse] app/page.tsx imports roundAvgRating from lib/review-summary` | source-inspection | PASS |
| KPI | `KPI: no hardcoded "4.8" in any changed file` (7 assertions, all files) | source-inspection | PASS |

## Run result

```
Test Files  37 passed (37)
      Tests  2079 passed (2079)
   Start at  19:54:35
   Duration  ~1s
```

`npm run typecheck` — clean (0 errors).
`npm run lint` — 0 errors, 224 pre-existing warnings (not introduced by this story).

## Coverage note (honest)

- `computeAvgRating` (lib/sort-utils.ts): already 100% covered by `sort-utils.test.ts` (CAM-76).
- `roundAvgRating` (lib/review-summary.ts): already 100% covered by `review-summary.test.ts` (CAM-79).
- New code in this story is wiring + display conditionals inside Next.js Server Components and "use client" components. Coverage % for these surfaces is **not measured** (these cannot be exercised with vitest/node without mocking the entire Next.js runtime). Source-inspection is the documented precedent for this class of code (CAM-79 / CAM-76).

## Defects

None found. All assertions pass:
- Both sort branches in `app/page.tsx` include `reviews: { where: { deletedAt: null }, select: { rating: true } }`.
- The strip pattern `({ reviews: _reviews, ...rest })` is present in both sort branches.
- No hardcoded `"4.8"` remains in any changed file.
- `th.reviews.ratingAriaLabelShort` exists and equals `"คะแนน {avg} จาก 5 ดาว"` verbatim.
- `en.reviews.ratingAriaLabelShort` exists and equals `"Rating {avg} out of 5 stars"`.

## Limitations

- Map popup and card interactive rendering are not exercised end-to-end (no Playwright run on Staging). Real AC verification requires the Staging URL check (`campvibe-staging.vercel.app`) per `.claude/rules/ops.md`.
- Concurrent/ordering bucket: N/A for this story — the wiring is stateless (server-computed scalars forwarded as props, no async ordering concern in the display layer).

## Next

Ready for Staging URL verification (G4 sign-off). No defects. The story requires human sign-off on the real Staging URL (`campvibe-staging.vercel.app`) before Linear state transitions to `Done`.
