/**
 * CAM-359 AC-1 — edit round trip: nameTh + priceLow persist after reopen.
 *
 * Given a logged-in host on the edit form of a seeded, save-valid camp
 * When they change nameTh and priceLow, save, then reopen the edit form
 * Then they land back on the campsites list showing the new name; the
 *      reopened form shows the new name and price (persisted, not a new row)
 */
import { test, expect } from "@playwright/test";
import { findCampBySlug, getCampSite } from "./helpers";

// Dedicated to THIS spec only — every spec targets its own seeded camp
// (prisma/seed.ts) so concurrent spec files never race the same DB row.
const SEED_SLUG = "khao-yai-camping-site-2";

test("edit round trip: updated nameTh + priceLow persist across save + reopen", async ({ page, request }) => {
  const camp = await findCampBySlug(request, SEED_SLUG);
  const newNameTh = `เขาใหญ่แคมป์ปิ้ง (แก้ไข ${Date.now()})`;
  const newPriceLow = "777";

  await page.goto(`/dashboard/campsites/${camp.id}/edit`);
  await expect(page.getByTestId("input--campground-name-th")).toHaveValue(camp.nameTh);

  await page.getByTestId("input--campground-name-th").fill(newNameTh);
  await page.getByTestId("input--campground-price-low").fill(newPriceLow);

  const putResponse = page.waitForResponse(
    (res) => res.url().includes(`/api/campsites/${camp.id}`) && res.request().method() === "PUT"
  );
  await page.getByTestId("btn--campground-save").click();
  const putRes = await putResponse;
  // Data result — the PUT succeeds (not a validation 400).
  expect(putRes.status()).toBe(200);

  // Visible result — lands back on the campsites list, showing the new name.
  await page.waitForURL((url) => url.pathname === "/dashboard/campsites");
  await expect(page.getByTestId(`row--campsite-${camp.id}`)).toContainText(newNameTh);

  // Data result — no new row was created (same id, same total camp count).
  const afterSave = await getCampSite(request, camp.id);
  expect(afterSave.id).toBe(camp.id);
  expect(afterSave.nameTh).toBe(newNameTh);
  expect(Number(afterSave.priceLow)).toBe(Number(newPriceLow));

  // Reopen the edit form — both persisted values are shown (round trip).
  await page.goto(`/dashboard/campsites/${camp.id}/edit`);
  await expect(page.getByTestId("input--campground-name-th")).toHaveValue(newNameTh);
  await expect(page.getByTestId("input--campground-price-low")).toHaveValue(newPriceLow);
});
