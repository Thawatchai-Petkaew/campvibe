/**
 * cam-640-booking-view.test.ts — CAM-640 (epic CAM-630, in-chat guided
 * booking, design brief CAM-637)
 *
 * Pure-logic coverage for `components/ai-chat/booking-view.ts` — the
 * view-building helpers that turn already-fetched camp data + the real
 * translation object into a `BookingStepView` (or a raw chip-spec array).
 * No React, no network — `getTranslations` reads the SAME
 * `locales/translations.json` every render path uses.
 */
import { describe, expect, it } from "vitest";
import { getTranslations } from "@/locales/translations";
import {
  MAX_BOOKING_DATE_CHIPS,
  MAX_BOOKING_GUEST_CHIPS,
  addOneDayIso,
  buildDateChipSpecs,
  buildDateQuestionView,
  buildGuestChipSpecs,
  buildGuestsQuestionView,
  buildSummaryView,
  extractDisplayNumber,
  formatBookingDate,
  formatDateEcho,
  formatGuestsEcho,
  isDateFull,
  remainingForDate,
  type BookingCampContext,
} from "@/components/ai-chat/booking-view";
import type { WeekendAvailabilityEntry } from "@/lib/ai/tools/get-camp-detail";

const t = getTranslations("th");

const WEEKEND: WeekendAvailabilityEntry[] = [
  { date: "2026-08-01", remaining: 6, blockedByHost: false },
  { date: "2026-08-08", remaining: 0, blockedByHost: false }, // full (0 remaining)
  { date: "2026-08-15", remaining: null, blockedByHost: false }, // no cap set
  { date: "2026-08-22", remaining: 3, blockedByHost: true }, // blocked by host
];

const CAMP: BookingCampContext = {
  campId: "cs-1",
  slug: "phu-chi-fa-camp",
  name: "ภูชี้ฟ้า",
  weekendAvailability: WEEKEND,
  maxGuestsPerDay: 10,
  unitPrice: 500,
  priceUnit: "PER_SITE",
  priceIsFree: false,
};

describe("addOneDayIso — checkIn + 1 calendar day, UTC-safe", () => {
  it("[normal] a mid-month day", () => expect(addOneDayIso("2026-08-01")).toBe("2026-08-02"));
  it("[boundary] crosses a month end", () => expect(addOneDayIso("2026-08-31")).toBe("2026-09-01"));
  it("[boundary] crosses a year end", () => expect(addOneDayIso("2026-12-31")).toBe("2027-01-01"));
});

describe("remainingForDate / isDateFull — snapshot lookups, never fabricated", () => {
  it("[normal] a real entry's own remaining count", () => expect(remainingForDate(WEEKEND, "2026-08-01")).toBe(6));
  it("[null/empty] no entry for the date at all -> null (unknown, never guessed)", () =>
    expect(remainingForDate(WEEKEND, "2099-01-01")).toBeNull());
  it("[boundary] remaining===0 is real -> full", () => expect(isDateFull(WEEKEND, "2026-08-08")).toBe(true));
  it("[normal] blockedByHost -> full regardless of remaining", () => expect(isDateFull(WEEKEND, "2026-08-22")).toBe(true));
  it("[normal] a real open day -> not full", () => expect(isDateFull(WEEKEND, "2026-08-01")).toBe(false));
  it("[error/validation] an UNKNOWN date is never treated as full (no entry != full)", () =>
    expect(isDateFull(WEEKEND, "2099-01-01")).toBe(false));
});

describe("buildDateChipSpecs — open days only, soonest-first, capped", () => {
  it("[normal] excludes full/blocked days, keeps open + no-cap days, soonest first", () => {
    const chips = buildDateChipSpecs(WEEKEND);
    expect(chips.map((c) => c.date)).toEqual(["2026-08-01", "2026-08-15"]);
  });

  it("[boundary] caps at MAX_BOOKING_DATE_CHIPS even with more open days available", () => {
    const many: WeekendAvailabilityEntry[] = Array.from({ length: MAX_BOOKING_DATE_CHIPS + 3 }, (_, i) => ({
      date: `2026-09-0${i + 1}`,
      remaining: 5,
      blockedByHost: false,
    }));
    expect(buildDateChipSpecs(many)).toHaveLength(MAX_BOOKING_DATE_CHIPS);
  });

  it("[null/empty] no open days at all -> empty array", () => {
    expect(buildDateChipSpecs([{ date: "2026-08-08", remaining: 0, blockedByHost: false }])).toEqual([]);
  });
});

