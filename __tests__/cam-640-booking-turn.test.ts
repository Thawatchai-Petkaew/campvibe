/**
 * cam-640-booking-turn.test.ts — CAM-640 (epic CAM-630, in-chat guided
 * booking, design brief CAM-637) "Starting a booking from the chat runs the
 * whole flow"
 *
 * Pure-logic coverage for `components/ai-chat/booking-turn.ts` — the
 * orchestration reducer `use-ai-chat.ts` calls. No React, no network: every
 * assertion here is a direct proof of a `done_when` item.
 *
 *   - starting a flow appends a booking entry
 *   - a chip advances
 *   - typing advances IDENTICALLY (same resulting entries shape)
 *   - cancel clears (booking -> null, a notice entry appended)
 *   - two consecutive unparsed inputs exit to the model (booking -> null)
 *   - this file never touches `sending` at all (grepped below) — the
 *     STRUCTURAL half of "the composer is never disabled during a booking
 *     turn" (the other half — the intercept sitting after the sending guard
 *     in `use-ai-chat.ts` — is proved by cam-640-use-ai-chat-wiring.test.ts).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { getTranslations } from "@/locales/translations";
import {
  processBookingCancel,
  processBookingControl,
  processBookingTurn,
  startBookingTurn,
  type BookingSession,
} from "@/components/ai-chat/booking-turn";
import { createInitialBookingFlowState } from "@/components/ai-chat/booking-flow";
import { formatBookingDate, type BookingCampContext } from "@/components/ai-chat/booking-view";
import type { ChatEntry } from "@/components/ai-chat/conversation";

const t = getTranslations("th");
const NOW = new Date("2026-07-22T10:00:00Z"); // Bangkok Wednesday (same fixture as cam-633)

const CAMP: BookingCampContext = {
  campId: "cs-1",
  slug: "phu-chi-fa-camp",
  name: "ภูชี้ฟ้า",
  weekendAvailability: [
    { date: "2026-08-01", remaining: 6, blockedByHost: false }, // "เสาร์หน้า" resolves here
    { date: "2026-08-08", remaining: 0, blockedByHost: false }, // full
  ],
  maxGuestsPerDay: 10,
  unitPrice: 500,
  priceIsFree: false,
};

function bookingEntries(entries: ChatEntry[]) {
  return entries.filter((e) => e.role === "assistant" && e.kind === "booking");
}

describe("startBookingTurn — starting a flow appends a booking entry", () => {
  it("[normal] appends exactly one new booking entry on the `date` step, current", () => {
    const result = startBookingTurn([], CAMP, t, "th");
    expect(bookingEntries(result.entries)).toHaveLength(1);
    const [entry] = bookingEntries(result.entries);
    expect(entry).toMatchObject({ role: "assistant", kind: "booking", step: "date" });
    expect(result.booking).toEqual({ state: createInitialBookingFlowState(), camp: CAMP });
  });
});

describe("processBookingTurn — a chip advances", () => {
  it("[normal] a date chip tap echoes a user bubble then advances to the guests question", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    const session = start.booking!;
    const result = processBookingTurn(
      start.entries,
      session,
      { kind: "chip", slots: { checkIn: "2026-08-01", checkOut: "2026-08-02" } },
      "ส. 1 ส.ค. เหลือ 6 ที่",
      t,
      "th",
      NOW
    );
    const userEcho = result.entries[result.entries.length - 2];
    expect(userEcho).toMatchObject({ role: "user", text: "ส. 1 ส.ค. เหลือ 6 ที่" });
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: "guests" });
    expect(result.booking?.state.slots).toEqual({ checkIn: "2026-08-01", checkOut: "2026-08-02" });
  });

  it("[normal] a guests chip tap advances straight to summary once both slots are filled", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    const dateStep = processBookingTurn(
      start.entries,
      start.booking!,
      { kind: "chip", slots: { checkIn: "2026-08-01", checkOut: "2026-08-02" } },
      "echo",
      t,
      "th",
      NOW
    );
    const result = processBookingTurn(dateStep.entries, dateStep.booking!, { kind: "chip", slots: { guests: 2 } }, "2 คน", t, "th", NOW);
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: "summary" });
    expect(result.booking?.state.slots).toEqual({ checkIn: "2026-08-01", checkOut: "2026-08-02", guests: 2 });
  });
});

describe("processBookingTurn — typing advances IDENTICALLY to the equivalent chip", () => {
  it("[normal] typed 'เสาร์หน้า' resolves to the SAME date + next step as the matching chip", () => {
    const start = startBookingTurn([], CAMP, t, "th");

    const typed = processBookingTurn(start.entries, start.booking!, { kind: "text", text: "เสาร์หน้า" }, "เสาร์หน้า", t, "th", NOW);
    const chipped = processBookingTurn(
      start.entries,
      start.booking!,
      { kind: "chip", slots: { checkIn: "2026-08-01", checkOut: "2026-08-02" } },
      "echo",
      t,
      "th",
      NOW
    );

    expect(typed.booking?.state.slots).toEqual(chipped.booking?.state.slots);
    expect(bookingEntries(typed.entries).at(-1)).toMatchObject({ step: "guests" });
    expect(bookingEntries(chipped.entries).at(-1)).toMatchObject({ step: "guests" });
  });

  it("[error/validation] typed 'อยากกินไก่ทอด' (unrelated) is a miss — reprompts on `date`, same as the flow's own reprompt shape", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    const result = processBookingTurn(start.entries, start.booking!, { kind: "text", text: "อยากกินไก่ทอด" }, "อยากกินไก่ทอด", t, "th", NOW);
    expect(bookingEntries(result.entries).at(-1)).toMatchObject({ step: "date" });
    expect(result.booking?.state.consecutiveMisses).toBe(1);
  });
});

describe("§1 — a typed full day is answered immediately (synchronous, against the snapshot)", () => {
  it("[error/validation] a candidate date that is full in the snapshot stays on `date` with the 'full' copy, slots untouched", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    // A chip only ever carries an OPEN day in real usage (buildDateChipSpecs
    // already filters full/blocked days out) — the realistic trigger for
    // this check is TYPED input (resolveDatesCore has no rule for a bare
    // ISO string, so this test drives the reducer directly via a chip-shaped
    // candidate instead). The guard itself is applied to the OUTCOME,
    // uniformly for either input kind, so this still proves the exact same
    // code path the design brief's §1 describes.
    const result = processBookingTurn(
      start.entries,
      start.booking!,
      { kind: "chip", slots: { checkIn: "2026-08-08", checkOut: "2026-08-09" } },
      "2026-08-08",
      t,
      "th",
      NOW
    );
    expect(result.booking?.state.slots).toEqual({}); // reverted — never committed the full date
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: "date" });
    expect(newest && "view" in newest && newest.view.kind === "question" && newest.view.questionText).toBe(
      t.aiChat.booking.date.full.replace("{date}", formatBookingDate("2026-08-08", "th"))
    );
  });
});

describe("E2 — over capacity stays on `guests`, offers exactly the ceiling chip", () => {
  it("[error/validation] a typed count above the ceiling reprompts on `guests` with one capChip, never advances", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    const dateStep = processBookingTurn(
      start.entries,
      start.booking!,
      { kind: "chip", slots: { checkIn: "2026-08-01", checkOut: "2026-08-02" } },
      "echo",
      t,
      "th",
      NOW
    );
    const result = processBookingTurn(dateStep.entries, dateStep.booking!, { kind: "text", text: "9999 คน" }, "9999 คน", t, "th", NOW);
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: "guests" });
    expect(newest && "view" in newest && newest.view.kind === "question" ? newest.view.chips : null).toEqual([
      { kind: "guestsCap", count: 6 },
    ]);
    expect(result.booking?.state.slots.guests).toBeUndefined(); // never committed
  });
});

describe("processBookingCancel — cancel clears, from any step", () => {
  it("[normal] booking -> null + a cancelled notice entry appended (no new booking entry)", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    const result = processBookingCancel(start.entries, t);
    expect(result.booking).toBeNull();
    expect(bookingEntries(result.entries)).toHaveLength(1); // unchanged — no new booking entry
    const last = result.entries.at(-1);
    expect(last).toMatchObject({ role: "assistant", kind: "answer", text: t.aiChat.booking.cancelled });
  });
});

describe("processBookingControl — back / edit clears only the returned-to field(s), keeps the rest", () => {
  it("[normal] back to `date` from `guests` clears checkIn/checkOut, currentStep derives to `date`", () => {
    const session: BookingSession = {
      state: { slots: { checkIn: "2026-08-01", checkOut: "2026-08-02" }, consecutiveMisses: 0 },
      camp: CAMP,
    };
    const result = processBookingControl([], session, "date", t, "th");
    expect(result.booking?.state.slots).toEqual({});
    expect(bookingEntries(result.entries).at(-1)).toMatchObject({ step: "date" });
  });

  it("[normal] editGuests from `summary` clears ONLY guests — checkIn/checkOut are kept", () => {
    const session: BookingSession = {
      state: { slots: { checkIn: "2026-08-01", checkOut: "2026-08-02", guests: 2 }, consecutiveMisses: 0 },
      camp: CAMP,
    };
    const result = processBookingControl([], session, "guests", t, "th");
    expect(result.booking?.state.slots).toEqual({ checkIn: "2026-08-01", checkOut: "2026-08-02" });
    expect(bookingEntries(result.entries).at(-1)).toMatchObject({ step: "guests" });
  });
});

describe("two consecutive unparsed inputs exit to the model (2-strike escape hatch)", () => {
  it("[error/validation] the SECOND consecutive miss exits (booking -> null) with the handedToAssistant notice", () => {
    const start = startBookingTurn([], CAMP, t, "th");
    const first = processBookingTurn(start.entries, start.booking!, { kind: "text", text: "จะกินอะไรดี" }, "จะกินอะไรดี", t, "th", NOW);
    expect(first.booking).not.toBeNull(); // one miss is only a reprompt

    const second = processBookingTurn(first.entries, first.booking!, { kind: "text", text: "อากาศเป็นไงบ้าง" }, "อากาศเป็นไงบ้าง", t, "th", NOW);
    expect(second.booking).toBeNull(); // the NEXT sendMessage call reaches the network normally (use-ai-chat.ts's own guard)
    const last = second.entries.at(-1);
    expect(last).toMatchObject({ role: "assistant", kind: "answer", text: t.aiChat.booking.handedToAssistant });
  });
});

describe("this reducer never touches React `sending` state at all (structural half of BR-2)", () => {
  it("[unit] the source contains no `setSending(` call — it CANNOT disable the composer as a side effect", () => {
    const src = readFileSync(resolve(__dirname, "..", "components/ai-chat/booking-turn.ts"), "utf-8");
    expect(src).not.toContain("setSending(");
  });
});
