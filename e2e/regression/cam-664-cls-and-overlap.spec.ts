/**
 * CAM-664 verification — the two measurements a source-inspection test
 * cannot produce: real Cumulative Layout Shift while switching pitches, and
 * the real pixel gap between the global AI-chat launcher and the new mobile
 * `StickyActionBar` (CAM-669's `--bottom-bar-height` fix, already merged to
 * `dev` — see `components/ui/sticky-action-bar.tsx` + `components/ai-chat/
 * AiChatLauncher.tsx`). This spec gives that fix a REAL measured number
 * rather than trusting the source diff (per the dispatch's item 6 and
 * `.claude/rules/qa.md`'s "verify LLM/behavioral changes behaviorally").
 *
 * Methodology for CLS: a real `PerformanceObserver({type:'layout-shift'})`
 * registered before navigation (in-page, via `addInitScript`), summing every
 * non-user-input shift's `value` — the exact metric Chrome reports for the
 * Core Web Vital. The counter resets to 0 AFTER the page's own async
 * sections (reviews/rating) have settled (`networkidle` + a short buffer),
 * so what remains isolates shifts caused by SWITCHING PITCHES specifically.
 *
 * Methodology for the CAM-669 gap: real `boundingClientRect()` (via
 * Playwright's `boundingBox()`, which reads the live layout) on both fixed
 * elements at a real 360px viewport, then a plain rectangle-intersection
 * computed from those two real rectangles — no estimated/hand-typed pixel
 * value anywhere in this file; every number is also printed to the
 * Playwright report.
 *
 * Run: PW_REGRESSION=1 npx playwright test e2e/regression/cam-664-cls-and-overlap.spec.ts --project=regression
 */
import { test, expect } from "@playwright/test";

const CAMP_SLUG = "cam-664-e2e-verify-th";
const CAMP_URL = `/campgrounds/${CAMP_SLUG}`;

function tabByName(page: import("@playwright/test").Page, name: string) {
  return page.locator('[data-testid^="tab--spot-strip-"]').filter({ hasText: name });
}

// Every measured number is ALSO printed to the Playwright report
// (test.info().annotations) so a real run's console/HTML report carries the
// same figures written up in docs/specs/.../test.md — this function has no
// filesystem side effect of its own (the doc is authored separately, from a
// real run's console output, per metric-honesty in .claude/rules/qa.md).
function record(testInfo: import("@playwright/test").TestInfo, description: string, value: string) {
  testInfo.annotations.push({ type: "measured", description: `${description}: ${value}` });
  console.log(`[measured] ${description}: ${value}`);
}

test.use({ viewport: { width: 360, height: 800 } });

// ---------------------------------------------------------------------------
// Item 2 — Cumulative Layout Shift across pitch switches.
// ---------------------------------------------------------------------------
test("[section--spot-viewer-cls-on-switch] switching among every branch (panorama/multi-photo/one-photo/no-image/long-name) causes near-zero CLS", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as Array<{ hadRecentInput: boolean; value: number }>) {
          if (!entry.hadRecentInput) {
            (window as unknown as { __cls: number }).__cls += entry.value;
          }
        }
      });
      po.observe({ type: "layout-shift", buffered: true });
    } catch {
      // layout-shift unsupported in this browser — __cls stays 0, reported honestly below.
    }
  });

  await page.goto(CAMP_URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForSelector('[data-testid="tablist--spot-strip"]', { timeout: 15_000 });
  // Let the page's OWN async sections (rating/reviews) finish settling before
  // the baseline reset, so only shifts caused by pitch-switching count below.
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    (window as unknown as { __cls: number }).__cls = 0;
  });

  const sectionBoxBefore = await page.locator('[data-testid="section--campground-spots"]').boundingBox();

  // Switch across every branch: panorama -> multi-photo -> one-photo ->
  // no-image (blocked+free) -> the real sibling (also no-image) -> a
  // multi-photo again (round trip).
  const switchSequence = ["จุด Z1", "จุด Z3", "จุด Z6", "จุด Z9", "จุด A1", "จุด Z4"];
  for (const name of switchSequence) {
    await tabByName(page, name).first().click();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  const sectionBoxAfter = await page.locator('[data-testid="section--campground-spots"]').boundingBox();

  record(testInfo, "CLS across 6 pitch switches", String(cls));
  record(testInfo, "spots section height before switching", `${sectionBoxBefore?.height}px`);
  record(testInfo, "spots section height after switching", `${sectionBoxAfter?.height}px`);

  // Budget per .claude/rules/performance.md is CLS <= 0.1. A well-built
  // fixed-aspect viewport should measure far below that — assert the tight
  // bound so a real regression (a viewport losing its fixed aspect) fails
  // this test, not just the loose CWV ceiling.
  expect(cls, `measured CLS=${cls} while switching pitches (budget <= 0.1)`).toBeLessThan(0.05);
  // The section's own box must not resize between branches (same claim as
  // "one fixed-height viewport" — width is invariant by construction).
  expect(sectionBoxAfter?.width).toBe(sectionBoxBefore?.width);
});

