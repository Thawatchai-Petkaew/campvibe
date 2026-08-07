/**
 * CAM-704 (epic CAM-695) — the browser proof that closes the in-chat-
 * booking round: a REAL `POST /api/bookings` fired from the chat panel,
 * read back from the REAL database, in a REAL browser.
 *
 * `cam-640-chat-booking-round-trip.spec.ts` drives the identical whole-camp
 * flow up to the summary's `btn--ai-chat-booking-confirm` and deliberately
 * stops there (that spec's own file header, updated by CAM-702) — it stays
 * a boundary-mocked flow test that never fires a real booking. This spec
 * takes over from exactly that point: it taps confirm for real and lets the
 * write land in the seeded DB.
 *
 * Mocking boundary (same idiom as cam-640 and cam-598-card-location-
 * ellipsis.spec.ts): `/api/ai/chat` + `/api/ai/camp-detail/:id` are mocked
 * (the assistant's answer is a real, non-deterministic, paid LLM call) —
 * the DESTINATION is always real. `POST /api/bookings`, `GET /api/bookings`,
 * `GET /api/campsites/:id/remaining-capacity` (CAM-647's pre-summary live
 * check) and, for the per-spot case, `GET /api/campsites/:id/spots` /
 * `GET /api/campsites/:id/availability` are never mocked here — that is the
 * whole point of this spec.
 *
 * PER-SPOT CASE — see the `test.skip` below. `cam-664-e2e-verify-th`
 * (seeded by `global.setup.ts`'s `seedCam664Camp`, `useSpotView` flipped
 * true by `applyPlan`) genuinely exists as a per-pitch fixture with live
 * pitches. But `buildSummaryView` (components/ai-chat/booking-view.ts)
 * unconditionally returns `cta:{kind:'handoff'}` whenever `camp.useSpotView`
 * is true — `btn--ai-chat-booking-confirm` never renders on that path at
 * all today. This is explicit, already-recorded scope, not a bug this spec
 * discovered: CAM-702/story.md and CAM-703/story.md both list "Per-pitch
 * camp confirm (still `handoff` unconditionally) -> a later story" under
 * `## Out of scope`. So the FIXTURE is not missing; the FEATURE (a real
 * per-pitch POST from chat) does not exist in the codebase yet. Driving a
 * confirm tap on that path would just prove the handoff button (already
 * covered by CAM-700's own unit suite) — not the AC this ticket asks for.
 * Recorded as a skip rather than improvised into a different assertion
 * (`.claude/rules/qa.md` STOP RULE 1 — repo reality vs. the dispatch).
 */
import { test, expect, type Page } from "@playwright/test";
import { findCampBySlug } from "./helpers";
import { CAM664_SLUG_TH } from "./cam-664-seed";

const SEED_SLUG = "phu-kradueng-camp-7";
const GUESTS = 2;
const NIGHTS = 2;

/** The next Saturday at least `minDaysOut` away — deterministic, always in the future. Distinct offsets per test keep the created rows on distinct dates (CAM-672's own hygiene reasoning), though only test 1 ever actually writes. */
function futureSaturdayISO(minDaysOut: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysOut);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** `iso` + `days` calendar days (UTC-safe) — mirrors `booking-view.ts`'s own `addDaysToIso`, re-derived here (not imported) so the test computes its expectation independently of the production code it is proving. */
function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Strips every non-digit character and parses the remainder — never asserts the formatted currency string (CAM-672's own idiom; a locale/grouping change to `Intl.NumberFormat` must never flake this spec). */
function parseThbDigits(text: string): number {
  return Number(text.replace(/[^0-9]/g, ""));
}

function detailBody(campId: string, checkIn: string, useSpotView: boolean) {
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
    useSpotView, // CAM-707 — the client parse guard requires this boolean.
    cancellationPolicy: null,
    isVerified: true,
    checkInTime: "14:00",
    checkOutTime: "10:00",
    minimumAge: 7,
    location: { province: "Loei", region: "Northeast" },
    directions: null,
    distanceFromBangkokKm: 330,
    availableWeekendDates: [checkIn],
    weekendAvailability: [{ date: checkIn, remaining: 6, blockedByHost: false }],
    facets: [],
  };
}

