/**
 * CAM-359 AC-5 — create-camp form: filling required fields creates one new
 * CampSite row owned by the signed-in host, and it appears in the list.
 *
 * Given a logged-in host on the create-camp form
 * When they fill the required fields with valid data and save
 * Then they land on the campsites list; the newly created camp appears in
 *      the list by name (one new CampSite row created, owned by this host)
 */
import { test, expect } from "@playwright/test";

test("create-camp form: filling required fields creates one new owned CampSite row", async ({ page, request }) => {
  const dashboardRes = await request.get("/api/operator/dashboard");
  expect(dashboardRes.ok()).toBe(true);
  const dashboard = await dashboardRes.json();
  const operatorId: string = dashboard.operator.id;
  const campCountBefore: number = dashboard.campSites.length;

  const newNameTh = `แคมป์ทดสอบใหม่ ${Date.now()}`;

  await page.goto("/dashboard/campsites/new");
  await page.getByTestId("input--campground-name-th").fill(newNameTh);

  // Pick a real province via the CAM-559 cascading LocationPicker (required —
  // see below): this sets a valid thaiLocationId, matching real host
  // behavior. role="combobox" is not a "name from content" role, so
  // getByRole(..., { name }) cannot find the trigger by its visible text —
  // use the stable data-testid CAM-559 added on the trigger/row specifically
  // for this (was: page.getByText of the old flat picker's placeholder copy,
  // which no longer exists — the unselected trigger now shows the level name
  // "จังหวัด" instead of a search hint).
  await page.getByTestId("btn--location-picker-province").click();
  await page.getByTestId("row--location-picker-province-option").first().waitFor();
  await page.getByTestId("row--location-picker-province-option").first().click();

  // Whole-camp mode (default) requires maxGuestsPerDay >= 1 to pass the
  // client guard; maxTentsPerDay shares the same campSiteSchema >=1 rule
  // when present, and defaults to 0 in a fresh form — set both explicitly.
  await page.getByLabel("จำนวนผู้เข้าพักสูงสุดต่อวัน").fill("10");
  await page.getByLabel("จำนวนเต็นท์สูงสุดต่อวัน (โดยประมาณ)").fill("5");

  const postResponse = page.waitForResponse(
    (res) => res.url().endsWith("/api/campsites") && res.request().method() === "POST"
  );
  await page.getByTestId("btn--campground-save").click();
  const postRes = await postResponse;
  // Data result — 201 Created, not a validation 400.
  expect(postRes.status()).toBe(201);
  const created = await postRes.json();
  expect(created.operatorId).toBe(operatorId);

  // Visible result — lands on the campsites list; the new camp appears by name.
  await page.waitForURL((url) => url.pathname === "/dashboard/campsites");
  await expect(page.getByTestId(`row--campsite-${created.id}`)).toContainText(newNameTh);

  // Data result — exactly one new row, owned by the signed-in host.
  const dashboardAfterRes = await request.get("/api/operator/dashboard");
  const dashboardAfter = await dashboardAfterRes.json();
  expect(dashboardAfter.campSites.length).toBe(campCountBefore + 1);
  const createdRow = dashboardAfter.campSites.find((c: { id: string }) => c.id === created.id);
  expect(createdRow).toBeTruthy();
  expect(createdRow.operatorId).toBe(operatorId);
});
