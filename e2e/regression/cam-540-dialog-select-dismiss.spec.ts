/**
 * CAM-540 — opening a <Select> inside the search modal no longer closes
 * the whole modal.
 *
 * Given the home page's search modal (public, no login required — this spec
 * intentionally stays anonymous per the ticket, unlike the other 6 specs in
 * this directory which drive authenticated host CRUD flows)
 * When the province <Select> is opened and the user then clicks elsewhere
 *      INSIDE the modal (a real, hit-tested click via Playwright — the one
 *      thing jsdom cannot approximate; see __tests__/cam-540-*.test.ts for
 *      why the unit layer alone cannot prove this)
 * Then the modal stays open (only the dropdown closes); a subsequent click
 *      on the real backdrop still closes the whole modal (the fix must not
 *      make the dialog impossible to dismiss); Escape also still closes it.
 *
 * AC coverage:
 *   AC-1  opening the province dropdown then clicking inside the modal
 *         keeps the modal open (the reported bug, now fixed)
 *   AC-2  clicking the real overlay/backdrop afterwards still closes it
 *   AC-3  Escape still closes it
 *
 * Selector/wait notes (CAM-540 CI failure #1 — recorded so the cause isn't
 * silently re-guessed a second time):
 *   - The desktop search-bar opener (components/Navbar.tsx) has NO testid and
 *     its accessible name is 3 concatenated <div> labels ("Search
 *     destinations" / "Any week" / "Add guests") that change with the URL's
 *     query params — a role+name lookup on it is not a stable target. It IS
 *     reliably the widest button in `nav` (`hidden md:flex ... max-w-xl`),
 *     so it's found by boundingBox width instead of by name.
 *   - `page.goto("/")` with the default `waitUntil` was not enough: the home
 *     page keeps fetching after "load" (Navbar's dashboard-access check,
 *     catalog data, etc.), so the very first `.click()` on a freshly
 *     resolved locator could race a re-render. `networkidle` + a short
 *     settle wait removes that race.
 *   - The province <Select> DOES carry a stable testid
 *     (`select--search-province`, added by CAM-531) — use it directly rather
 *     than a role+name lookup.
 */
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 950 } });

test("opening the province dropdown then clicking inside the modal keeps it open; the backdrop and Escape still close it", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1_000);

  // The desktop search-bar opener has no testid — it is reliably the widest
  // button in `nav` (the mobile bar is a <div>, not a <button>).
  const navButtons = page.locator("nav button");
  const navButtonCount = await navButtons.count();
  let opener = null;
  for (let i = 0; i < navButtonCount; i++) {
    const candidate = navButtons.nth(i);
    const box = await candidate.boundingBox();
    if (box && box.width > 300) {
      opener = candidate;
      break;
    }
  }
  expect(opener, "expected a wide (>300px) search-bar button in nav").not.toBeNull();
  await opener!.click();
  await page.waitForTimeout(1_500);

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toHaveCount(1);

  // Open the province <Select> — the exact repro the owner hit.
  await page.locator('[data-testid="select--search-province"]').click();
  await expect(page.locator('[role="listbox"]')).toBeVisible();

  // Click "inside the modal but outside the dropdown" — the top-centre strip
  // of the dialog card, well clear of the province trigger/listbox.
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  await page.mouse.click(dialogBox!.x + dialogBox!.width / 2, dialogBox!.y + 20);
  await page.waitForTimeout(300);

  // The select's own dropdown is dismissed by this outside-of-select click
  // (expected, unrelated to this bug) but the DIALOG must still be open —
  // this is the exact sequence that closed the whole dialog before the fix.
  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  await expect(dialog).toHaveCount(1);

  // The fix must not make the dialog impossible to dismiss: a real click
  // clearly OUTSIDE the dialog's bounds (the dimmed backdrop) still closes it.
  await page.mouse.click(10, 10);
  await expect(dialog).toHaveCount(0);

  // Escape also still closes it (a separate, untouched code path).
  await opener!.click();
  await page.waitForTimeout(1_500);
  await expect(dialog).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