/** `/api/ai/chat` + `/api/ai/camp-detail/:id` mocked (boundary); everything downstream of the tapped card is real. */
async function routeAssistant(page: Page, campId: string, checkIn: string, useSpotView: boolean): Promise<void> {
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
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(detailBody(campId, checkIn, useSpotView)) })
  );
}

/** Drives card -> detail -> เริ่มจอง -> date chip -> nights chip -> guests chip, landing on the (real, live-rechecked, CAM-647) summary. Identical opening sequence to cam-640-chat-booking-round-trip.spec.ts. */
async function driveToSummary(page: Page, checkIn: string): Promise<void> {
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

  await expect(page.locator('[data-testid="msg--ai-chat-booking-step"][data-step="date"]')).toBeVisible({ timeout: 10_000 });
  const dateChip = page.locator(`[data-testid="btn--ai-chat-booking-chip"][data-value="${checkIn}"]`);
  await expect(dateChip).toBeVisible();
  await dateChip.click();

  await expect(page.locator('[data-testid="msg--ai-chat-booking-step"][data-step="nights"]').last()).toBeVisible({ timeout: 10_000 });
  const nightsChip = page.locator(`[data-testid="btn--ai-chat-booking-chip"][data-step="nights"][data-value="${NIGHTS}"]`).last();
  await expect(nightsChip).toBeVisible();
  await nightsChip.click();

  await expect(page.locator('[data-testid="msg--ai-chat-booking-step"][data-step="guests"]').last()).toBeVisible({ timeout: 10_000 });
  const guestsChip = page.locator(`[data-testid="btn--ai-chat-booking-chip"][data-step="guests"][data-value="${GUESTS}"]`).last();
  await expect(guestsChip).toBeVisible();
  await guestsChip.click();

  // CAM-647 — the pre-summary live re-check hits the REAL, unmocked
  // GET /api/campsites/:id/remaining-capacity for the real seeded camp;
  // this resolves to the real `block--ai-chat-booking-summary` only once
  // that check clears (a fresh future date, default maxGuestsPerDay:20,
  // zero existing bookings — the check passes).
  await expect(page.getByTestId("block--ai-chat-booking-summary")).toBeVisible({ timeout: 15_000 });
}

