/**
 * CAM-640 — starting a booking from the chat runs the whole flow: detail
 * card -> เริ่มจอง -> date chip -> nights chip -> guests chip -> summary.
 *
 * CAM-699 (2026-08-06) — the `nights` step now sits between `date` and
 * `guests` (ADR-018 D8: multi-night is a correctness prerequisite, not a
 * feature nicety). This spec picks 2 nights specifically so it exercises the
 * real multi-night flow end to end, not just a relabeled single night: the
 * summary must read "พัก 2 คืน", never the old hardcoded "พัก 1 คืน".
 *
 * CAM-702 (2026-08-06) — SUPERSEDES this spec's own former terminal state.
 * Before CAM-702, `summary`'s cta was UNCONDITIONALLY `kind:'handoff'` (no
 * live session was ever read), so this spec asserted a handoff `<Link>` +
 * navigation to the real `/campgrounds/<slug>` arriving page. CAM-702 flips
 * that: an AUTHED camper on a WHOLE-CAMP listing now gets the REAL confirm
 * CTA (`btn--ai-chat-booking-confirm`) instead — `btn--ai-chat-booking-
 * handoff` no longer exists on this exact path. The shared regression
 * `storageState` authenticates as the seeded HOST (`hoster@campvibe.com`,
 * `global.setup.ts`) and `phu-kradueng-camp-7` is a whole-camp
 * (`useSpotView:false`) listing, so this spec's own path is EXACTLY the one
 * ADR-018 flips — asserting the old handoff here would assert a truth this
 * story deliberately retired.
 *
 * This spec now proves the flow reaches that new terminal state — summary
 * renders the real, enabled confirm control, not the handoff link — and
 * stops there. The real `POST /api/bookings` write + the success card +
 * navigation is CAM-704's e2e surface (a real, non-mocked write against the
 * seeded DB); this spec stays a boundary-mocked flow test (`/api/ai/chat` +
 * `/api/ai/camp-detail/:id`) and never fires a real booking.
 *
 * `/api/ai/chat` + `/api/ai/camp-detail/:id` are mocked (same boundary-mock
 * idiom as `cam-598-card-location-ellipsis.spec.ts` — the assistant's answer
 * comes from a real LLM, non-deterministic and costs money per run).
 *
 * The chosen date is a Saturday far enough out (90+ days) that no other
 * regression spec or stale seed data could plausibly hold a real booking
 * against it.
 */
import { test, expect, type Page } from "@playwright/test";
import { findCampBySlug } from "./helpers";

const SEED_SLUG = "phu-kradueng-camp-7";
const GUESTS = 2;
// CAM-699 — picked 2 (not 1) specifically to exercise the real multi-night
// flow; 1 night would be indistinguishable from the pre-CAM-699 bug.
const NIGHTS = 2;

/** The next Saturday at least `minDaysOut` away — deterministic, always in the future. */
function futureSaturdayISO(minDaysOut: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysOut);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function detailBody(campId: string, checkIn: string) {
  return {
    ok: true,
    id: campId,
    nameTh: "ลานกางเต็นท์ภูกระดึง",
    nameEn: "Phu Kradueng National Park Camp",
    description: null,
    amenities: [],
    reviews: [],
    reviewSummary: { hasReviews: false, avgRating: null, count: 0 },
    price: { low: 200, high: 500, currency: "THB", extraFeeAmount: null, extraFeeLabel: null, feeInfo: null, isFree: false },
    capacity: { maxGuestsPerDay: 20, maxTentsPerDay: null },
    useSpotView: false, // CAM-707 — CAM-700 added a client parse guard requiring this boolean; a whole-camp flow.
    // CAM-702 — this exact combination (useSpotView:false + the authed
    // storageState) is what makes buildSummaryView offer `kind:'confirm'`
    // instead of `kind:'handoff'` — see the file header.
    cancellationPolicy: null,
    isVerified: true,
    checkInTime: "14:00",
    checkOutTime: "10:00",
    minimumAge: 7,
    location: { province: "Loei", region: "Northeast" },
    directions: null,
    distanceFromBangkokKm: 330,
    availableWeekendDates: [checkIn],
    // The mocked snapshot the booking flow runs against.
    weekendAvailability: [{ date: checkIn, remaining: 6, blockedByHost: false }],
    facets: [],
  };
}

