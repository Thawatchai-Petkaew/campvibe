/**
 * CAM-598 — the assistant card's location line stays on one line and ends in
 * an ellipsis, instead of wrapping, at every mobile width.
 *
 * THE TRAP THIS SPEC IS BUILT TO CATCH. `AiChatCampCard.tsx` already carried
 * `line-clamp-1` on its location span before this story — a diff/class read
 * says "already handled". Measured behaviourally (real Chromium, real
 * layout) at both 320px and 390px: `AiChatCampCard` was ALREADY correct — the
 * flex row's `line-clamp-1` span shrinks to fit inside its `shrink-0` MapPin
 * sibling and a longer synthetic string clips to one line with a native
 * ellipsis (no `min-w-0` needed; Thai script has continuous line-break
 * opportunities, unlike the classic English-long-word flexbox trap). So
 * `AiChatCampCard.tsx` is UNCHANGED by this story (per the ticket's own
 * instruction: "if it already ellipses correctly, say so and leave it
 * alone"). `AiChatDetailCard.tsx` was the real defect — its location row was
 * `flex-wrap` with TWO separate spans (location+terrain+access, then a
 * second `· {distance}` span): the real worst-case string
 * (`ในเมือง, เมืองนครราชสีมา, นครราชสีมา`) plus terrain/access measured 2-3
 * VISIBLE lines (height 40-80px) before this story's fix (one combined
 * `line-clamp-1` span, `flex-wrap` removed) — verified now at 20px (one
 * line) at both widths. See `docs/specs/.../CAM-598-card-location-ellipsis/
 * design.md` for the full measured numbers and the "truncate the whole
 * combined line, not just part of it" decision.
 *
 * Why `page.route` mocks `/api/ai/chat` + `/api/ai/camp-detail/:id` instead
 * of driving a real model call: the assistant's answer comes from an LLM
 * (OpenRouter) — non-deterministic and costs real money per run. Only the
 * network boundary is mocked (api.md-style boundary mock, not the component
 * under test); `AiChatCampCard`/`AiChatDetailCard` themselves render for
 * real, un-mocked, from the real deployed CSS.
 */
import { test, expect, type Page } from "@playwright/test";

const PHONE_WIDTHS = [320, 390] as const;

/** A local same-origin asset — the assertions are about text layout, never about image loading. */
const IMAGE_URL = "/empty-state.jpg";

/** CAM-597's real worst case (docs/specs/.../CAM-598-.../story.md): a sub-district, district and
 * province that all repeat "เมือง" — a live camp, not a hypothetical. */
const WORST_CASE_LOCATION = {
  province: "Nakhon Ratchasima",
  provinceTh: "นครราชสีมา",
  provinceEn: "Nakhon Ratchasima",
  districtTh: "เมืองนครราชสีมา",
  districtEn: "Mueang Nakhon Ratchasima",
  subDistrictTh: "ในเมือง",
  subDistrictEn: "Nai Mueang",
};
const EXPECTED_LOCATION_TEXT = "ในเมือง, เมืองนครราชสีมา, นครราชสีมา";

function makeCard(id: string) {
  return {
    id,
    nameTh: "แคมป์ทดสอบ CAM-598",
    nameEn: "CAM-598 Probe Camp",
    nameThSlug: `cam-598-probe-${id}`,
    nameEnSlug: `cam-598-probe-${id}`,
    priceLow: 500,
    createdAt: new Date().toISOString(),
    avgRating: null,
    reviewCount: 0,
    location: WORST_CASE_LOCATION,
    images: [{ url: IMAGE_URL }],
  };
}

const CAMP_DETAIL_ID = "cam598-0000-0000-0000-000000000001";

/** Terrain + Access type amenities, per `AiChatDetailCard.tsx`'s own `locationParts`
 * (CAM-450) — the "neighbours" this story's fix must keep on the SAME single line. */
