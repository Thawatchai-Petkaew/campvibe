/**
 * CAM-359 AC-2 — album image round trip: remove seeded image, upload the
 * fixture, save, reopen; the Image relation reflects the swap (not the old
 * images-CSV string).
 *
 * Given the edit form of a seeded camp that has >=1 album image
 * When the host removes the album image, re-uploads a fixture image, saves,
 *      then reopens
 * Then the reopened form shows the album with the re-uploaded image present
 *      and the removed one gone (Image rows reflect the swap)
 *
 * Depends on CAM-358 (upload URL contract): the /api/upload dev-fallback
 * returns a ROOT-RELATIVE `/uploads/<file>` URL, which the campSiteSchema
 * `imageUrlValue` rule (lib/validations/image.ts) only accepts since CAM-358.
 */
import path from "node:path";
import { test, expect } from "@playwright/test";
import { findCampBySlug, getCampSite } from "./helpers";

const SEED_SLUG = "doi-ang-khang-campsite-3";
const FIXTURE_IMAGE = path.join(__dirname, "..", "fixtures", "tiny.png");

test("album image round trip: remove seeded image + upload fixture persists on reopen", async ({ page, request }) => {
  const camp = await findCampBySlug(request, SEED_SLUG);

  // Given: the seed sets exactly one album image (see prisma/seed.ts `images`).
  const before = await getCampSite(request, camp.id);
  expect(before.images).toHaveLength(1);
  const oldImageUrl: string = before.images[0].url;

  await page.goto(`/dashboard/campsites/${camp.id}/edit`);
  await expect(page.getByTestId("btn--album-image-remove")).toHaveCount(1);

  // When: remove the seeded image.
  await page.getByTestId("btn--album-image-remove").click();
  await expect(page.getByTestId("btn--album-image-remove")).toHaveCount(0);

  // ...then upload the fixture image via the album dropzone.
  const uploadResponse = page.waitForResponse(
    (res) => res.url().includes("/api/upload") && res.request().method() === "POST"
  );
  await page.getByTestId("dropzone--album").locator('input[type="file"]').setInputFiles(FIXTURE_IMAGE);
  const uploadRes = await uploadResponse;
  expect(uploadRes.status()).toBe(200);
  const { url: uploadedUrl } = await uploadRes.json();
  expect(uploadedUrl).not.toBe(oldImageUrl);

  await expect(page.getByTestId("btn--album-image-remove")).toHaveCount(1);

  // Save.
  const putResponse = page.waitForResponse(
    (res) => res.url().includes(`/api/campsites/${camp.id}`) && res.request().method() === "PUT"
  );
  await page.getByTestId("btn--campground-save").click();
  const putRes = await putResponse;
  expect(putRes.status()).toBe(200);
  await page.waitForURL((url) => url.pathname === "/dashboard/campsites");

  // Data result — the Image relation has exactly the new url, old one gone.
  const afterSave = await getCampSite(request, camp.id);
  expect(afterSave.images).toHaveLength(1);
  expect(afterSave.images[0].url).toBe(uploadedUrl);
  expect(afterSave.images.map((img: { url: string }) => img.url)).not.toContain(oldImageUrl);

  // Visible result — reopen the form; the album shows the re-uploaded image.
  // `next/image` rewrites `src` to `/_next/image?url=<encoded>&...` — match on
  // the encoded path rather than the raw upload URL.
  await page.goto(`/dashboard/campsites/${camp.id}/edit`);
  await expect(page.getByTestId("btn--album-image-remove")).toHaveCount(1);
  const albumThumbnail = page.getByRole("img", { name: "ตัวอย่างรูปภาพ" });
  await expect(albumThumbnail).toBeVisible();
  await expect(albumThumbnail).toHaveAttribute(
    "src",
    new RegExp(encodeURIComponent(uploadedUrl).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
});
