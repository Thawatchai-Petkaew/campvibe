/**
 * CAM-561 — the search dialog is full screen on a phone with no header bar;
 * desktop is unchanged; a reachable mobile dismiss path exists; Escape still
 * closes it; CAM-540's dismiss guard survives at a phone viewport too.
 *
 * Given the home page's search dialog (public, no login required — same
 *      convention as e2e/regression/cam-540-dialog-select-dismiss.spec.ts)
 * When opened at a real phone viewport
 * Then the dialog's bounding box fills the viewport; the header's close (×)
 *      is absent (display:none, not merely visually hidden — the honest
 *      Playwright signal for "removed", matching CAM-550's toggle check);
 *      the SAME close (×) DOES render at a real desktop viewport (proves the
 *      mobile absence is a viewport fork, not a deletion); a mobile-only
 *      close control is reachable and works; Escape still closes it; opening
 *      a Select inside the dialog and clicking elsewhere inside it does not
 *      dismiss the dialog (CAM-540's guard, re-verified at a phone width).
 *
 * AC coverage:
 *   AC-1 the dialog's bounding box fills the phone viewport (measured)
 *   AC-2 the header's close (×) is absent on mobile; the SAME control DOES
 *        render at desktop (both measured at their own real viewport — the
 *        honest instrument for a responsive-CSS claim)
 *   AC-3 a mobile-only close control is visible + reachable + closes the
 *        dialog without submitting a search (no navigation)
 *   AC-4 / BR-4 Escape closes the dialog at a phone width; CAM-540's guard
 *        (Select-open-then-click-inside must not dismiss) still holds at a
 *        phone width
 *
 * Selector notes (reusing CAM-540's proven approach, not re-guessing):
 *   - Desktop opener has no testid; it's the widest (>300px) button in `nav`
 *     (see cam-540-dialog-select-dismiss.spec.ts for why a role+name lookup
 *     is not stable here).
 *   - The mobile opener DOES carry a stable testid:
 *     `section--navbar-search-mobile` (components/Navbar.tsx, `md:hidden`).
 *   - `page.goto` uses `networkidle` + a short settle wait — the home page
 *     keeps fetching past "load" (CAM-540 lesson).
 */
import { test, expect } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 664 }; // iPhone 13-class
const DESKTOP_VIEWPORT = { width: 1440, height: 950 };

async function openMobileSearch(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1_000);
  await page.getByTestId("section--navbar-search-mobile").click();
  await page.waitForTimeout(500);
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toHaveCount(1);
  return dialog;
}

async function findDesktopOpener(page: import("@playwright/test").Page) {
  const navButtons = page.locator("nav button");
  const count = await navButtons.count();
  for (let i = 0; i < count; i++) {
    const candidate = navButtons.nth(i);
    const box = await candidate.boundingBox();
    if (box && box.width > 300) return candidate;
  }
  throw new Error("expected a wide (>300px) search-bar button in nav");
}

test.describe("AC-1 — the dialog fills the phone viewport", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("the dialog's bounding box matches the phone viewport exactly (fixed, h-[100dvh], no inset margin)", async ({ page }) => {
    const dialog = await openMobileSearch(page);
    await page.waitForTimeout(400); // let the entrance transition settle
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
    expect(box!.width).toBeGreaterThanOrEqual(PHONE_VIEWPORT.width - 2);
    expect(box!.height).toBeGreaterThanOrEqual(PHONE_VIEWPORT.height - 2);
  });
});

test.describe("AC-2 — header close (×) is absent on mobile; present on desktop (viewport fork, not a deletion)", () => {
  test("mobile: the header's close (×) is not in the accessible tree at all (display:none)", async ({ page }) => {
    await page.setViewportSize(PHONE_VIEWPORT);
    await openMobileSearch(page);
    await expect(page.getByTestId("btn--modal-close")).toBeHidden();
  });

  test("desktop: the SAME close (×) DOES render", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/", { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(1_000);
    const opener = await findDesktopOpener(page);
    await opener.click();
    await page.waitForTimeout(500);
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await expect(page.getByTestId("btn--modal-close")).toBeVisible();
    // Regression guard: the mobile-only close control must NOT appear on desktop.
    await expect(page.getByTestId("btn--search-mobile-close")).toBeHidden();
  });
});

test.describe("AC-3 — the mobile close control is reachable and closes the dialog without searching", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("tapping the mobile close control closes the dialog and does not navigate/apply a search", async ({ page }) => {
    const dialog = await openMobileSearch(page);
    await expect(page.getByTestId("btn--search-mobile-close")).toBeVisible();
    const urlBefore = page.url();
    await page.getByTestId("btn--search-mobile-close").click();
    await expect(dialog).toHaveCount(0);
    expect(page.url()).toBe(urlBefore);
  });
});

test.describe("AC-4 / BR-4 — Escape still closes on mobile; CAM-540's guard survives at a phone width", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("Escape closes the full-screen dialog", async ({ page }) => {
    const dialog = await openMobileSearch(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("opening the province Select then clicking inside the dialog keeps it open; a real backdrop-equivalent path still closes it (CAM-540 guard, phone width)", async ({ page }) => {
    const dialog = await openMobileSearch(page);

    await page.locator('[data-testid="select--search-province"]').click();
    await expect(page.locator('[role="listbox"]')).toBeVisible();

    // Click inside the dialog but outside the listbox — the top-right corner
    // of the full-screen dialog, clearly clear of both the left-aligned
    // mobile close control and the (lower, trigger-anchored) listbox. Same
    // "click inside the dialog, away from the trigger" idea as CAM-540's
    // desktop spec, adapted to this layout's geometry.
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    await page.mouse.click(dialogBox!.x + dialogBox!.width - 20, dialogBox!.y + 20);
    await page.waitForTimeout(300);

    // The select's own dropdown dismisses (expected) but the dialog stays open.
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);
    await expect(dialog).toHaveCount(1);

    // The fix must not make the full-screen dialog impossible to dismiss:
    // Escape (the one dismiss path guaranteed not to hit-test into content).
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