const DETAIL_OK_BODY = {
  ok: true,
  id: CAMP_DETAIL_ID,
  nameTh: "แคมป์ทดสอบ CAM-598",
  nameEn: "CAM-598 Probe Camp",
  description: null,
  amenities: [
    { code: "MOUNTAIN", group: "Terrain", nameTh: "ภูเขาและป่าเขาสูง", nameEn: "Mountain forest", icon: null },
    {
      code: "CAR_ACCESS",
      group: "Access type",
      nameTh: "รถเข้าถึงได้ทุกสภาพอากาศ",
      nameEn: "All-weather car access",
      icon: null,
    },
  ],
  reviews: [],
  reviewSummary: { hasReviews: false, avgRating: null, count: 0 },
  price: { low: 500, high: null, currency: "THB", extraFeeAmount: null, extraFeeLabel: null, feeInfo: null, isFree: false },
  capacity: { maxGuestsPerDay: 10, maxTentsPerDay: 5 },
  cancellationPolicy: null,
  isVerified: false,
  checkInTime: "14:00",
  checkOutTime: "12:00",
  minimumAge: null,
  location: { province: "Nakhon Ratchasima", region: "Northeast" },
  directions: null,
  distanceFromBangkokKm: 259,
  availableWeekendDates: [],
  weekendAvailability: [],
  facets: [],
};

async function routeAssistant(page: Page, cards: unknown[]) {
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ answer: "พบผลลัพธ์ที่ตรงกัน", cards }),
    })
  );
  await page.route(`**/api/ai/camp-detail/${CAMP_DETAIL_ID}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DETAIL_OK_BODY) })
  );
}

async function askAssistant(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  // The shared regression storageState forces Thai (e2e/regression/README.md
  // "the language trap") — this spec asserts the Thai render, matching it.
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByTestId("btn--ai-chat-launcher").click();
  await page.getByTestId("input--ai-chat-composer").fill("มีแคมป์ตรงไหนบ้าง");
  await page.getByTestId("btn--ai-chat-send").click();
}

/** Behavioural, not class-name: real scrollWidth/clientWidth + real box height vs one line-height. */
async function measureSingleLine(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || r.height;
    return {
      text: el.textContent ?? "",
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      height: r.height,
      lineHeight,
    };
  });
}

for (const width of PHONE_WIDTHS) {
  test(`AiChatCampCard — the real worst-case location stays on one line at ${width}px (already correct, unchanged)`, async ({
    page,
  }) => {
    await routeAssistant(page, [makeCard("a"), makeCard("b")]);
    await askAssistant(page, width);

    const card = page.getByTestId("card--ai-chat-campsite").first();
    await card.waitFor({ state: "visible", timeout: 15_000 });
    const span = card.getByTestId("text--ai-chat-card-province").locator("span");
    const geom = await measureSingleLine(span);

    expect(geom.text, "no location level was dropped").toBe(EXPECTED_LOCATION_TEXT);
    expect(
      geom.scrollWidth,
      `scrollWidth=${geom.scrollWidth} vs clientWidth=${geom.clientWidth} at ${width}px`
    ).toBeLessThanOrEqual(geom.clientWidth);
    expect(geom.height, `height=${geom.height} vs one line-height=${geom.lineHeight} at ${width}px`).toBeLessThanOrEqual(
      geom.lineHeight + 1
    );
  });

  test(`AiChatDetailCard — location + terrain + access + distance stay on one line at ${width}px (this story's fix)`, async ({
    page,
  }) => {
    await routeAssistant(page, [{ ...makeCard("detail"), id: CAMP_DETAIL_ID }]);
    await askAssistant(page, width);

    const cardButton = page.getByTestId("btn--ai-chat-card-select").first();
    await cardButton.waitFor({ state: "visible", timeout: 15_000 });
    await cardButton.click();

    const row = page.getByTestId("text--ai-chat-detail-province");
    await row.waitFor({ state: "visible", timeout: 15_000 });
    const span = row.locator("span").first();
    const geom = await measureSingleLine(span);

    // All 4 parts present in the underlying text (nothing dropped to force
    // the fit) — only the CSS visual box may clip, never the data.
    for (const part of [
      EXPECTED_LOCATION_TEXT,
      "ภูเขาและป่าเขาสูง",
      "รถเข้าถึงได้ทุกสภาพอากาศ",
      "259",
    ]) {
      expect(geom.text, `combined text missing "${part}"`).toContain(part);
    }
    expect(
      geom.scrollWidth,
      `scrollWidth=${geom.scrollWidth} vs clientWidth=${geom.clientWidth} at ${width}px` +
        " (before this fix: flex-wrap + 2 spans measured 2-3 visible lines, ~40-80px height)"
    ).toBeLessThanOrEqual(geom.clientWidth);
    expect(geom.height, `height=${geom.height} vs one line-height=${geom.lineHeight} at ${width}px`).toBeLessThanOrEqual(
      geom.lineHeight + 1
    );
  });
}
