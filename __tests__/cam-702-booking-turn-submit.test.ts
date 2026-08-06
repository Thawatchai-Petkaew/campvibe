/**
 * cam-702-booking-turn-submit.test.ts — CAM-702 (epic CAM-695, ADR-018)
 * "The chat actually books"
 *
 * Pure-logic + dependency-injected coverage for the new `booking-turn.ts`
 * write-orchestration functions: `startBookingSubmit`,
 * `resolveBookingSubmitSuccess`, `resolveBookingSubmitConflict`,
 * `resolveBookingSubmitFailure`, `findJustCreatedBooking`, and
 * `submitBookingWrite` (the DI'd full orchestration, same pattern as
 * CAM-700's `resolveSpotStep`/`resolveSpotSelection` — no jsdom, no real
 * network, a fake fetcher). Also covers `buildSummaryView`'s new `authed`
 * cta flip (booking-view.ts).
 */
import { describe, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales/translations";
import {
  findJustCreatedBooking,
  resolveBookingSubmitConflict,
  resolveBookingSubmitFailure,
  resolveBookingSubmitSuccess,
  startBookingSubmit,
  submitBookingWrite,
  type BookingSession,
} from "@/components/ai-chat/booking-turn";
import { buildSummaryView, formatBookingDate, type BookingCampContext } from "@/components/ai-chat/booking-view";
import type { BookingCreateOutcome } from "@/lib/api-client";
import type { WeekendAvailabilityEntry } from "@/lib/ai/tools/get-camp-detail";
import type { BookingDTO } from "@/types/api";

const t = getTranslations("th");
const NOW = new Date("2026-08-01T10:00:00Z");

const WEEKEND: WeekendAvailabilityEntry[] = [
  { date: "2026-08-01", remaining: 6, blockedByHost: false },
  { date: "2026-08-02", remaining: 4, blockedByHost: false },
];

const CAMP: BookingCampContext = {
  campId: "cs-1",
  slug: "phu-chi-fa-camp",
  name: "ภูชี้ฟ้า",
  weekendAvailability: WEEKEND,
  maxGuestsPerDay: 10,
  useSpotView: false,
  unitPrice: 500,
  priceUnit: "PER_SITE",
  priceIsFree: false,
};

function summarySession(overrides: Partial<BookingSession> = {}): BookingSession {
  return {
    state: { slots: { checkIn: "2026-08-01", checkOut: "2026-08-03", nights: 2, guests: 2 }, consecutiveMisses: 0 },
    camp: CAMP,
    ...overrides,
  };
}

describe("buildSummaryView — the authed cta flip (ADR-018 D1/D2)", () => {
  it("[normal] whole-camp + authed -> kind:'confirm', authState:'member'", () => {
    const view = buildSummaryView({
      slots: { checkIn: "2026-08-01", checkOut: "2026-08-03", nights: 2, guests: 2 },
      camp: CAMP,
      t,
      language: "th",
      today: "2026-07-30",
      authed: true,
    });
    expect(view.cta).toEqual({ kind: "confirm", label: t.aiChat.booking.confirm, authState: "member" });
  });

  // CAM-703 (2026-08-06 dated supersede) — a whole-camp guest now ALSO gets
  // `kind:'confirm'` (the login gate), never `handoff` — see
  // cam-703-login-gate.test.ts for the full guest/member cta matrix.
  it("[normal] whole-camp + guest (authed omitted, defaults false) -> kind:'confirm', authState:'guest', loginToConfirm label", () => {
    const view = buildSummaryView({
      slots: { checkIn: "2026-08-01", checkOut: "2026-08-03", nights: 2, guests: 2 },
      camp: CAMP,
      t,
      language: "th",
      today: "2026-07-30",
    });
    expect(view.cta).toEqual({ kind: "confirm", label: t.aiChat.booking.loginToConfirm, authState: "guest" });
  });

  it("[boundary] a per-pitch camp stays handoff EVEN when authed:true (per-pitch confirm is a later story)", () => {
    const perSpotCamp: BookingCampContext = { ...CAMP, useSpotView: true };
    const view = buildSummaryView({
      slots: { checkIn: "2026-08-01", checkOut: "2026-08-03", nights: 2, guests: 2, spotId: "spot-1", spotName: "ริมน้ำ A" },
      camp: perSpotCamp,
      t,
      language: "th",
      today: "2026-07-30",
      authed: true,
    });
    expect(view.cta.kind).toBe("handoff");
  });
});

describe("startBookingSubmit — guard 2: supersedes the prior summary's isCurrent", () => {
  it("[normal] appends a submitting entry AND flips the prior current summary entry's isCurrent to false", () => {
    const summaryView = buildSummaryView({
      slots: { checkIn: "2026-08-01", checkOut: "2026-08-03", nights: 2, guests: 2 },
      camp: CAMP,
      t,
      language: "th",
      today: "2026-07-30",
      authed: true,
    });
    const entries = [{ id: "b1", role: "assistant" as const, kind: "booking" as const, step: "summary" as const, view: summaryView }];
    const session = summarySession();

    const result = startBookingSubmit(entries, session, t, "th", NOW);

    expect(entries[0]!.view).toMatchObject({ isCurrent: true }); // the original array entry is untouched (immutable)
    const [supersededSummary, submittingEntry] = result.entries;
    const supersededView = supersededSummary!.role === "assistant" && supersededSummary!.kind === "booking" ? supersededSummary.view : null;
    expect(supersededView).toMatchObject({ isCurrent: false });
    expect(submittingEntry).toMatchObject({ kind: "booking", step: "summary", view: { kind: "submitting", isCurrent: true } });
    expect(result.booking).toEqual(session); // session/slots unchanged — still needed for the POST body
  });
});

describe("resolveBookingSubmitSuccess — the SERVER total, never the client estimate; flow ends (booking: null)", () => {
  it("[normal] renders `booked` with the server-recorded total + the real booking id", () => {
    const result = resolveBookingSubmitSuccess([], summarySession(), "bk_real_1", 1234, t, "th");
    const entry = result.entries[0]!;
    expect(entry).toMatchObject({ kind: "booking", step: "summary", view: { kind: "booked", bookingId: "bk_real_1", isCurrent: true } });
    expect(entry.role === "assistant" && entry.kind === "booking" && entry.view.kind === "booked" ? entry.view.totalValue : null).toBe(
      `฿${new Intl.NumberFormat("th-TH").format(1234)}`
    );
    expect(result.booking).toBeNull(); // design brief §7 — the flow ends here
  });
});

describe("resolveBookingSubmitConflict — the 409 rewind (ADR-018 D3, design brief §8 F6)", () => {
  it("[normal] clears checkIn/checkOut/spotId/spotName, KEEPS nights/guests, and excludes the failed date from the re-offered chips", () => {
    const session = summarySession({
      state: { slots: { checkIn: "2026-08-01", checkOut: "2026-08-03", nights: 2, guests: 2, spotId: "spot-1", spotName: "ริมน้ำ A" }, consecutiveMisses: 0 },
    });

    const result = resolveBookingSubmitConflict([], session, t, "th");

    expect(result.booking?.state.slots).toEqual({ nights: 2, guests: 2 }); // checkIn/checkOut/spotId/spotName all cleared
    const entry = result.entries[0]!;
    expect(entry).toMatchObject({ kind: "booking", step: "date" });
    const view = entry.role === "assistant" && entry.kind === "booking" && entry.view.kind === "question" ? entry.view : null;
    expect(view?.questionText).toBe(t.aiChat.booking.justFilled.replace("{date}", formatBookingDate("2026-08-01", "th"))); // reuses `justFilled`, never `date.full`
    expect(view?.chips.some((c) => c.kind === "date" && c.date === "2026-08-01")).toBe(false); // the failed date is excluded
    expect(view?.chips.some((c) => c.kind === "date" && c.date === "2026-08-02")).toBe(true); // an unrelated open date survives
  });

  it("[boundary] the ORIGINAL camp's weekendAvailability is never mutated (session-local copy only)", () => {
    const session = summarySession();
    resolveBookingSubmitConflict([], session, t, "th");
    expect(CAMP.weekendAvailability.find((e) => e.date === "2026-08-01")?.remaining).toBe(6); // unchanged
  });
});

describe("resolveBookingSubmitFailure — F1/F2/F3 cta shapes; the session is KEPT (never nulled)", () => {
  it("[normal] F1 rateLimited — re-enabled member confirm", () => {
    const result = resolveBookingSubmitFailure([], summarySession(), "rateLimited", t, "th", NOW);
    const entry = result.entries[0]!;
    expect(entry).toMatchObject({
      view: { kind: "bookingFailed", reason: "rateLimited", isCurrent: true, cta: { kind: "confirm", authState: "member", label: t.aiChat.booking.confirm } },
    });
    expect(result.booking).not.toBeNull();
  });

  it("[null/empty] F2 uncertain — no cta at all", () => {
    const result = resolveBookingSubmitFailure([], summarySession(), "uncertain", t, "th", NOW);
    const entry = result.entries[0]!;
    expect(entry.role === "assistant" && entry.kind === "booking" && entry.view.kind === "bookingFailed" ? entry.view.cta : "unset").toBeUndefined();
    expect(result.booking).not.toBeNull();
  });

  it("[boundary] F3 sessionExpired — reverts to the guest loginToConfirm label", () => {
    const result = resolveBookingSubmitFailure([], summarySession(), "sessionExpired", t, "th", NOW);
    const entry = result.entries[0]!;
    expect(entry).toMatchObject({
      view: { kind: "bookingFailed", reason: "sessionExpired", cta: { kind: "confirm", authState: "guest", label: t.aiChat.booking.loginToConfirm } },
    });
    expect(result.booking).not.toBeNull();
  });
});

const BASE_ROW: BookingDTO = {
  id: "bk_found",
  campSiteId: "cs-1",
  userId: "u1",
  checkInDate: "2026-08-01T00:00:00.000Z",
  checkOutDate: "2026-08-03T00:00:00.000Z",
  guests: 2,
  status: "PENDING",
  createdAt: new Date(NOW.getTime() - 30_000).toISOString(), // 30s ago
  totalPrice: 999,
};

describe("findJustCreatedBooking — ADR-018 D6 (~2min window, PENDING only, spotId in the tuple)", () => {
  it("[normal] a matching PENDING row inside the window is found", () => {
    const found = findJustCreatedBooking(summarySession(), [BASE_ROW], NOW);
    expect(found).toEqual({ id: "bk_found", totalPrice: 999 });
  });

  it("[boundary] a row exactly 2 minutes old is still found; one second past is not", () => {
    const at2min = { ...BASE_ROW, createdAt: new Date(NOW.getTime() - 120_000).toISOString() };
    expect(findJustCreatedBooking(summarySession(), [at2min], NOW)).toBeDefined();
    const at2min1s = { ...BASE_ROW, createdAt: new Date(NOW.getTime() - 121_000).toISOString() };
    expect(findJustCreatedBooking(summarySession(), [at2min1s], NOW)).toBeUndefined();
  });

  it("[error/validation] a CONFIRMED row (not PENDING) is never matched — even if everything else lines up", () => {
    const confirmed = { ...BASE_ROW, status: "CONFIRMED" as const };
    expect(findJustCreatedBooking(summarySession(), [confirmed], NOW)).toBeUndefined();
  });

  it("[error/validation] a different campSiteId/guests/date is never matched", () => {
    expect(findJustCreatedBooking(summarySession(), [{ ...BASE_ROW, campSiteId: "cs-other" }], NOW)).toBeUndefined();
    expect(findJustCreatedBooking(summarySession(), [{ ...BASE_ROW, guests: 5 }], NOW)).toBeUndefined();
    expect(findJustCreatedBooking(summarySession(), [{ ...BASE_ROW, checkInDate: "2026-09-01T00:00:00.000Z" }], NOW)).toBeUndefined();
  });

  it("[normal] spotId rides in the match tuple — a whole-camp session only matches a row with spotId absent", () => {
    const withSpot = { ...BASE_ROW, spotId: "spot-1" };
    expect(findJustCreatedBooking(summarySession(), [withSpot], NOW)).toBeUndefined(); // session has no spotId, row does
    expect(findJustCreatedBooking(summarySession(), [BASE_ROW], NOW)).toBeDefined(); // both absent -> match
  });

  it("[null/empty] an empty list never throws, resolves undefined", () => {
    expect(findJustCreatedBooking(summarySession(), [], NOW)).toBeUndefined();
  });
});

describe("submitBookingWrite — the full DI'd orchestration (ADR-018 D1 outcomes + D6 reconcile)", () => {
  it("[normal] created -> resolves to the booked view with the server total", async () => {
    const createBooking = vi.fn(async (): Promise<BookingCreateOutcome> => ({ kind: "created", booking: { id: "bk_1", status: "PENDING", snapshotTotalAmount: 1000 } }));
    const listBookings = vi.fn(async () => ({ data: [] }));
    const result = await submitBookingWrite([], summarySession(), createBooking, listBookings, t, "th", NOW);
    expect(result.entries[0]).toMatchObject({ view: { kind: "booked", bookingId: "bk_1" } });
    expect(listBookings).not.toHaveBeenCalled(); // a clean success never reconciles
  });

  it("[normal] conflict -> resolves to the date-step rewind", async () => {
    const createBooking = vi.fn(async (): Promise<BookingCreateOutcome> => ({ kind: "conflict" }));
    const listBookings = vi.fn(async () => ({ data: [] }));
    const result = await submitBookingWrite([], summarySession(), createBooking, listBookings, t, "th", NOW);
    expect(result.entries[0]).toMatchObject({ step: "date" });
  });

  it("[normal] unauthorized -> F3 sessionExpired", async () => {
    const createBooking = vi.fn(async (): Promise<BookingCreateOutcome> => ({ kind: "unauthorized" }));
    const listBookings = vi.fn(async () => ({ data: [] }));
    const result = await submitBookingWrite([], summarySession(), createBooking, listBookings, t, "th", NOW);
    expect(result.entries[0]).toMatchObject({ view: { kind: "bookingFailed", reason: "sessionExpired" } });
  });

  it("[normal] rateLimited -> F1", async () => {
    const createBooking = vi.fn(async (): Promise<BookingCreateOutcome> => ({ kind: "rateLimited", retryAfterSec: 30 }));
    const listBookings = vi.fn(async () => ({ data: [] }));
    const result = await submitBookingWrite([], summarySession(), createBooking, listBookings, t, "th", NOW);
    expect(result.entries[0]).toMatchObject({ view: { kind: "bookingFailed", reason: "rateLimited" } });
  });

  it("[normal] a network failure that RECONCILES to a match resolves to success WITHOUT a second POST", async () => {
    const createBooking = vi.fn(async (): Promise<BookingCreateOutcome> => ({ kind: "network" }));
    const listBookings = vi.fn(async () => ({ data: [BASE_ROW] }));
    const result = await submitBookingWrite([], summarySession(), createBooking, listBookings, t, "th", NOW);
    expect(createBooking).toHaveBeenCalledTimes(1); // reconcile checked BEFORE any re-POST — never a second create() call
    expect(listBookings).toHaveBeenCalledTimes(1);
    expect(result.entries[0]).toMatchObject({ view: { kind: "booked", bookingId: "bk_found" } });
  });

  it("[error/validation] a network failure that finds NO match resolves to F2 uncertain, still without a second POST", async () => {
    const createBooking = vi.fn(async (): Promise<BookingCreateOutcome> => ({ kind: "network" }));
    const listBookings = vi.fn(async () => ({ data: [] }));
    const result = await submitBookingWrite([], summarySession(), createBooking, listBookings, t, "th", NOW);
    expect(createBooking).toHaveBeenCalledTimes(1);
    expect(result.entries[0]).toMatchObject({ view: { kind: "bookingFailed", reason: "uncertain" } });
  });

  it("[error/validation] a generic 'error' outcome (e.g. 400/500) ALSO reconciles before ever reporting F2 — the same cautious path as network", async () => {
    const createBooking = vi.fn(async (): Promise<BookingCreateOutcome> => ({ kind: "error" }));
    const listBookings = vi.fn(async () => ({ data: [BASE_ROW] }));
    const result = await submitBookingWrite([], summarySession(), createBooking, listBookings, t, "th", NOW);
    expect(createBooking).toHaveBeenCalledTimes(1);
    expect(result.entries[0]).toMatchObject({ view: { kind: "booked" } });
  });
});
