/**
 * CAM-608 — a slow response to the month the host navigated AWAY FROM must
 * not overwrite the fresher month they navigated TO.
 *
 * The availability page's month calendar (`components/availability-calendar.tsx`)
 * fetches a NEW `loadMonth()` round trip on every month-nav click, and a
 * mount-effect call for the initial month can already be in flight when the
 * host clicks "next month" (React Strict Mode double-invokes the dev mount
 * effect; this route ALSO gets re-mounted quickly on real navigation). The
 * ticket's own scenario: "changes month, toggles a spot, and saves" — each
 * one can re-issue a fetch while an earlier one is still in flight.
 *
 * This spec constructs that crossing DETERMINISTICALLY (no reliance on real
 * network timing luck): every request for the INITIAL month is held open;
 * the request for the month the host navigates to is fulfilled immediately
 * with deliberately distinguishable data; only THEN is the held (stale,
 * earlier-issued) response released, with different data. If the CAM-359
 * requestId guard (via `lib/hooks/use-request-sequence.ts`) is working, the
 * fresher month's distinguishable data must still be showing after the
 * stale response lands.
 */
import { test, expect } from "@playwright/test";
import type { Route } from "@playwright/test";
import { findCampBySlug } from "./helpers";

const SEED_SLUG = "khao-kho-mountain-camp-6";
const FRESH_REMAINING_LABEL = "เหลือ 7 ที่";

test("a stale response for the month the host navigated away from does not overwrite the fresher month they navigated to", async ({
  page,
  request,
}) => {
  const camp = await findCampBySlug(request, SEED_SLUG);

  let initialStartDate: string | null = null;
  let freshMarkedDate: string | null = null;
  const heldRoutes: Route[] = [];

  await page.route(`**/api/campsites/${camp.id}/availability**`, async (route) => {
    const url = new URL(route.request().url());
    const startDate = url.searchParams.get("startDate");

    if (initialStartDate === null && startDate) {
      // Whichever month the mount effect asks for FIRST — this is the month
      // the host will navigate away from. Every request for THIS month
      // (including a React Strict Mode double-invoke of the mount effect)
      // is held open, released later, deliberately last.
      initialStartDate = startDate;
      const [y, m] = startDate.split("-").map(Number);
      const nextMonthFirstDay = new Date(y, m, 1); // `m` is 1-indexed from yyyy-MM-dd, so this IS the next month's 1st
      freshMarkedDate = `${nextMonthFirstDay.getFullYear()}-${String(nextMonthFirstDay.getMonth() + 1).padStart(2, "0")}-01`;
    }

    if (startDate === initialStartDate) {
      heldRoutes.push(route); // stale — released later, on purpose, last
      return;
    }

    // A request for a DIFFERENT month (the one the host navigates to) — the
    // SECOND-issued, faster call. Resolve it immediately with deliberately
    // distinguishable data.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        availability: [
          {
            date: freshMarkedDate,
            bookedGuests: 3,
            bookedTents: 0,
            maxGuests: 10,
            maxTents: 5,
            available: true,
            remainingGuests: 7,
            remainingTents: 5,
            blockedByHost: false,
          },
        ],
      }),
    });
  });

  await page.goto(`/dashboard/campsites/${camp.id}/availability`);

  // Wait until the mount request(s) for the INITIAL month have been
  // intercepted and held (Strict Mode may double-invoke — both are held).
  await expect.poll(() => heldRoutes.length).toBeGreaterThan(0);

  // Issue the SECOND, faster call while the first is still in flight.
  // `.first()` — CAM-604 AC-3 (reported, not fixed; shared `proxy.ts`
  // CSP/streaming infra, outside this ticket's file surface) can, under CPU
  // contention (a cold Turbopack compile is exactly that), leave a duplicate
  // DOM copy of this page's subtree briefly present. This test's own
  // concern is the requestId race, not that separately-tracked defect, so
  // it deliberately targets the first (always-correct) match rather than
  // asserting a count this PR cannot fix.
  await page.getByTestId("btn--calendar-next").first().click();

  // The fresh month's marked day must render with the deliberately distinct
  // data — proving the second (fresher) call committed successfully.
  const freshCell = page.getByTestId(`cell--calendar-day-${freshMarkedDate}`).first();
  await expect(freshCell).toContainText(FRESH_REMAINING_LABEL);

  // NOW release the stale, earlier-issued request(s) for the original
  // month, deliberately AFTER the fresher one already committed.
  for (const route of heldRoutes) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ availability: [] }), // stale, empty payload
    });
  }

  // The stale response must NOT win: the fresh month's marked cell must
  // still show the distinguishable data (the requestId guard dropped the
  // late-resolving, earlier-issued response instead of applying it).
  await expect(freshCell).toContainText(FRESH_REMAINING_LABEL);
});
