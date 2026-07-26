/**
 * CAM-560 — the category strip's labels stop overlapping on a phone.
 *
 * Root cause (see story.md "Seams & refs"): CAM-552 gave each tab an
 * explicit `min-w-[56px] md:min-w-[64px]`, which overrides a flex item's
 * default content-based `min-width: auto`. With no `shrink-0`, the browser
 * is free to compress a tab's box narrower than its own nowrap label
 * whenever the strip's 10 tabs (as they always do) exceed the viewport
 * width — the unclipped label then visually spills into the next tab's
 * space, reading as one run-together string (`ลานกางเต็นท์แคมป์ด้วยรถ`).
 *
 * Measured honestly (metric-honesty, `.claude/rules/performance.md`): at
 * this repo's default OS/browser font scale, headless Chromium at 390px
 * renders the worst pair (`ลานกางเต็นท์`/`แคมป์ด้วยรถ`) with the pre-fix
 * code just ~15px SHORT of touching (btn box forced to the 56px floor while
 * the label needs ~66-75px) — a real, measured near-miss, not an overlap,
 * in THIS harness. Scaling the root font-size to 24px (~150%, a realistic
 * phone "Larger text" accessibility setting many devices ship at) makes the
 * SAME pre-fix code overlap for real (confirmed: label right edge 217.5 >
 * next label's left edge 212.7) and the fix (shrink-0) removes the overlap
 * entirely at that same scale (each tab grows to its full ~99px/95px
 * content width instead of compressing) — this is the genuine, reproduced
 * Prove-It case below. The plain 320/390px checks stay as the ticket's
 * literal AC-1/AC-2 regression guard for the ordinary case.
 *
 * The direct, unfakeable statement of the defect per the ticket: measure
 * each label's real bounding box in a real browser and assert no two
 * adjacent labels intersect. Checked across the WHOLE `CATEGORIES` set (all
 * 9 adjacent pairs), not only the `campground`/`carCamping` pair from the
 * report, and at both 320px and 390px per the ticket's minimum widths.
 *
 * Home is a public route (no auth redirect — verified in app/page.tsx), so
 * this spec does not depend on the regression-setup login itself; it only
 * inherits that project's dependency because the file lives under
 * e2e/regression per this repo's existing CAM-540/CAM-549 convention. The
 * `regression-setup` project already sets `campvibe_lang=th` in
 * localStorage (see global.setup.ts), so the Thai copy renders here too.
 */
import { test, expect, type Page } from "@playwright/test";

// Thai labels for every entry in components/CategoryBar.tsx's CATEGORIES,
// in DOM order — the full set, not just the two named in the bug report.
const CATEGORY_LABEL_KEYS = [
  "all",
  "campground",
  "carCamping",
  "glamping",
  "beach",
  "sea",
  "forest",
  "mountain",
  "riverside",
  "waterfall",
] as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function getLabelBoxes(page: Page): Promise<Box[]> {
  const boxes: Box[] = [];
  for (const key of CATEGORY_LABEL_KEYS) {
    const locator = page.getByTestId(`text--category-label-${key}`);
    await expect(locator, `category label "${key}" did not render`).toBeVisible();
    const box = await locator.boundingBox();
    expect(box, `no bounding box for category label "${key}"`).not.toBeNull();
    boxes.push(box!);
  }
  return boxes;
}

const PHONE_WIDTHS = [320, 390];

for (const width of PHONE_WIDTHS) {
  test(`no two category labels overlap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });

    const boxes = await getLabelBoxes(page);

    // Every adjacent pair in DOM order (the reported pair is just one of
    // these) — a real overlap anywhere in the row must fail this.
    for (let i = 0; i < boxes.length - 1; i++) {
      const a = boxes[i];
      const b = boxes[i + 1];
      expect(
        intersects(a, b),
        `"${CATEGORY_LABEL_KEYS[i]}" (x:${a.x.toFixed(1)} w:${a.width.toFixed(1)}) overlaps ` +
          `"${CATEGORY_LABEL_KEYS[i + 1]}" (x:${b.x.toFixed(1)} w:${b.width.toFixed(1)}) at ${width}px`
      ).toBe(false);
    }
  });
}

test("PROVE-IT: no overlap at a realistic larger phone text scale (the reproduced mechanism)", async ({ page }) => {
  // A ~150% root font-size mirrors a common phone "Larger text" setting.
  // `min-w-[56px]` is a literal px value (does not scale with the root
  // font-size the way the label's rem-based type-caption does), so this is
  // exactly the condition that turns the ordinary near-miss into the real,
  // reported overlap on the pre-fix source (measured and confirmed while
  // building this fix — see the file header).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
  await page.addStyleTag({ content: "html { font-size: 24px !important; }" });

  const boxes = await getLabelBoxes(page);
  for (let i = 0; i < boxes.length - 1; i++) {
    const a = boxes[i];
    const b = boxes[i + 1];
    expect(
      intersects(a, b),
      `"${CATEGORY_LABEL_KEYS[i]}" overlaps "${CATEGORY_LABEL_KEYS[i + 1]}" at 150% text scale`
    ).toBe(false);
  }
});

test("the category strip still scrolls horizontally (the affordance is not removed)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });

  const firstTab = page.getByTestId(`btn--category-${CATEGORY_LABEL_KEYS[0]}`);
  await expect(firstTab).toBeVisible();

  const strip = page.locator("div.overflow-x-auto.no-scrollbar").first();
  const metrics = await strip.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  // 10 tabs at their natural (unshrunk) width must exceed a 390px viewport —
  // proving the fix didn't accidentally make everything fit by shrinking.
  expect(metrics.scrollWidth, `scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth}`).toBeGreaterThan(
    metrics.clientWidth
  );

  const lastTab = page.getByTestId(`btn--category-${CATEGORY_LABEL_KEYS[CATEGORY_LABEL_KEYS.length - 1]}`);
  await lastTab.scrollIntoViewIfNeeded();
  await expect(lastTab).toBeInViewport();
});

test("every category tab's tap target stays at or above the 44px touch floor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });

  for (const key of CATEGORY_LABEL_KEYS) {
    const box = await page.getByTestId(`btn--category-${key}`).boundingBox();
    expect(box, `no bounding box for category button "${key}"`).not.toBeNull();
    expect(box!.height, `"${key}" button height`).toBeGreaterThanOrEqual(44);
    expect(box!.width, `"${key}" button width`).toBeGreaterThanOrEqual(44);
  }
});
