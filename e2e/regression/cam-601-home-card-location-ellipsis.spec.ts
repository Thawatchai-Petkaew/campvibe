/**
 * CAM-601 — the Home catalog card's location line stays on one line and ends
 * in an ellipsis instead of wrapping, matching CAM-598's assistant-card fix.
 *
 * WHY THIS MEASURES DIFFERENTLY FROM CAM-598. `AiChatCampCard`/
 * `AiChatDetailCard` get their camp data from a CLIENT fetch (`/api/ai/chat`),
 * so CAM-598 could mock the network boundary and drive an arbitrary location
 * string straight through. `CampgroundCard`'s first-page data on Home comes
 * from an async Server Component reading Prisma directly
 * (`CatalogResults.tsx`) — there is no browser-side network call to
 * intercept for the first page, so the real worst-case string cannot be
 * injected via `page.route`. Instead this spec uses the technique documented
 * in `e2e/README.md` ("direct-browser fallback" / "measure rendered
 * geometry") and the one CAM-598 itself used to test its own min-w-0
 * hypothesis: grab the REAL rendered `<p data-testid="text--card-location">`
 * on a REAL seeded card (any of them — every card at a given breakpoint
 * shares the identical grid column width, so which camp it is does not
 * matter) and substitute its `textContent` with the real worst-case string
 * via `page.evaluate`. Every class, every pixel of card width, and the whole
 * grid/container CSS cascade is still the real, compiled app — only the text
 * itself is synthetic, and only because the DB content can't be.
 *
 * MEASURED (real Chromium, local dev server, real grid, before this fix):
 * the worst-case string ("ในเมือง, เมืองนครราชสีมา, นครราชสีมา" — the same
 * live sub-district+district+province repeat CAM-598 used) rendered at
 * every grid breakpoint from mobile (1-col) through 2xl (5-col, wide). Every
 * tier except one happened to fit on one line by a hair (a few px of
 * margin); at the **md tier (768-1023px, 3-col grid, ~224px card — the
 * NARROWEST card width in the whole responsive grid, narrower than lg/xl's
 * 4-5 col cards because the container hasn't grown past 768px yet)** the
 * text measured 224.5px intrinsic vs a 224px box: it wrapped to 2 visible
 * lines (height 40px vs the single-line 20px), making that card taller than
 * its row siblings. See design.md for the full measured table across all 6
 * breakpoints, before and after.
 */
import { test, expect, type Page } from "@playwright/test";

/** CAM-597/CAM-598's real worst case: a sub-district, district and province
 * that all repeat "เมือง" — a live camp, not a hypothetical. */
const WORST_CASE_LOCATION = "ในเมือง, เมืองนครราชสีมา, นครราชสีมา";

/** Behavioural, not class-name: real scrollWidth/clientWidth + real box height vs one line-height. */
async function measureSingleLine(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || r.height;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      height: r.height,
      lineHeight,
    };
  });
}

/** Loads Home, grabs the first real seeded card's location line, and
 * substitutes the real worst-case string onto it (see the file-level
 * comment for why this is the right technique here). */
async function measureHomeCardLocation(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  // The shared regression storageState forces Thai (e2e/regression/README.md
  // "the language trap") — irrelevant here since the text is substituted
  // directly, but Home itself renders fine either way.
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });

  const loc = page.getByTestId("text--card-location").first();
  await loc.waitFor({ state: "visible", timeout: 15_000 });
  await loc.evaluate((el, text) => {
    el.textContent = text;
  }, WORST_CASE_LOCATION);

  return measureSingleLine(loc);
}

// (width, breakpoint, columns) — md is the narrowest card in the whole grid
// (see the file-level comment) and the one that actually wrapped pre-fix;
// mobile/lg are included as a no-regression check at the roomier tiers.
const CASES = [
  { label: "mobile 390px (1-col)", width: 390, height: 844 },
  { label: "md 900px (3-col, narrowest card — where it wrapped pre-fix)", width: 900, height: 900 },
  { label: "lg 1200px (4-col)", width: 1200, height: 900 },
] as const;

for (const { label, width, height } of CASES) {
  test(`Home catalog card — the real worst-case location stays on one line at ${label}`, async ({ page }) => {
    const geom = await measureHomeCardLocation(page, width, height);

    expect(
      geom.scrollWidth,
      `scrollWidth=${geom.scrollWidth} vs clientWidth=${geom.clientWidth} at ${label}`
    ).toBeLessThanOrEqual(geom.clientWidth);
    expect(
      geom.height,
      `height=${geom.height} vs one line-height=${geom.lineHeight} at ${label} ` +
        "(before this fix: the md tier measured height=40 — 2 wrapped lines)"
    ).toBeLessThanOrEqual(geom.lineHeight + 1);
  });
}
