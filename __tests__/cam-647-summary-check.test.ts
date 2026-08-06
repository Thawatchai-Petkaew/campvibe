/**
 * cam-647-summary-check.test.ts — CAM-647 (epic CAM-695, ADR-016 decision
 * point 5) "The chat summary is checked against live availability before it
 * is shown"
 *
 * Pure-logic coverage for `resolveSummaryCheck` (`components/ai-chat/
 * booking-turn.ts`) — the ONE async transition into `summary`. No React, no
 * real network: `checkCapacity` is an injected fake fetcher, the SAME
 * dependency-injection pattern `resolveSpotStep`/`resolveSpotSelection`
 * already establish.
 *
 * Covers the done_when items:
 *   - a FULL span (remaining:0) or blockedByHost -> E1 (justFilled),
 *     re-offers the date step, never a summary
 *   - remaining===null (no per-day cap) -> proceeds to the REAL summary —
 *     the load-bearing correctness rule (null must never read as full)
 *   - enough capacity (remaining>0) -> proceeds to the REAL summary
 *   - the fetch failing -> E3 (retryNeeded), entries/booking UNCHANGED
 *   - this file never touches `sending`/React at all
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { getTranslations } from "@/locales/translations";
import {
  processBookingTurn,
  resolveSummaryCheck,
  startBookingTurn,
  type RemainingCapacityFetchOutcome,
} from "@/components/ai-chat/booking-turn";
import type { BookingCampContext } from "@/components/ai-chat/booking-view";
import type { ChatEntry } from "@/components/ai-chat/conversation";

const t = getTranslations("th");
const NOW = new Date("2026-07-22T10:00:00Z"); // Bangkok Wednesday (same fixture as cam-633/640)

const CAMP: BookingCampContext = {
  campId: "cs-647",
  slug: "phu-chi-fa-camp",
  name: "ภูชี้ฟ้า",
  weekendAvailability: [{ date: "2026-08-01", remaining: 6, blockedByHost: false }],
  maxGuestsPerDay: 10,
  useSpotView: false,
  unitPrice: 500,
  priceUnit: "PER_SITE",
  priceIsFree: false,
};

function bookingEntries(entries: ChatEntry[]) {
  return entries.filter((e) => e.role === "assistant" && e.kind === "booking");
}

/** Drives the flow up to the interim checking state right before `summary` (date chip -> nights chip "1" -> guests chip "2"). */
function atCheckingState() {
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
  const nightsStep = processBookingTurn(dateStep.entries, dateStep.booking!, { kind: "chip", slots: { nights: 1 } }, "1 คืน", t, "th", NOW);
  const guestsStep = processBookingTurn(nightsStep.entries, nightsStep.booking!, { kind: "chip", slots: { guests: 2 } }, "2 คน", t, "th", NOW);
  return guestsStep;
}

describe("resolveSummaryCheck — enough capacity proceeds to the real summary", () => {
  it("[normal] remaining > 0 renders the real `summary` view, session kept alive", async () => {
    const checking = atCheckingState();
    const checkCapacity: (campId: string, s: string, e: string) => Promise<RemainingCapacityFetchOutcome> = async () => ({
      ok: true,
      remaining: 4,
      blockedByHost: false,
    });
    const result = await resolveSummaryCheck(checking.entries, checking.booking!, checkCapacity, t, "th", NOW, false);
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: "summary" });
    expect(result.booking).not.toBeNull();
    expect(result.retryNeeded).toBeUndefined();
  });

  it("[boundary][LOAD-BEARING] remaining===null (no per-day cap) is NEVER treated as full — proceeds to the real summary", async () => {
    const checking = atCheckingState();
    const checkCapacity: (campId: string, s: string, e: string) => Promise<RemainingCapacityFetchOutcome> = async () => ({
      ok: true,
      remaining: null,
      blockedByHost: false,
    });
    const result = await resolveSummaryCheck(checking.entries, checking.booking!, checkCapacity, t, "th", NOW, false);
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: "summary" });
    expect(result.booking).not.toBeNull();
  });

  it("[normal] authed threads through to a real confirm CTA on the resulting summary", async () => {
    const checking = atCheckingState();
    const checkCapacity: (campId: string, s: string, e: string) => Promise<RemainingCapacityFetchOutcome> = async () => ({
      ok: true,
      remaining: 4,
      blockedByHost: false,
    });
    const result = await resolveSummaryCheck(checking.entries, checking.booking!, checkCapacity, t, "th", NOW, true);
    const newest = bookingEntries(result.entries).at(-1);
    if (!newest || !("view" in newest) || newest.view.kind !== "summary") throw new Error("expected a summary view");
    expect(newest.view.cta).toEqual({ kind: "confirm", label: t.aiChat.booking.confirm, authState: "member" });
  });
});

describe("resolveSummaryCheck — E1: full or blockedByHost rewinds to `date`, never renders a summary", () => {
  it("[error/validation] remaining===0 rewinds to `date` with the justFilled copy, clears checkIn/checkOut, keeps nights/guests", async () => {
    const checking = atCheckingState();
    const checkCapacity: (campId: string, s: string, e: string) => Promise<RemainingCapacityFetchOutcome> = async () => ({
      ok: true,
      remaining: 0,
      blockedByHost: false,
    });
    const result = await resolveSummaryCheck(checking.entries, checking.booking!, checkCapacity, t, "th", NOW, false);
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: "date" });
    if (!newest || !("view" in newest) || newest.view.kind !== "question") throw new Error("expected a question view");
    expect(newest.view.questionText).toBe(t.aiChat.booking.justFilled.replace("{date}", "เสาร์ 1 ส.ค."));
    expect(result.booking?.state.slots).toEqual({ nights: 1, guests: 2 });
    // never a summary block for a date we now know is gone.
    expect(bookingEntries(result.entries).some((e) => "view" in e && e.view.kind === "summary")).toBe(false);
  });

  it("[error/validation] blockedByHost:true rewinds to `date` even when remaining > 0", async () => {
    const checking = atCheckingState();
    const checkCapacity: (campId: string, s: string, e: string) => Promise<RemainingCapacityFetchOutcome> = async () => ({
      ok: true,
      remaining: 3,
      blockedByHost: true,
    });
    const result = await resolveSummaryCheck(checking.entries, checking.booking!, checkCapacity, t, "th", NOW, false);
    const newest = bookingEntries(result.entries).at(-1);
    expect(newest).toMatchObject({ step: "date" });
    expect(result.booking?.state.slots.checkIn).toBeUndefined();
  });
});

describe("resolveSummaryCheck — E3: the fetch itself failing never renders a summary", () => {
  it("[error/validation] a failed fetch returns retryNeeded, entries/booking UNCHANGED (slots untouched)", async () => {
    const checking = atCheckingState();
    const checkCapacity: (campId: string, s: string, e: string) => Promise<RemainingCapacityFetchOutcome> = async () => ({ ok: false });
    const result = await resolveSummaryCheck(checking.entries, checking.booking!, checkCapacity, t, "th", NOW, false);
    expect(result.retryNeeded).toBe(true);
    expect(result.entries).toBe(checking.entries);
    expect(result.booking).toEqual(checking.booking);
    expect(bookingEntries(result.entries).some((e) => "view" in e && e.view.kind === "summary")).toBe(false);
  });
});

describe("this module never touches React `sending` state (structural half of the composer-never-disabled rule)", () => {
  it("[unit] the source contains no `setSending(` call", () => {
    const src = readFileSync(resolve(__dirname, "..", "components/ai-chat/booking-turn.ts"), "utf-8");
    expect(src).not.toContain("setSending(");
  });
});