test.describe("CAM-704 — authed whole-camp: the confirm tap fires a REAL POST /api/bookings, read back from the real DB", () => {
  test("an authed camper's tap on ยืนยันการจอง creates a real Booking row and the success card shows the server-recorded total", async ({
    page,
    request,
  }) => {
    // Arrange
    const camp = await findCampBySlug(request, SEED_SLUG);
    const checkIn = futureSaturdayISO(150);
    const checkOut = addDaysToIso(checkIn, NIGHTS);
    await routeAssistant(page, camp.id, checkIn, false);

    await driveToSummary(page, checkIn);

    const confirmButton = page.getByTestId("btn--ai-chat-booking-confirm");
    await expect(confirmButton).toBeVisible({ timeout: 10_000 });
    await expect(confirmButton).toBeEnabled();
    await expect(confirmButton).toHaveAttribute("data-auth", "member");
    await expect(confirmButton).toHaveText("ยืนยันการจอง");

    // Act — the REAL write. Nothing under app/api/bookings is mocked.
    await confirmButton.click();

    // Assert (visible result) — the success card, real Thai copy verbatim.
    await expect(page.getByTestId("text--ai-chat-booking-success-title")).toHaveText("จองสำเร็จแล้ว", { timeout: 20_000 });
    const successBlock = page.getByTestId("block--ai-chat-booking-success");
    await expect(successBlock).toBeVisible();

    const confirmLink = page.getByTestId("btn--ai-chat-booking-view-confirmation");
    await expect(confirmLink).toBeVisible();
    const href = await confirmLink.getAttribute("href");
    const match = href?.match(/^\/bookings\/([^/?]+)\/confirmation$/);
    expect(match, `confirmation link must point at /bookings/{id}/confirmation, got: ${href}`).toBeTruthy();
    const bookingId = match![1]!;

    const totalRow = successBlock.locator('[data-testid="row--ai-chat-booking-success-line"][data-field="total"]');
    await expect(totalRow).toBeVisible();
    const shownTotal = parseThbDigits(await totalRow.locator("span").last().innerText());
    expect(shownTotal).toBeGreaterThan(0);

    // Assert (system/data result) — the row actually exists, read back over
    // the real API (never a mock of the POST this test just fired).
    const listRes = await request.get("/api/bookings");
    expect(listRes.ok()).toBeTruthy();
    const bookings = (await listRes.json()) as Array<{
      id: string;
      campSiteId: string;
      checkInDate: string;
      checkOutDate: string;
      guests: number;
      totalPrice: number;
      source?: string;
      spotId?: string | null;
    }>;
    const created = bookings.find((b) => b.id === bookingId);
    expect(created, `booking ${bookingId} not found in GET /api/bookings`).toBeTruthy();
    expect(created!.campSiteId).toBe(camp.id);
    expect(created!.checkInDate.startsWith(checkIn)).toBe(true);
    expect(created!.checkOutDate.startsWith(checkOut)).toBe(true);
    expect(created!.guests).toBe(GUESTS);
    expect(created!.spotId ?? null).toBeNull(); // whole-camp — never a pitch-less-camp write growing a spotId
    // ADR-018 D1 — the chat's own attribution constant, real and observable
    // on the raw Prisma row `findMany` returns (no `select` clips it).
    expect(created!.source).toBe("CHAT");
    // The success card's total is the SAME server-recorded amount, never
    // the client estimate (BR-8, CAM-702's own rule) — cross-checked here
    // against the real DB row, not just re-read from the same response.
    expect(Number(created!.totalPrice)).toBe(shownTotal);
  });
});

test.describe("CAM-704 — per-spot: real POST for a per-pitch camp (deferred — see file header)", () => {
  // `test.skip(condition, description)` called inside a running test
  // immediately aborts that test — nothing after it executes, so the
  // fixture (`cam-664-e2e-verify-th`, named below) is referenced only in
  // the reason string, never actually driven.
  test(`a per-pitch confirm tap carries the real spotId onto the created Booking row (fixture: ${CAM664_SLUG_TH})`, async () => {
    test.skip(
      true,
      `${CAM664_SLUG_TH} (global.setup.ts's seedCam664Camp, useSpotView flipped true) exists as a per-pitch ` +
        "fixture with live pitches, but buildSummaryView (components/ai-chat/booking-view.ts) unconditionally " +
        "returns cta:{kind:'handoff'} whenever camp.useSpotView is true -- btn--ai-chat-booking-confirm never " +
        "renders on this path today. Confirmed as already-recorded, deferred scope: CAM-702/story.md and " +
        "CAM-703/story.md both list 'Per-pitch camp confirm (still handoff unconditionally) -> a later story' " +
        "under ## Out of scope. Not a missing fixture -- a missing feature. This case can be un-skipped once " +
        "that later story wires a real per-pitch confirm."
    );
  });
});

