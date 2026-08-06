/**
 * cam-701-booking-view.test.ts — CAM-701 (epic CAM-695, design brief
 * CAM-697 §6/§7/§8)
 *
 * Pure-logic coverage for the three NEW `booking-view.ts` builders
 * (`buildSubmittingView`/`buildBookedView`/`buildBookingFailedView`) — same
 * "no React, no network" pattern `cam-640-booking-view.test.ts` establishes.
 * These builders are NOT called by `booking-turn.ts` yet (CAM-702 wires
 * them); this file proves their pure output shape only.
 */
import { describe, expect, it } from "vitest";
import { buildBookedView, buildBookingFailedView, buildSubmittingView } from "@/components/ai-chat/booking-view";
import type { BookingSummaryRows } from "@/components/ai-chat/AiChatBookingStep";

const ROWS: BookingSummaryRows = {
  campValue: "ภูชี้ฟ้า",
  datesValue: "ส. 8 ส.ค. พัก 2 คืน",
  guestsValue: "2 คน",
  totalValue: "฿1,000",
};

describe("buildSubmittingView", () => {
  it("[normal] carries the frozen rows + controls + useSpotView through unchanged", () => {
    const controls = [{ kind: "editDate" as const }, { kind: "cancel" as const }];
    const view = buildSubmittingView({ rows: ROWS, controls, useSpotView: true });
    expect(view).toEqual({ kind: "submitting", ...ROWS, controls, useSpotView: true });
  });

  it("[null/empty] `useSpotView` is optional (whole-camp default)", () => {
    const view = buildSubmittingView({ rows: ROWS, controls: [] });
    expect(view.useSpotView).toBeUndefined();
    expect(view.controls).toEqual([]);
  });
});

describe("buildBookedView", () => {
  it("[normal] wraps the server-recorded rows with the real booking id", () => {
    const view = buildBookedView({ bookingId: "bk_abc123", rows: { ...ROWS, spotValue: "ริมน้ำ A" } });
    expect(view).toEqual({ kind: "booked", bookingId: "bk_abc123", ...ROWS, spotValue: "ริมน้ำ A" });
  });

  it("[null/empty] a whole-camp booking carries no spotValue (never a fabricated dash)", () => {
    const view = buildBookedView({ bookingId: "bk_xyz", rows: ROWS });
    expect(view.spotValue).toBeUndefined();
  });
});

describe("buildBookingFailedView", () => {
  it("[normal] F1 rateLimited — the re-enabled confirm cta is carried through", () => {
    const cta = { kind: "confirm" as const, label: "ยืนยันการจอง", authState: "member" as const };
    const view = buildBookingFailedView({ reason: "rateLimited", rows: ROWS, cta });
    expect(view).toEqual({ kind: "bookingFailed", reason: "rateLimited", cta, ...ROWS });
  });

  it("[null/empty] F2 uncertain — no cta (the check-and-retry action replaces it, not a field on this view)", () => {
    const view = buildBookingFailedView({ reason: "uncertain", rows: ROWS });
    expect(view.cta).toBeUndefined();
  });

  it("[boundary] F3 sessionExpired — cta reverts to the guest login-to-confirm label", () => {
    const cta = { kind: "confirm" as const, label: "เข้าสู่ระบบเพื่อยืนยันการจอง", authState: "guest" as const };
    const view = buildBookingFailedView({ reason: "sessionExpired", rows: ROWS, cta });
    expect(view.cta).toEqual(cta);
    expect(view.reason).toBe("sessionExpired");
  });
});
