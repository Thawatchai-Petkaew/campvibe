/**
 * CAM-549 — AC-3: scrolling the Home page on a phone leaves ONLY the
 * search bar pinned to the top; the navbar's title row and CategoryBar's
 * wrapper (the "second bar" / stray-line defect the owner reported) are
 * both plain scrolled-away content at that point.
 *
 * Teeth: this asserts what SURVIVES (the search bar is pinned at top:0)
 * AND what does NOT survive (title row + CategoryBar wrapper are not
 * `position: sticky`/`fixed` and have scrolled above the viewport) — a
 * test that only checked the removed element would pass even if the
 * search bar itself vanished too.
 */
import { test, expect } from "@playwright/test";

test("only the search bar stays pinned while scrolling on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
  await expect(page.getByTestId("btn--wishlist-nav")).toBeVisible();

  // Scroll down past the navbar + category bar's natural height, then back
  // up a little (mirrors the owner's exact repro: "scrolling up leaves two
  // bars").
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => {
    const rectOf = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { top: r.top, bottom: r.bottom, position: cs.position };
    };
    return {
      searchBar: rectOf(document.querySelector('[data-testid="section--navbar-search-mobile"]')),
      titleRow: rectOf(document.querySelector('[data-testid="section--navbar-title-row"]')?.closest("nav") ?? null),
      categoryBarWrapper: rectOf(document.querySelector('[data-testid="section--category-bar-wrapper"]')),
    };
  });

  // The search bar: the ONE thing that survives, pinned to the very top.
  expect(state.searchBar, "search bar element not found").not.toBeNull();
  expect(state.searchBar!.position).toBe("sticky");
  expect(state.searchBar!.top).toBeGreaterThanOrEqual(-1);
  expect(state.searchBar!.top).toBeLessThanOrEqual(1);

  // The navbar title row: NOT pinned — plain static content that has
  // scrolled up above the viewport (this used to be part of one big
  // "sticky top-0" block that never went away).
  expect(state.titleRow, "nav title row not found").not.toBeNull();
  expect(state.titleRow!.position).not.toBe("sticky");
  expect(state.titleRow!.position).not.toBe("fixed");
  expect(state.titleRow!.bottom).toBeLessThanOrEqual(0);

  // CategoryBar's wrapper: NOT pinned either — this was the "stray line"
  // (a ~14px sliver peeking out from behind the taller mobile navbar).
  // It must not be a sticky/fixed survivor of its own at this scroll
  // position.
  expect(state.categoryBarWrapper, "CategoryBar wrapper not found").not.toBeNull();
  expect(state.categoryBarWrapper!.position).not.toBe("sticky");
  expect(state.categoryBarWrapper!.position).not.toBe("fixed");
});

test("desktop keeps both the full navbar and CategoryBar pinned while scrolling (AC-4, unchanged)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });

  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => {
    const rectOf = (el: Element | null) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { position: cs.position };
    };
    return {
      nav: rectOf(document.querySelector("nav")),
      categoryBarWrapper: rectOf(document.querySelector('[data-testid="section--category-bar-wrapper"]')),
    };
  });

  expect(state.nav?.position).toBe("sticky");
  expect(state.categoryBarWrapper?.position).toBe("sticky");
});
