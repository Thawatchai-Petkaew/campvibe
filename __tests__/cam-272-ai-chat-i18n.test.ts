/**
 * cam-272-ai-chat-i18n.test.ts — CAM-272
 *
 * Thai copy verbatim (char-for-char, per .claude/rules/qa.md) + EN parity
 * for every `aiChat.*` key design.md's §Copy table promises. No key is
 * hardcoded in any component — every usage resolves through this file.
 */
import { describe, expect, it } from "vitest";
import translations from "../locales/translations.json";

const th = translations.th.aiChat;
const en = translations.en.aiChat;

describe("locales/translations.json — aiChat namespace (TH verbatim, per design.md §Copy)", () => {
  it("AC-1/BR-1: launcherLabel", () => expect(th.launcherLabel).toBe("เปิดผู้ช่วยหาที่กางเต็นท์"));
  it("BR-7: title (panel aria-label)", () => expect(th.title).toBe("ผู้ช่วยหาที่กางเต็นท์"));
  it("BR-7: close", () => expect(th.close).toBe("ปิด"));
  it("composerPlaceholder", () => expect(th.composerPlaceholder).toBe("พิมพ์คำถามเกี่ยวกับลานกางเต็นท์…"));
  it("send", () => expect(th.send).toBe("ส่งคำถาม"));
  it("BR-3: typing", () => expect(th.typing).toBe("ผู้ช่วยกำลังพิมพ์…"));
  it("loading", () => expect(th.loading).toBe("กำลังโหลด…"));
  it("AC-1/BR-2: welcomeHeading", () => expect(th.welcomeHeading).toBe("ถามผู้ช่วยหาที่กางเต็นท์ได้เลย"));
  it("AC-1/BR-2: suggestion1", () => expect(th.suggestion1).toBe("หาที่แคมป์ติดน้ำ หมาเข้าได้"));
  it("BR-2: suggestion2", () => expect(th.suggestion2).toBe("ลานใกล้เชียงใหม่ งบไม่เกิน 1500 บาท"));
  it("BR-2: suggestion3", () => expect(th.suggestion3).toBe("ที่กางเต็นท์สำหรับครอบครัว มีห้องน้ำสะอาด"));
  it("AC-4/EC-2: zeroResult", () => expect(th.zeroResult).toBe("ยังไม่พบลานที่ตรงกับที่ค้นหา ลองปรับเงื่อนไขดูนะ"));
  it("AC-5/EC-5: error", () => expect(th.error).toBe("ผู้ช่วยขัดข้อง กรุณาลองใหม่อีกครั้ง"));
  it("AC-5: retry", () => expect(th.retry).toBe("ลองใหม่"));
  it("AC-6/EC-3: rateLimited", () => expect(th.rateLimited).toBe("มีคำถามเข้ามามากเกินไป กรุณารอสักครู่แล้วลองใหม่"));
  it("AC-7/EC-4: disabled", () => expect(th.disabled).toBe("ผู้ช่วยยังไม่เปิดใช้งาน"));
  it("CAM-410 AC-6/BR-8: suggestedQuestionsLabel (chip group aria-label)", () =>
    expect(th.suggestedQuestionsLabel).toBe("คำถามแนะนำ"));
  it("CAM-410 BR-8: suggestedQuestionsLabel EN counterpart", () =>
    expect(en.suggestedQuestionsLabel).toBe("Suggested questions"));

  it("[structural] no em-dash separator in any TH aiChat copy (DESIGN.md §4)", () => {
    for (const [key, value] of Object.entries(th)) {
      expect(value, `th.aiChat.${key}`).not.toContain("—");
    }
  });
});

describe("locales/translations.json — aiChat namespace has an EN counterpart for every TH key", () => {
  it("[structural] EN and TH declare exactly the same key set", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(th).sort());
  });

  it("[normal] EN copy is non-empty for every key", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(typeof value, `en.aiChat.${key}`).toBe("string");
      expect((value as string).length, `en.aiChat.${key}`).toBeGreaterThan(0);
    }
  });
});
