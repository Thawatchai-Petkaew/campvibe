/**
 * CAM-640 — starting a booking from the chat runs the whole flow: detail
 * card -> เริ่มจอง -> date chip -> guests chip -> summary -> handoff, and the
 * arriving camp page actually shows the same dates + guest count (proves the
 * round trip, not just the link).
 *
 * `/api/ai/chat` + `/api/ai/camp-detail/:id` are mocked (same boundary-mock
 * idiom as `cam-598-card-location-ellipsis.spec.ts` — the assistant's answer
 * comes from a real LLM, non-deterministic and costs money per run). The
 * FINAL destination, `/campgrounds/<slug>`, is a REAL, un-mocked navigation
 * against the seeded local/CI DB (`prisma/seed.ts`'s `phu-kradueng-camp-7`,
 * `maxGuestsPerDay` defaults to 20) — this is the part that actually proves
 * the round trip.
 *
 * The chosen date is a Saturday far enough out (90+ days) that no other
 * regression spec or stale seed data could plausibly hold a real booking
 * against it, so the arriving page's OWN live availability read never
 * clamps the seeded guest count down.
 */
import { test, expect, type Page } from "@playwright/test";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { findCampBySlug } from "./helpers";

const SEED_SLUG = "phu-kradueng-camp-7";
const GUESTS = 2;

/** The next Saturday at least `minDaysOut` away — deterministic, always in the future. */
function futureSaturdayISO(minDaysOut: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysOut);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function addOneDayIso(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day! + 1)).toISOString().slice(0, 10);
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
    cancellationPolicy: null,
    isVerified: true,
    checkInTime: "14:00",
    checkOutTime: "10:00",
    minimumAge: 7,
    location: { province: "Loei", region: "Northeast" },
    directions: null,
    distanceFromBangkokKm: 330,
    availableWeekendDates: [checkIn],
    // The mocked snapshot the booking flow runs against — deliberately
    // decoupled from the real live availability (which the ARRIVING page
    // reads for itself, unmocked).
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

test("card -> detail -> เริ่มจอง -> date chip -> guests chip -> summary -> handoff carries the chosen dates + guests, and the camp page shows them", async ({
  page,
  request,
}) => {
  const camp = await findCampBySlug(request, SEED_SLUG);
  const checkIn = futureSaturdayISO(90);
  const checkOut = addOneDayIso(checkIn);

  await routeAssistant(page, camp.id, checkIn);

  // The shared regression storageState forces Thai (e2e/regression/README.md
  // "the language trap") — this spec asserts the Thai render, matching it.
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

  // Step 2 — guests
  await expect(page.locator('[data-testid="msg--ai-chat-booking-step"][data-step="guests"]').last()).toBeVisible({
    timeout: 10_000,
  });
  const guestsChip = page.locator(`[data-testid="btn--ai-chat-booking-chip"][data-step="guests"][data-value="${GUESTS}"]`).last();
  await expect(guestsChip).toBeVisible();
  await guestsChip.click();

  // Step 3 — summary + handoff
  await expect(page.getByTestId("block--ai-chat-booking-summary")).toBeVisible({ timeout: 10_000 });
  const handoff = page.getByTestId("btn--ai-chat-booking-handoff");
  await expect(handoff).toHaveAttribute(
    "href",
    `/campgrounds/${SEED_SLUG}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${GUESTS}&from=chat`
  );

  await handoff.click();
  await page.waitForURL(new RegExp(`/campgrounds/${SEED_SLUG}\\?`), { timeout: 15_000 });

  const url = new URL(page.url());
  expect(url.searchParams.get("checkIn")).toBe(checkIn);
  expect(url.searchParams.get("checkOut")).toBe(checkOut);
  expect(url.searchParams.get("guests")).toBe(String(GUESTS));
  expect(url.searchParams.get("from")).toBe("chat");

  // Prove the round trip on the REAL, unmocked arriving page — not just the
  // link. The guests <Select> shows the seeded count; the check-in date
  // button shows the seeded date (dd MMM yyyy, Thai locale, matching
  // CampgroundDetailClient.tsx's own `formatDateDisplay`).
  const guestsSelect = page.getByTestId("select--booking-guests");
  await expect(guestsSelect).toBeVisible({ timeout: 15_000 });
  await expect(guestsSelect).toContainText(String(GUESTS));

  const expectedCheckInLabel = format(parseISO(checkIn), "dd MMM yyyy", { locale: th });
  await expect(page.getByText(expectedCheckInLabel, { exact: false }).first()).toBeVisible();
});
