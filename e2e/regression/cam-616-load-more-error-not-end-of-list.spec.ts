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
 */
import { test, expect } from "@playwright/test";

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
