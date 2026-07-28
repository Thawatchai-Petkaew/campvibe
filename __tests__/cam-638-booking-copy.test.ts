/**
 * cam-638-booking-copy.test.ts — CAM-638 (epic CAM-630, design brief CAM-637 §8)
 *
 * Thai copy verbatim (char-for-char, per .claude/rules/qa.md) + EN parity
 * for every `aiChat.booking.*` key the design brief's §8 copy table
 * promises — the same convention `__tests__/cam-272-ai-chat-i18n.test.ts`
 * already applies to the rest of the `aiChat` namespace.
 */
import { describe, expect, it } from "vitest";
import translations from "../locales/translations.json";

const th = translations.th.aiChat.booking;
const en = translations.en.aiChat.booking;

/** Recurses through the nested `stepName`/`date`/`guests`/`summary` groups (booking-flow.ts's own step ids drive the nesting depth, never hand-copied here). */
function collectLeaves(value: unknown, path: string): [string, unknown][] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) => collectLeaves(v, `${path}.${key}`));
  }
  return [[path, value]];
}

describe("locales/translations.json — aiChat.booking namespace (TH verbatim, per design brief CAM-637 §8)", () => {
  it("start", () => expect(th.start).toBe("เริ่มจอง"));
  it("startAriaLabel", () => expect(th.startAriaLabel).toBe("เริ่มจองลาน {name}"));
  it("BR-1: groupLabel", () => expect(th.groupLabel).toBe("ขั้นตอนการจอง"));
  it("BR-1: stepCaption", () => expect(th.stepCaption).toBe("ขั้นที่ {current} จาก {total}"));
  it("stepName.date", () => expect(th.stepName.date).toBe("เลือกวัน"));
  it("stepName.guests", () => expect(th.stepName.guests).toBe("จำนวนคน"));
  it("stepName.summary", () => expect(th.stepName.summary).toBe("ตรวจดูอีกที"));

  it("date.ask", () => expect(th.date.ask).toBe("เริ่มจอง {name} กันเลย อยากไปวันไหนดี"));
  it("date.chipsLabel", () => expect(th.date.chipsLabel).toBe("วันที่ยังว่าง"));
  it("BR-3: date.chip", () => expect(th.date.chip).toBe("{date} เหลือ {count} ที่"));
  it("EC-4: date.chipNoCap", () => expect(th.date.chipNoCap).toBe("{date} มีที่ว่าง"));
  it("date.typeHint", () => expect(th.date.typeHint).toBe("หรือพิมพ์วันที่เองก็ได้ เช่น เสาร์หน้า หรือ 15 ส.ค."));
  it("date.empty", () =>
    expect(th.date.empty).toBe("ช่วงนี้ยังไม่มีเสาร์ว่างเลย ลองพิมพ์วันที่อยากไปมาได้เลย เดี๋ยวเราหาให้"));
  it("date.unreadable", () => expect(th.date.unreadable).toBe("ยังจับวันไม่ได้เลย ลองบอกใหม่อีกที เช่น เสาร์หน้า หรือ 15 ส.ค."));
  it("date.full", () => expect(th.date.full).toBe("{date} เต็มแล้ว ลองวันอื่นดูไหม"));

  it("guests.ask", () => expect(th.guests.ask).toBe("{date} นะ วันนั้นเหลือ {count} ที่ ไปกันกี่คน"));
  it("guests.askNoCap", () => expect(th.guests.askNoCap).toBe("{date} นะ ไปกันกี่คน"));
  it("guests.chipsLabel", () => expect(th.guests.chipsLabel).toBe("จำนวนคน"));
  it("guests.chip", () => expect(th.guests.chip).toBe("{count} คน"));
  it("guests.typeHint", () => expect(th.guests.typeHint).toBe("ไปกันหลายคนกว่านี้ พิมพ์จำนวนมาได้เลย"));
  it("guests.unreadable", () => expect(th.guests.unreadable).toBe("ยังจับจำนวนไม่ได้เลย บอกเป็นตัวเลขได้ เช่น 2 คน"));
  it("EC E2: guests.overCapacity", () => expect(th.guests.overCapacity).toBe("{date} เหลือ {remaining} ที่ ไป {requested} คนอาจไม่พอ"));
  it("EC E2: guests.overCapacityHint", () =>
    expect(th.guests.overCapacityHint).toBe("เลือก {remaining} คนได้เลย หรือกดย้อนกลับไปหาวันที่รับได้ทั้งกลุ่ม"));
  it("EC E2: guests.capChip", () => expect(th.guests.capChip).toBe("{count} คนก็ได้"));

  it("BR-6: summary.intro", () => expect(th.summary.intro).toBe("ตรวจดูอีกทีนะ ถ้าโอเคแล้วไปกรอกต่อที่หน้าจองได้เลย"));
  it("summary.label", () => expect(th.summary.label).toBe("สรุปการจองที่เลือกไว้"));
  it("summary.campRow", () => expect(th.summary.campRow).toBe("ลาน"));
  it("summary.datesRow", () => expect(th.summary.datesRow).toBe("วันเข้าพัก"));
  it("summary.datesValue", () => expect(th.summary.datesValue).toBe("{date} พัก 1 คืน"));
  it("summary.guestsRow", () => expect(th.summary.guestsRow).toBe("จำนวนคน"));
  it("summary.guestsValue", () => expect(th.summary.guestsValue).toBe("{count} คน"));
  it("BR-7: summary.totalRow", () => expect(th.summary.totalRow).toBe("ยอดรวมโดยประมาณ"));
  it("summary.estimateNote", () => expect(th.summary.estimateNote).toBe("ค่าธรรมเนียมของลานยังไม่รวมในนี้ ดูยอดเต็มได้ที่หน้าจอง"));

  it("BR-6: handoff (never ยืนยัน/จองเลย)", () => {
    expect(th.handoff).toBe("ไปกรอกต่อที่หน้าจอง");
    expect(th.handoff).not.toContain("ยืนยัน");
    expect(th.handoff).not.toContain("จองเลย");
  });
  it("back", () => expect(th.back).toBe("ย้อนกลับ"));
  it("editDate", () => expect(th.editDate).toBe("แก้วัน"));
  it("editGuests", () => expect(th.editGuests).toBe("แก้จำนวนคน"));
  it("cancel", () => expect(th.cancel).toBe("ยกเลิกการจอง"));
  it("controlsLabel", () => expect(th.controlsLabel).toBe("ตัวเลือกอื่น"));
  it("cancelled", () => expect(th.cancelled).toBe("ยกเลิกให้แล้ว อยากดูลานอื่นต่อไหม"));
  it("checking", () => expect(th.checking).toBe("กำลังตรวจสอบที่ว่าง…"));
  it("E3: checkFailed", () => expect(th.checkFailed).toBe("ตรวจสอบที่ว่างไม่สำเร็จ ลองอีกทีได้เลย"));
  it("E1: justFilled", () => expect(th.justFilled).toBe("ขอโทษที {date} เพิ่งเต็มไปเมื่อกี้ ลองวันอื่นดูไหม"));
  it("EC-8: handedToAssistant", () => expect(th.handedToAssistant).toBe("โอเค พักเรื่องจองไว้ก่อน เดี๋ยวเราตอบเรื่องนี้ให้"));

  it("BR-6: no booking code / ticket / \"จองสำเร็จ\" anywhere in the TH copy set (checkFailed's \"ไม่สำเร็จ\" is the AVAILABILITY check failing, not a completed booking)", () => {
    for (const [path, value] of collectLeaves(th, "th.aiChat.booking")) {
      expect(value, path).not.toContain("จองสำเร็จ");
    }
  });

  it("[structural] no em-dash separator in any TH booking value (EC-3)", () => {
    for (const [path, value] of collectLeaves(th, "th.aiChat.booking")) {
      expect(value, path).not.toContain("—");
    }
  });

  it("[structural] no ครับ/ค่ะ particle anywhere (design brief §8 — shipped voice has zero occurrences)", () => {
    for (const [path, value] of collectLeaves(th, "th.aiChat.booking")) {
      expect(value, path).not.toMatch(/ครับ|ค่ะ/);
    }
  });
});