async function routeAssistant(page: Page, campId: string, checkIn: string) {
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: "พบผลลัพธ์ที่ตรงกัน",
        cards: [
          {
            id: campId,
            nameTh: "ลานกางเต็นท์ภูกระดึง",
            nameEn: "Phu Kradueng National Park Camp",
            nameThSlug: SEED_SLUG,
            nameEnSlug: SEED_SLUG,
            priceLow: 200,
            createdAt: new Date().toISOString(),
            avgRating: null,
            reviewCount: 0,
            location: { province: "เลย" },
            images: [{ url: "/placeholder-camp.svg" }],
          },
        ],
      }),
    })
  );
  await page.route(`**/api/ai/camp-detail/${campId}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(detailBody(campId, checkIn)) })
  );
}

test("card -> detail -> เริ่มจอง -> date chip -> nights chip -> guests chip -> summary presents the REAL confirm control for an authed whole-camp camper (CAM-702 supersedes the old handoff-only terminal state)", async ({
  page,
  request,
}) => {
  const camp = await findCampBySlug(request, SEED_SLUG);
  const checkIn = futureSaturdayISO(90);

  await routeAssistant(page, camp.id, checkIn);

  // The shared regression storageState forces Thai (e2e/regression/README.md
  // "the language trap") — this spec asserts the Thai render, matching it.
  // It also authenticates as the seeded HOST (global.setup.ts), which is
  // what makes this an AUTHED path — the exact condition CAM-702's cta flip
  // keys on (see the file header).
  await page.goto("/", { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByTestId("btn--ai-chat-launcher").click();
  await page.getByTestId("input--ai-chat-composer").fill("มีแคมป์ภูกระดึงไหม");
  await page.getByTestId("btn--ai-chat-send").click();

  const cardButton = page.getByTestId("btn--ai-chat-card-select").first();
  await cardButton.waitFor({ state: "visible", timeout: 15_000 });
  await cardButton.click();

  const startButton = page.getByTestId("btn--ai-chat-booking-start");
  await expect(startButton).toBeEnabled({ timeout: 15_000 });
  await startButton.click();

  // Step 1 — date
  await expect(page.locator('[data-testid="msg--ai-chat-booking-step"][data-step="date"]')).toBeVisible({ timeout: 10_000 });
  const dateChip = page.locator(`[data-testid="btn--ai-chat-booking-chip"][data-value="${checkIn}"]`);
  await expect(dateChip).toBeVisible();
  await dateChip.click();

  // Step 2 — nights (CAM-699) — the date chip's own checkOut is only a
  // 1-night placeholder; this step is what picks the real span.
  await expect(page.locator('[data-testid="msg--ai-chat-booking-step"][data-step="nights"]').last()).toBeVisible({
    timeout: 10_000,
  });
  const nightsChip = page.locator(`[data-testid="btn--ai-chat-booking-chip"][data-step="nights"][data-value="${NIGHTS}"]`).last();
  await expect(nightsChip).toBeVisible();
  await nightsChip.click();

  // Step 3 — guests
  await expect(page.locator('[data-testid="msg--ai-chat-booking-step"][data-step="guests"]').last()).toBeVisible({
    timeout: 10_000,
  });
  const guestsChip = page.locator(`[data-testid="btn--ai-chat-booking-chip"][data-step="guests"][data-value="${GUESTS}"]`).last();
  await expect(guestsChip).toBeVisible();
  await guestsChip.click();

  // Step 4 — summary presents the REAL confirm control (CAM-702), not the
  // old handoff link.
  const summaryBlock = page.getByTestId("block--ai-chat-booking-summary");
  await expect(summaryBlock).toBeVisible({ timeout: 10_000 });
  // CAM-699 — the summary must price the REAL 2-night span, never the old
  // hardcoded "พัก 1 คืน".
  await expect(summaryBlock).toContainText("พัก 2 คืน");

  // CAM-702 — the terminal state for this exact path (authed + whole-camp):
  // a real, enabled ยืนยันการจอง confirm button, member-labelled.
  const confirmButton = page.getByTestId("btn--ai-chat-booking-confirm");
  await expect(confirmButton).toBeVisible({ timeout: 10_000 });
  await expect(confirmButton).toBeEnabled();
  await expect(confirmButton).toHaveAttribute("data-auth", "member");
  await expect(confirmButton).toHaveText("ยืนยันการจอง");

  // The old handoff escape no longer exists on this path — asserting its
  // ABSENCE is what makes this spec catch a regression back to CAM-701's
  // interim behaviour.
  await expect(page.getByTestId("btn--ai-chat-booking-handoff")).toHaveCount(0);

  // Deliberately stops here. The real POST /api/bookings write, the
  // resulting success card, and any navigation are CAM-704's e2e surface —
  // this spec never fires a real booking (see the file header).
});
