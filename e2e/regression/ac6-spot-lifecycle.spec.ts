/**
 * CAM-359 AC-6 — spot lifecycle: create -> visible in spots list + the
 * availability spot picker -> soft-delete -> gone from BOTH.
 *
 * Given a logged-in host on a camp's spots page
 * When they create a spot, open the availability page, then soft-delete the
 *      spot from the spots page
 * Then the new spot row appears on the spots page AND as an option in the
 *      availability spot picker; after delete, toast "ลบจุดแล้ว", the spot
 *      row is gone from the spots page AND gone from the availability
 *      picker (Spot created, then deletedAt set — soft-delete; gone from
 *      every list read)
 */
import { test, expect } from "@playwright/test";
import { findCampBySlug, withKeepAliveRaceRetry } from "./helpers";

const SEED_SLUG = "khao-kho-mountain-camp-6";
const DELETE_CONFIRM_TITLE = "ลบจุดนี้ใช่หรือไม่ ประวัติการจองจะยังถูกเก็บไว้";
const DELETE_SUCCESS_TOAST = "ลบจุดแล้ว";

test("spot lifecycle: create, visible in spots list + availability picker, soft-delete, gone from both", async ({
  page,
  request,
}) => {
  const camp = await findCampBySlug(request, SEED_SLUG);
  const spotName = `จุดทดสอบ ${Date.now()}`;

  // --- Create the spot from the spots page. ---
  await page.goto(`/dashboard/campsites/${camp.id}/spots`);
  await page.getByTestId("btn--spots-add").click();
  await page.getByTestId("input--spot-name").fill(spotName);
  await page.getByTestId("input--spot-price-per-night").fill("350");

  const createResponse = page.waitForResponse(
    (res) => res.url().includes(`/api/campsites/${camp.id}/spots`) && res.request().method() === "POST"
  );
  await page.getByTestId("btn--spot-save").click();
  const createRes = await createResponse;
  expect(createRes.status()).toBe(201);
  const createdSpot = await createRes.json();
  const spotId: string = createdSpot.id;

  // Visible result — new spot row appears on the spots page. A single
  // toContainText assertion (not a toBeVisible + toContainText pair) closes
  // the re-render window between two checks on the same locator: Playwright
  // re-resolves the locator on every retry, so a two-step check can observe
  // the row on step 1 and then miss a transient re-render before step 2 ever
  // fires - a two-step assertion on the same locator is inherently racy
  // across re-renders (CAM-359 harness flake).
  const spotRow = page.getByTestId(`row--spot-${spotId}`);
  await expect(spotRow).toContainText(spotName);

  // --- Availability page: the new spot appears as an option in the picker. ---
  await page.goto(`/dashboard/campsites/${camp.id}/availability`);
  await page.getByTestId("btn--availability-add").click();
  await page.getByTestId("select--availability-spot").click();
  await expect(page.getByRole("option", { name: spotName })).toBeVisible();
  await page.keyboard.press("Escape"); // close the option list without selecting
  await page.getByTestId("btn--availability-cancel").click();

  // --- Soft-delete the spot from the spots page. ---
  await page.goto(`/dashboard/campsites/${camp.id}/spots`);
  await page.getByTestId(`btn--spot-delete-${spotId}`).click();

  // Confirm dialog shows the exact Thai copy.
  await expect(page.getByTestId("modal--spots-delete-confirm")).toContainText(DELETE_CONFIRM_TITLE);

  const deleteResponse = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/campsites/${camp.id}/spots/${spotId}`) && res.request().method() === "DELETE"
  );
  await page.getByRole("button", { name: "ยืนยัน" }).click();
  const deleteRes = await deleteResponse;
  expect(deleteRes.status()).toBe(200);

  // Visible result — success toast + the row is gone from the spots page.
  await expect(page.getByText(DELETE_SUCCESS_TOAST)).toBeVisible();
  await expect(page.getByTestId(`row--spot-${spotId}`)).toHaveCount(0);

  // Data result — soft-deleted (deletedAt set), gone from every list read:
  // the spots API no longer returns it...
  const spotsRes = await withKeepAliveRaceRetry(`GET /api/campsites/${camp.id}/spots`, () =>
    request.get(`/api/campsites/${camp.id}/spots`)
  );
  expect(spotsRes.ok()).toBe(true);
  const spots = await spotsRes.json();
  expect(spots.map((s: { id: string }) => s.id)).not.toContain(spotId);

  // ...and it is gone from the availability spot picker too. The picker
  // itself only renders when the camp has >=1 remaining spot (this seeded
  // camp has none besides the one just deleted) — either the picker is
  // simply absent (trivially proving the spot is gone) or, if other spots
  // remain, the deleted one's name must not appear as an option.
  await page.goto(`/dashboard/campsites/${camp.id}/availability`);
  await page.getByTestId("btn--availability-add").click();
  const spotSelectTrigger = page.getByTestId("select--availability-spot");
  if ((await spotSelectTrigger.count()) > 0) {
    await spotSelectTrigger.click();
    await expect(page.getByRole("option", { name: spotName })).toHaveCount(0);
  }
});
