/**
 * cam-701-booking-copy.test.ts — CAM-701 (epic CAM-695, design brief
 * CAM-697 §13.1/§13.2)
 *
 * Thai copy verbatim (char-for-char, per .claude/rules/qa.md) + EN parity
 * for every NEW `aiChat.booking.*` key this story adds, and the ONE key it
 * changes (`summary.estimateNote`, asserted in cam-638-booking-copy.test.ts
 * with its own dated note — not repeated here). Same convention
 * `cam-638-booking-copy.test.ts`/`cam-272-ai-chat-i18n.test.ts` establish.
 */
import { describe, expect, it } from "vitest";
import translations from "../locales/translations.json";

const th = translations.th.aiChat.booking;
const en = translations.en.aiChat.booking;

describe("locales/translations.json — new aiChat.booking keys (TH verbatim, design brief CAM-697 §13.1)", () => {
  it("confirm", () => expect(th.confirm).toBe("ยืนยันการจอง"));
  it("loginToConfirm", () => expect(th.loginToConfirm).toBe("เข้าสู่ระบบเพื่อยืนยันการจอง"));
  it("loginPrompt", () => expect(th.loginPrompt).toBe("เข้าสู่ระบบก่อน จะได้จองให้เสร็จในแชทนี้เลย"));
  it("sessionExpired", () => expect(th.sessionExpired).toBe("คุณออกจากระบบไปแล้ว เข้าสู่ระบบอีกครั้งแล้วกดยืนยันได้เลย"));
  it("submitting", () => expect(th.submitting).toBe("กำลังยืนยันการจอง…"));
  it("nights.overRun", () =>
    expect(th.nights.overRun).toBe("{date} ว่างต่อเนื่อง {count} คืน เลือกเท่านี้ก่อน หรือกดแก้วันไปหาช่วงที่ยาวกว่านี้"));
  it("summary.introConfirm", () => expect(th.summary.introConfirm).toBe("ตรวจดูอีกทีนะ ถ้าโอเคแล้วกดยืนยันได้เลย"));

  it("success.title", () => expect(th.success.title).toBe("จองสำเร็จแล้ว"));
  it("success.label", () => expect(th.success.label).toBe("สรุปการจองที่สำเร็จแล้ว"));
  it("success.totalRow", () => expect(th.success.totalRow).toBe("ยอดรวม"));
  it("success.pendingNote", () => expect(th.success.pendingNote).toBe("ลานจะยืนยันการจองอีกครั้ง"));
  it("success.viewBooking", () => expect(th.success.viewBooking).toBe("ดูรายละเอียดการจอง"));
  it("success.viewAll", () => expect(th.success.viewAll).toBe("ดูการจองทั้งหมด"));

  it("failed.rateLimited", () => expect(th.failed.rateLimited).toBe("กดจองถี่เกินไป รอสักครู่แล้วกดยืนยันอีกที"));
  it("failed.uncertain", () =>
    expect(th.failed.uncertain).toBe("เรายังไม่แน่ใจว่าการจองบันทึกไปหรือยัง กดตรวจสอบก่อนได้เลย จะได้ไม่จองซ้ำ"));
  it("failed.checkAndRetry", () => expect(th.failed.checkAndRetry).toBe("ตรวจสอบแล้วลองใหม่"));
  it("failed.viewMyBookings", () => expect(th.failed.viewMyBookings).toBe("ดูการจองของฉัน"));

  it("[structural] no em-dash separator in any new TH value", () => {
    const values = [
      th.confirm,
      th.loginToConfirm,
      th.loginPrompt,
      th.sessionExpired,
      th.submitting,
      th.nights.overRun,
      th.summary.introConfirm,
      th.summary.estimateNote,
      th.success.title,
      th.success.label,
      th.success.totalRow,
      th.success.pendingNote,
      th.success.viewBooking,
      th.success.viewAll,
      th.failed.rateLimited,
      th.failed.uncertain,
      th.failed.checkAndRetry,
      th.failed.viewMyBookings,
    ];
    for (const value of values) expect(value).not.toContain("—");
  });

  it("[structural] no ครับ/ค่ะ particle anywhere in the new keys", () => {
    const values = [th.confirm, th.loginToConfirm, th.loginPrompt, th.sessionExpired, th.submitting, th.success.pendingNote];
    for (const value of values) expect(value).not.toMatch(/ครับ|ค่ะ/);
  });
});

describe("locales/translations.json — EN parity for every new key (AC-3)", () => {
  it("confirm", () => expect(en.confirm).toBe("Confirm booking"));
  it("loginToConfirm", () => expect(en.loginToConfirm).toBe("Sign in to confirm booking"));
  it("sessionExpired", () => expect(en.sessionExpired).toBe("You've been signed out. Sign in again, then confirm."));
  it("submitting", () => expect(en.submitting).toBe("Confirming your booking…"));
  it("success.title", () => expect(en.success.title).toBe("Booking confirmed"));
  it("failed.uncertain", () =>
    expect(en.failed.uncertain).toBe("I'm not sure yet whether the booking went through. Check first so you don't book twice."));

  it("[normal] every new leaf is a non-empty string in both locales", () => {
    const groups: [string, unknown][] = [
      ["th.confirm", th.confirm],
      ["th.success", th.success],
      ["th.failed", th.failed],
      ["en.confirm", en.confirm],
      ["en.success", en.success],
      ["en.failed", en.failed],
    ];
    for (const [path, value] of groups) {
      if (typeof value === "string") {
        expect(value.length, path).toBeGreaterThan(0);
      } else {
        for (const [k, v] of Object.entries(value as Record<string, string>)) {
          expect(typeof v, `${path}.${k}`).toBe("string");
          expect((v as string).length, `${path}.${k}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("Keys deliberately KEPT (CAM-701 scope note, not the brief's full §13.4) — handoff + summary.intro still read live", () => {
  it("aiChat.booking.handoff / summary.intro are NOT retired — the interim per-spot handoff escape still uses them", () => {
    expect(th.handoff).toBe("ไปกรอกต่อที่หน้าจอง");
    expect(th.summary.intro).toBe("ตรวจดูอีกทีนะ ถ้าโอเคแล้วไปกรอกต่อที่หน้าจองได้เลย");
  });
});
