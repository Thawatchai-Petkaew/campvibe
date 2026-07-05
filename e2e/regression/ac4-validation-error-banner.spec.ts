/**
 * CAM-359 AC-4 — clearing the required nameTh field blocks save with the
 * exact validation banner + inline error + scroll/focus to Basic Info.
 *
 * Given the edit form of a seeded, save-valid camp
 * When the host clears nameTh (empties the required field) and submits
 * Then the error banner reads exactly
 *      "กรอกข้อมูลไม่ถูกต้อง: ชื่อแคมป์กราวด์ (ภาษาไทย)", an inline error
 *      shows on the name field, and the view scrolls/focuses the Basic-Info
 *      card — no write; the camp row is unchanged.
 */
import { test, expect } from "@playwright/test";
import { findCampBySlug, getCampSite } from "./helpers";

const SEED_SLUG = "railay-beach-camping-5";
const EXPECTED_BANNER = "กรอกข้อมูลไม่ถูกต้อง: ชื่อแคมป์กราวด์ (ภาษาไทย)";

test("clearing required nameTh blocks save with the exact Thai banner + inline error + scroll/focus", async ({
  page,
  request,
}) => {
  const camp = await findCampBySlug(request, SEED_SLUG);

  // No PUT must ever reach the server (client pre-check blocks it — AC-4's
  // first Neg/edge branch). Fail the test if one is observed.
  let putSeen = false;
  page.on("request", (req) => {
    if (req.url().includes(`/api/campsites/${camp.id}`) && req.method() === "PUT") {
      putSeen = true;
    }
  });

  await page.goto(`/dashboard/campsites/${camp.id}/edit`);
  await page.getByTestId("input--campground-name-th").fill("");
  await page.getByTestId("btn--campground-save").click();

  // Visible result — the exact Thai banner, verbatim.
  await expect(page.getByTestId("alert--campground-validation")).toHaveText(EXPECTED_BANNER);

  // Inline error on the name field itself.
  await expect(page.getByTestId("input--campground-name-th")).toHaveAttribute("aria-invalid", "true");

  // The view scrolls/focuses the Basic-Info card.
  await expect(page.locator("#basic-info")).toBeFocused();

  // The client pre-check returns synchronously before any `fetch` is issued
  // (components/CampgroundForm.tsx handleSubmit) — by the time the banner
  // and focus above are visible, the submit handler has already finished, so
  // this is deterministic (no race / no bare timeout).
  expect(putSeen).toBe(false);

  // Data result — camp row unchanged.
  const after = await getCampSite(request, camp.id);
  expect(after.nameTh).toBe(camp.nameTh);
});