describe("buildGuestChipSpecs — 1..min(ceiling, MAX_BOOKING_GUEST_CHIPS)", () => {
  it("[normal] a ceiling below the cap renders exactly that many", () => expect(buildGuestChipSpecs(3).map((c) => c.count)).toEqual([1, 2, 3]));
  it("[boundary] a ceiling at/above the cap renders exactly MAX_BOOKING_GUEST_CHIPS", () =>
    expect(buildGuestChipSpecs(20)).toHaveLength(MAX_BOOKING_GUEST_CHIPS));
  it("[null/empty] ceiling null (unknown on both sides) -> 1..MAX_BOOKING_GUEST_CHIPS, never skipped", () =>
    expect(buildGuestChipSpecs(null).map((c) => c.count)).toEqual([1, 2, 3, 4]));
  it("[boundary] ceiling===0 -> no chips (defensive; unreachable in the live flow per the design brief)", () =>
    expect(buildGuestChipSpecs(0)).toEqual([]));
});

describe("extractDisplayNumber — best-effort echo of a rejected typed guest answer", () => {
  it("[normal] a plain integer", () => expect(extractDisplayNumber("9999 คน")).toBe("9999"));
  it("[boundary] a negative number", () => expect(extractDisplayNumber("-5 คน")).toBe("-5"));
  it("[null/empty] no digits at all falls back to the trimmed text", () => expect(extractDisplayNumber("  ไม่รู้สิ  ")).toBe("ไม่รู้สิ"));
});

describe("formatDateEcho / formatGuestsEcho — the tapped-chip user-bubble text", () => {
  it("[normal] a date with a known remaining count", () => {
    expect(formatDateEcho("2026-08-01", CAMP, t, "th")).toContain(t.aiChat.card.remaining.replace("{count}", "6"));
  });
  it("[boundary] a date with no cap set uses the openNoCap copy, never a fabricated number", () => {
    const echo = formatDateEcho("2026-08-15", CAMP, t, "th");
    expect(echo).toContain(t.aiChat.detail.openNoCap);
    expect(echo).not.toMatch(/\d+ ที่/);
  });
  it("[normal] a guest count", () => expect(formatGuestsEcho(3, t)).toBe(t.aiChat.booking.guests.chip.replace("{count}", "3")));
});

describe("buildDateQuestionView", () => {
  it("[normal] reason:'ask' uses the camp name + real open-day chips", () => {
    const view = buildDateQuestionView({ camp: CAMP, t, language: "th", reason: "ask" });
    expect(view.step).toBe("date");
    expect(view.isCurrent).toBe(true);
    expect(view.questionText).toBe(t.aiChat.booking.date.ask.replace("{name}", CAMP.name));
    expect(view.chips.map((c) => (c.kind === "date" ? c.date : null))).toEqual(["2026-08-01", "2026-08-15"]);
    expect(view.controls).toEqual([{ kind: "cancel" }]);
  });

  it("[null/empty] no open days -> the empty copy, no chips", () => {
    const emptyCamp: BookingCampContext = { ...CAMP, weekendAvailability: [] };
    const view = buildDateQuestionView({ camp: emptyCamp, t, language: "th", reason: "ask" });
    expect(view.questionText).toBe(t.aiChat.booking.date.empty);
    expect(view.chips).toEqual([]);
  });

  it("[error/validation] reason:'unreadable'", () => {
    const view = buildDateQuestionView({ camp: CAMP, t, language: "th", reason: "unreadable" });
    expect(view.questionText).toBe(t.aiChat.booking.date.unreadable);
  });

  it("[error/validation] reason:'full' names the specific date that filled up", () => {
    const view = buildDateQuestionView({ camp: CAMP, t, language: "th", reason: "full", fullDate: "2026-08-08" });
    expect(view.questionText).toBe(t.aiChat.booking.date.full.replace("{date}", formatBookingDate("2026-08-08", "th")));
  });
});