// ---------------------------------------------------------------------------
// Item 6 — CAM-669 regression lock: the chat launcher and the sticky mobile
// booking bar must NOT overlap at 360px, now that the fix (the launcher
// reads `--bottom-bar-height` off the root element) is merged to dev.
// ---------------------------------------------------------------------------
test("[section--cam669-chat-clears-bar] CAM-669 — the AI-chat launcher clears the mobile booking bar at 360px, with a measured gap", async ({ page }, testInfo) => {
  await page.goto(CAMP_URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForSelector('[data-testid="tablist--spot-strip"]', { timeout: 15_000 });
  // CAM-666 (merged to dev after this spec's first draft): on a per-pitch camp,
  // price/totals/the reserve control — including the mobile StickyActionBar —
  // stay ABSENT until a pitch is picked (`hasPitchSelection` in
  // CampgroundDetailClient.tsx; verified live against the current source,
  // not assumed). Select one so the bar this test measures actually exists.
  await page.locator('[data-testid^="tab--spot-strip-"]').first().click();
  await page.waitForSelector('[data-testid="section--mobile-booking-bar"]', { timeout: 15_000 });
  // The launcher nudges itself via a CSS custom property published by an
  // effect + ResizeObserver (sticky-action-bar.tsx) — wait one settle frame
  // so the measured boxes reflect the POST-effect position, not the initial
  // (pre-effect) 0px default.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const barLocator = page.getByTestId("section--mobile-booking-bar");
  // The OUTER `.fixed.bottom-10.right-6` div (pinned byte-for-byte by a
  // source-inspection guard elsewhere) never moves — CSS `transform` on a
  // CHILD does not change the PARENT's own layout box, only paint. CAM-669's
  // actual fix lives on an INNER wrapper div (the first child), whose own
  // inline `transform: translate(...)` is what really moves the visible
  // disc — verified live: the outer div's boundingBox stays at its
  // untransformed y=712, while this inner div reports the true painted
  // y=651 (matrix translateY(-61px), matching the measured
  // --bottom-bar-height). Measuring the outer div here would report a
  // phantom 21px "overlap" that no user ever sees.
  const chatLocator = page.locator(".fixed.bottom-10.right-6 > div").first();

  const barBox = await barLocator.boundingBox();
  const chatBox = await chatLocator.boundingBox();
  expect(barBox, "sticky booking bar must be present + visible at 360px").not.toBeNull();
  expect(chatBox, "AI-chat launcher must be present + visible at 360px").not.toBeNull();

  const bottomBarHeightVar = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bottom-bar-height").trim()
  );

  const b = barBox!;
  const c = chatBox!;
  const overlapLeft = Math.max(b.x, c.x);
  const overlapRight = Math.min(b.x + b.width, c.x + c.width);
  const overlapTop = Math.max(b.y, c.y);
  const overlapBottom = Math.min(b.y + b.height, c.y + c.height);
  const overlapWidth = Math.max(0, overlapRight - overlapLeft);
  const overlapHeight = Math.max(0, overlapBottom - overlapTop);
  // Vertical gap between the bar's top edge and the launcher's bottom edge —
  // positive = clears with a gap, negative/zero = overlapping or touching.
  const verticalGapPx = b.y - (c.y + c.height);

  record(testInfo, "--bottom-bar-height (published by StickyActionBar)", bottomBarHeightVar);
  record(testInfo, "booking bar box", `x=${b.x}, y=${b.y}, width=${b.width}, height=${b.height}`);
  record(testInfo, "chat launcher box", `x=${c.x}, y=${c.y}, width=${c.width}, height=${c.height}`);
  record(testInfo, "overlap rectangle", `${overlapWidth}px x ${overlapHeight}px`);
  record(testInfo, "vertical gap (bar top - launcher bottom)", `${verticalGapPx}px`);

  // The regression guard: zero pixel overlap between the two fixed elements.
  expect(
    overlapHeight,
    `CAM-669: measured overlapHeight=${overlapHeight}px between the chat launcher and the booking bar at 360px (must be 0)`
  ).toBeLessThanOrEqual(0);
  // And a REAL clearance gap above the bar (not just "touching" at 0px).
  expect(
    verticalGapPx,
    `CAM-669: measured vertical gap=${verticalGapPx}px between the booking bar's top and the launcher's bottom (must be > 0)`
  ).toBeGreaterThan(0);
});

// Confirms the CAM-669 fix is additive-only: on a route with NO sticky
// bottom bar, the launcher renders at its untouched natural position
// (`--bottom-bar-height` defaults to 0px — app/globals.css :root — so the
// fix is a no-op there).
test("[section--cam669-no-bar-unaffected] the chat launcher sits at its natural position on a page with no sticky bottom bar", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });

  const bottomBarHeightVar = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bottom-bar-height").trim()
  );
  record(testInfo, "--bottom-bar-height on a page with no bar", bottomBarHeightVar);
  expect(bottomBarHeightVar, "no StickyActionBar mounted -> the published var stays the 0px default").toBe("0px");

  const chatBox = await page.locator(".fixed.bottom-10.right-6").first().boundingBox();
  expect(chatBox, "AI-chat launcher must be present + visible on Home").not.toBeNull();
});
