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
 *      make the dialog impossible to dismiss).
 *
 * AC coverage:
 *   AC-1  opening the province dropdown then clicking inside the modal
 *         keeps the modal open (the reported bug, now fixed)
 *   AC-2  clicking the real overlay/backdrop afterwards still closes it
 */
import { test, expect } from "@playwright/test";

test("opening the province dropdown then clicking inside the modal keeps it open; the backdrop still closes it", async ({ page }) => {
  await page.goto("/");

  // Open the search modal via the desktop search bar (visible at the
  // Desktop Chrome viewport this project runs under).
  await page.getByRole("button", { name: "Search destinations" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Open the province <Select> — the exact repro the owner hit.
  const provinceTrigger = page.getByRole("combobox", { name: "Any province" });
  await provinceTrigger.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();

  // Click somewhere else INSIDE the modal (a plain section heading, no
  // handler of its own) — before the fix this closed the WHOLE dialog.
  await dialog.getByText("Where to?", { exact: true }).click();

  // The select's own dropdown is dismissed by this outside-of-select click
  // (expected, unrelated to this bug) but the DIALOG must still be open.
  await expect(listbox).toBeHidden();
  await expect(dialog).toBeVisible();

  // The fix must not make the dialog impossible to dismiss: a real click on
  // the backdrop (the dimmed area outside the centered modal card) still
  // closes it.
  await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 10, y: 10 } });
  await expect(dialog).toBeHidden();
});