describe("buildGuestsQuestionView", () => {
  const slots = { checkIn: "2026-08-01", checkOut: "2026-08-02" };

  it("[normal] reason:'ask' with a known remaining -> the ask copy + capped chips", () => {
    const view = buildGuestsQuestionView({ slots, camp: CAMP, t, language: "th", reason: "ask" });
    expect(view.step).toBe("guests");
    expect(view.questionText).toBe(
      t.aiChat.booking.guests.ask.replace("{date}", formatBookingDate("2026-08-01", "th")).replace("{count}", "6")
    );
    // ceiling = min(remaining=6, maxGuestsPerDay=10) = 6, capped at MAX_BOOKING_GUEST_CHIPS
    expect(view.chips.map((c) => (c.kind === "guests" ? c.count : null))).toEqual([1, 2, 3, 4]);
    // CAM-699 — `nights` now sits directly before `guests`; back returns there.
    expect(view.controls).toEqual([{ kind: "back", toStep: "nights" }, { kind: "cancel" }]);
  });

  it("[boundary] reason:'ask' with remaining===null -> the askNoCap copy, no per-day count fabricated", () => {
    const noCapSlots = { checkIn: "2026-08-15", checkOut: "2026-08-16" };
    const view = buildGuestsQuestionView({ slots: noCapSlots, camp: CAMP, t, language: "th", reason: "ask" });
    expect(view.questionText).toBe(t.aiChat.booking.guests.askNoCap.replace("{date}", formatBookingDate("2026-08-15", "th")));
  });

  it("[error/validation] reason:'unreadable'", () => {
    const view = buildGuestsQuestionView({ slots, camp: CAMP, t, language: "th", reason: "unreadable" });
    expect(view.questionText).toBe(t.aiChat.booking.guests.unreadable);
  });

  it("[error/validation] reason:'overCapacity' -> ONE ceiling chip only, never the normal 1..N row", () => {
    const view = buildGuestsQuestionView({
      slots,
      camp: CAMP,
      t,
      language: "th",
      reason: "overCapacity",
      overCapacityData: { remaining: 6, requested: "9999", limit: 6 },
    });
    expect(view.chips).toEqual([{ kind: "guestsCap", count: 6 }]);
    expect(view.questionText).toContain(
      t.aiChat.booking.guests.overCapacity
        .replace("{date}", formatBookingDate("2026-08-01", "th"))
        .replace("{remaining}", "6")
        .replace("{requested}", "9999")
    );
    expect(view.questionText).toContain(t.aiChat.booking.guests.overCapacityHint.replace("{remaining}", "6"));
  });
});

describe("buildSummaryView", () => {
  // CAM-699 — `nights` is now a real, required slot (ADR-018 D8: the
  // round-1 hardcoded 1-night total).
  const slots = { checkIn: "2026-08-01", checkOut: "2026-08-03", nights: 2, guests: 2 };

  it("[normal][CAM-699] a priced camp — total via computeBookingPrice using the REAL night count (unitPrice * 2 nights, no VAT, no extra fee)", () => {
    const view = buildSummaryView({ slots, camp: CAMP, t, language: "th", today: "2026-07-22" });
    expect(view.campValue).toBe(CAMP.name);
    expect(view.datesValue).toBe(
      t.aiChat.booking.summary.datesValue.replace("{date}", formatBookingDate("2026-08-01", "th")).replace("{nights}", "2")
    );
    expect(view.guestsValue).toBe(t.aiChat.booking.summary.guestsValue.replace("{count}", "2"));
    expect(view.totalValue).toBe("฿1,000"); // 500 * 2 nights, no VAT — was a hardcoded ฿500 (1 night) before CAM-699
    expect(view.controls).toEqual([{ kind: "editDate" }, { kind: "editGuests" }, { kind: "cancel" }]);
  });

  it("[boundary] a free camp -> the ฟรี copy, never a computed ฿0", () => {
    const freeCamp: BookingCampContext = { ...CAMP, priceIsFree: true, unitPrice: 0 };
    const view = buildSummaryView({ slots, camp: freeCamp, t, language: "th", today: "2026-07-22" });
    expect(view.totalValue).toBe(t.aiChat.card.free);
  });

  it("[normal] the handoff link carries the REAL checkIn/checkOut/guests/from=chat — the SAME contract lib/booking-prefill.ts's reader expects", () => {
    const view = buildSummaryView({ slots, camp: CAMP, t, language: "th", today: "2026-07-22" });
    expect(view.handoffHref).toBe(
      `/campgrounds/${CAMP.slug}?checkIn=2026-08-01&checkOut=2026-08-03&guests=2&from=chat`
    );
  });

  // CAM-652 (ADR-014): proves buildSummaryView is really routed through
  // buildBookingPriceArgs (not a hardcoded PER_SITE literal) — a PER_PERSON
  // camp's total multiplies by the party size the camper picked in this flow.
  it("[normal] a PER_PERSON camp — total multiplies unitPrice x guests x nights", () => {
    const perPersonCamp: BookingCampContext = { ...CAMP, priceUnit: "PER_PERSON" };
    const view = buildSummaryView({ slots, camp: perPersonCamp, t, language: "th", today: "2026-07-22" });
    expect(view.totalValue).toBe("฿2,000"); // 500 * 2 guests * 2 nights
  });

  // CAM-699 — the exact regression this story exists to close: 1 night's
  // worth of slots must NOT silently become the same total a 2-night span
  // would produce.
  it("[normal][CAM-699][regression] a 1-night stay prices differently from a 2-night stay for the SAME camp/party", () => {
    const oneNight = buildSummaryView({
      slots: { checkIn: "2026-08-01", checkOut: "2026-08-02", nights: 1, guests: 2 },
      camp: CAMP,
      t,
      language: "th",
      today: "2026-07-22",
    });
    expect(oneNight.totalValue).toBe("฿500");
    expect(oneNight.datesValue).toBe(
      t.aiChat.booking.summary.datesValue.replace("{date}", formatBookingDate("2026-08-01", "th")).replace("{nights}", "1")
    );
  });
});
