/**
 * CAM-359 AC-3 — logo round trip: set -> cleared -> set persists across saves.
 *
 * Given the edit form of a seeded camp
 * When the host uploads a logo, saves, reopens, removes the logo, re-uploads,
 *      saves, reopens
 * Then the reopened form shows the persisted logo after each save (present,
 *      then the re-uploaded one) — `CampSite.logo` updated on each save
 *      (set -> cleared -> set)
 *
 * Depends on CAM-358 (upload URL contract) — see AC-2's header note.
 */
import path from "node:path";
import { test, expect } from "@playwright/test";
import { findCampBySlug, getCampSite } from "./helpers";

const SEED_SLUG = "pang-ung-lakeside-camp-4";
const FIXTURE_IMAGE = path.join(__dirname, "..", "fixtures", "tiny.png");

async function uploadLogo(page: import("@playwright/test").Page): Promise<string> {
  const uploadResponse = page.waitForResponse(
    (res) => res.url().includes("/api/upload") && res.request().method() === "POST"
  );
  await page.getByTestId("dropzone--logo").locator('input[type="file"]').setInputFiles(FIXTURE_IMAGE);
  const uploadRes = await uploadResponse;
  expect(uploadRes.status()).toBe(200);
  const { url } = await uploadRes.json();
  return url as string;
}

async function save(page: import("@playwright/test").Page, campId: string): Promise<void> {
  const putResponse = page.waitForResponse(
    (res) => res.url().includes(`/api/campsites/${campId}`) && res.request().method() === "PUT"
  );
  await page.getByTestId("btn--campground-save").click();
  const putRes = await putResponse;
  expect(putRes.status()).toBe(200);
  await page.waitForURL((url) => url.pathname === "/dashboard/campsites");
}

test("logo round trip: set, then cleared, then re-set persists across saves", async ({ page, request }) => {
  const camp = await findCampBySlug(request, SEED_SLUG);

  // Given: an edit form of a seeded camp (the seed itself never sets a logo,
  // but this test does not depend on that — it only asserts that each save
  // below results in the value THAT save set, so it stays repeatable even if
  // run twice against the same DB without a reset in between).

  // --- Step 1: upload a logo, save, reopen — logo is present. ---
  await page.goto(`/dashboard/campsites/${camp.id}/edit`);
  await expect(page.getByTestId("dropzone--logo")).toBeVisible();
  const firstLogoUrl = await uploadLogo(page);
  await expect(page.getByTestId("btn--logo-remove")).toBeVisible();
  await save(page, camp.id);

  const afterFirstSave = await getCampSite(request, camp.id);
  expect(afterFirstSave.logo).toBe(firstLogoUrl);

  await page.goto(`/dashboard/campsites/${camp.id}/edit`);
  await expect(page.getByTestId("btn--logo-remove")).toBeVisible();

  // --- Step 2: remove the logo, save, reopen — logo is cleared. ---
  await page.getByTestId("btn--logo-remove").click();
  await expect(page.getByTestId("dropzone--logo")).toBeVisible();
  await save(page, camp.id);

  const afterClearSave = await getCampSite(request, camp.id);
  // System effect (AC-3): `CampSite.logo` is cleared on this save.
  expect(afterClearSave.logo).toBeFalsy();

  await page.goto(`/dashboard/campsites/${camp.id}/edit`);
  await expect(page.getByTestId("dropzone--logo")).toBeVisible();

  // --- Step 3: re-upload, save, reopen — the RE-uploaded logo is present. ---
  const secondLogoUrl = await uploadLogo(page);
  await save(page, camp.id);

  const afterSecondSave = await getCampSite(request, camp.id);
  expect(afterSecondSave.logo).toBe(secondLogoUrl);

  await page.goto(`/dashboard/campsites/${camp.id}/edit`);
  await expect(page.getByTestId("btn--logo-remove")).toBeVisible();
});