test.describe("CAM-704 — guest gate: a guest's confirm tap opens LoginModal, never a network write (CAM-703)", () => {
  test("a guest reaching the whole-camp summary sees the login-to-confirm button, and tapping it opens LoginModal", async ({
    browser,
    request,
  }) => {
    // Arrange — camp lookup via the project's own authed `request` fixture
    // (findCampBySlug needs GET /api/operator/dashboard); the UI drive
    // below runs in a SEPARATE, genuinely unauthenticated browser context.
    const camp = await findCampBySlug(request, SEED_SLUG);
    const checkIn = futureSaturdayISO(160);

    // `browser.newContext()` inherits the `regression` project's configured
    // storageState (the shared host session) unless explicitly overridden
    // (verified live in cam-664-spot-viewer.spec.ts) — an explicit empty
    // storageState is required to get a genuinely unauthenticated context.
    const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    // CAM-688 / the language trap (e2e/regression/README.md): the SERVER
    // reads the `campvibe_lang` cookie, not localStorage — set both so this
    // guest renders Thai from the first byte, same as every other spec.
    await guestContext.addCookies([{ name: "campvibe_lang", value: "th", domain: "localhost", path: "/" }]);
    const page = await guestContext.newPage();
    await page.addInitScript(() => window.localStorage.setItem("campvibe_lang", "th"));

    // Diagnostic capture (kept, not temporary) — CAM-704 caught a real
    // integration gap on this exact path once (a red e2e is a defect report
    // until root-caused, ops.md); this is the fastest way to see WHY if it
    // ever regresses, without a local Playwright run.
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err?.stack ?? err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await routeAssistant(page, camp.id, checkIn, false);
    await driveToSummary(page, checkIn);

    // Assert (visible result) — the guest-labelled confirm control, Thai
    // copy verbatim (CAM-703 AC-1).
    const confirmButton = page.getByTestId("btn--ai-chat-booking-confirm");
    await expect(confirmButton).toBeVisible({ timeout: 10_000 });
    await expect(confirmButton).toBeEnabled();
    await expect(confirmButton).toHaveAttribute("data-auth", "guest");
    await expect(confirmButton).toHaveText("เข้าสู่ระบบเพื่อยืนยันการจอง");

    // Act — the tap never reaches the network (CAM-703 AC-2): it serializes
    // the flow and signals the caller to open LoginModal instead.
    await confirmButton.click();

    // Assert — LoginModal opens, subtitle verbatim (proves it is genuinely
    // the booking-confirm reason, not just any dialog), and a real login
    // control from LoginModal itself is present (unambiguous — the chat
    // panel's own dialog tree never carries this copy or this control).
    try {
      const loginDialog = page.getByRole("dialog").filter({ hasText: "เข้าสู่ระบบก่อน จะได้จองให้เสร็จในแชทนี้เลย" });
      await expect(loginDialog).toBeVisible({ timeout: 10_000 });
      await expect(loginDialog.getByTestId("btn--login-google")).toBeVisible();
    } catch (e) {
      // Diagnostic dump — read via `gh run view --log` / the uploaded
      // playwright-report artifact when this fails; never guess (qa.md).
      const resumeKey = await page.evaluate(() => window.sessionStorage.getItem("ai-chat-booking-resume")).catch(() => "<eval failed>");
      const dialogCount = await page.getByRole("dialog").count().catch(() => -1);
      console.log("CAM-704 guest-gate diagnostic :: pageerrors =", JSON.stringify(pageErrors));
      console.log("CAM-704 guest-gate diagnostic :: console errors =", JSON.stringify(consoleErrors));
      console.log("CAM-704 guest-gate diagnostic :: sessionStorage[ai-chat-booking-resume] =", resumeKey);
      console.log("CAM-704 guest-gate diagnostic :: role=dialog count on page =", dialogCount);
      throw e;
    }

    // System result — no booking was written for this guest tap.
    const listRes = await request.get("/api/bookings");
    expect(listRes.ok()).toBeTruthy();
    const bookings = (await listRes.json()) as Array<{ campSiteId: string; checkInDate: string }>;
    const wouldBeCreated = bookings.some((b) => b.campSiteId === camp.id && b.checkInDate.startsWith(checkIn));
    expect(wouldBeCreated, "a guest tap must never create a Booking row (CAM-703 AC-2)").toBe(false);

    await guestContext.close();
  });
});