describe("locales/translations.json — aiChat.booking has an EN counterpart for every TH key (AC-3)", () => {
  it("[structural] EN and TH declare exactly the same leaf key set", () => {
    const thPaths = collectLeaves(th, "").map(([p]) => p).sort();
    const enPaths = collectLeaves(en, "").map(([p]) => p).sort();
    expect(enPaths).toEqual(thPaths);
  });

  it("[normal] every leaf is a non-empty string in both locales", () => {
    for (const [path, value] of [...collectLeaves(th, "th"), ...collectLeaves(en, "en")]) {
      expect(typeof value, path).toBe("string");
      expect((value as string).length, path).toBeGreaterThan(0);
    }
  });
});

describe("Keys deliberately REUSED (design brief §8) — no duplicate key was added for these", () => {
  it("aiChat.retry / aiChat.detail.openNoCap / booking.notChargedYet / aiChat.detail.viewCampPage already exist", () => {
    expect(translations.th.aiChat.retry).toBe("ลองใหม่");
    expect(translations.th.aiChat.detail.openNoCap).toBe("มีที่ว่าง");
    expect(translations.th.booking.notChargedYet).toBe("คุณจะยังไม่ถูกเรียกเก็บเงิน");
    expect(translations.th.aiChat.detail.viewCampPage).toBe("ดูหน้าลาน");
  });
});
