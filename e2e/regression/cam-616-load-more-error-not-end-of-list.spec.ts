/**
 * CAM-616 — a failed "load more" page on the home catalog must render a
 * retry affordance, never the "you've reached the end of the list" message.
 *
 * Before this fix, InfiniteScrollGrid's fetchNextPage set `done=true` on
 * BOTH a genuine end-of-list (`nextCursor === null`) and a failed/errored
 * page-2 fetch, with no way to tell the two apart — a network hiccup or a
 * 5xx read as "you have seen everything" (components/InfiniteScrollGrid.tsx,
 * line ~170 in the original).
 *
 * This spec drives the REAL browser + REAL component (no source-inspection,
 * no component-level mock) — only the network response to `/api/campsites`
 * is intercepted, exactly the boundary a user's browser actually observes.
 * Runs under the `regression` Playwright project (real Next.js dev server,
 * `e2e/regression/` per this story's allowed file surface); the Home route
 * itself needs no authentication.
 *
 * Data precondition (found by actually RUNNING this spec, not assumed):
 * `prisma/seed.ts` ships exactly 12 published campsites — fewer than
 * `PAGE_SIZE` (24, `lib/catalog-cursor.ts`). With <= PAGE_SIZE rows, the
 * SSR default-catalog read computes `initialCursor = null`
 * (`components/CatalogResults.tsx`: `campSites.length === PAGE_SIZE && ...`),
 * so InfiniteScrollGrid mounts with `done = true` from the very first
 * render — its own guard (`if (loading || done || cursor === null) return;`)
 * then means the sentinel entering view NEVER issues a client fetch to
 * `/api/campsites` at all, so this spec's route interception had nothing to
 * catch (the FIRST failed local run: `banner--load-more-error` "element(s)
 * not found", with a real 500 route armed but never hit). This was a test
 * precondition gap, not a defect in the fix — confirmed by cloning enough
 * rows below to make a genuine page-2 request exist, then observing BOTH
 * the fixed behavior (this spec, green) and the pre-fix behavior (manually
 * reverted, red — see this story's design.md teeth-proof log).
 */
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const EXTRA_CLONES = 15; // 12 seeded + 15 = 27 > PAGE_SIZE (24) -> a real page 2 exists

let prisma: PrismaClient;
const extraCampSiteIds: string[] = [];

test.beforeAll(async () => {
  prisma = new PrismaClient();

  // Clone ONE real seeded, published campsite N times (reusing its
  // locationId/operatorId FKs — no new dependency graph needed) so the
  // default catalog's total row count genuinely exceeds PAGE_SIZE and a
  // real `nextCursor` exists for the SSR page to hand InfiniteScrollGrid.
  const template = await prisma.campSite.findFirst({
    where: { isPublished: true, isActive: true, deletedAt: null },
  });
  if (!template) {
    throw new Error(
      "No seeded published campsite found to clone from — run `npm run e2e:db:setup` first."
    );
  }

  const { id: _id, nameThSlug, nameEnSlug, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = template;

  for (let i = 0; i < EXTRA_CLONES; i++) {
    const created = await prisma.campSite.create({
      data: {
        ...rest,
        nameThSlug: `${nameThSlug}-e2e616-${i}`,
        nameEnSlug: `${nameEnSlug}-e2e616-${i}`,
      },
    });
    extraCampSiteIds.push(created.id);
  }
});

test.afterAll(async () => {
  if (extraCampSiteIds.length > 0) {
    await prisma.campSite.deleteMany({ where: { id: { in: extraCampSiteIds } } });
  }
  await prisma.$disconnect();
});

test.describe("InfiniteScrollGrid — page-2 failure renders retry, not end-of-list", () => {
  test("a 500 on the cursor endpoint shows the retry banner, never the end-of-list copy", async ({ page }) => {
    // Force the FIRST /api/campsites cursor call (the page-2 "load more"
    // request the IntersectionObserver fires) to fail with a 500 — the
    // real-world shape of the DB outage this ticket describes.
    let intercepted = false;
    await page.route("**/api/campsites?*", async (route) => {
      if (!intercepted) {
        intercepted = true;
        await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
        return;
      }
      await route.continue();
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // Sanity: the SSR page must have actually shipped a real next page —
    // otherwise this spec would (again) silently prove nothing.
    await expect(page.getByTestId("sentinel--infinite-scroll")).toHaveCount(1);

    // Scroll the sentinel into view to fire the IntersectionObserver's
    // fetchNextPage — the same trigger a real camper's scroll produces.
    await page.getByTestId("sentinel--infinite-scroll").scrollIntoViewIfNeeded();

    await expect(page.getByTestId("banner--load-more-error")).toBeVisible();
    await expect(page.getByTestId("text--end-of-list")).toHaveCount(0);

    // The retry button recovers once the endpoint is healthy again.
    await page.getByTestId("btn--catalog-load-more-retry").click();
    await expect(page.getByTestId("banner--load-more-error")).toHaveCount(0);
  });
});
