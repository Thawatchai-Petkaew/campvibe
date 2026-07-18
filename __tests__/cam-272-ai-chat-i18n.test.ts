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
  it("CAM-411 BR-1: launcherLabel (renamed to the น้องกองไฟ identity)", () =>
    expect(th.launcherLabel).toBe("คุยกับน้องกองไฟ"));
  it("BR-7: title (kept, base role text)", () => expect(th.title).toBe("ผู้ช่วยหาที่กางเต็นท์"));
  it("CAM-411 BR-1: name", () => expect(th.name).toBe("น้องกองไฟ"));
  it("CAM-411 BR-1: role (reuses the title text as the header subtitle)", () =>
    expect(th.role).toBe("ผู้ช่วยหาที่กางเต็นท์"));
  it("BR-7: close", () => expect(th.close).toBe("ปิด"));
  it("composerPlaceholder", () => expect(th.composerPlaceholder).toBe("พิมพ์คำถามเกี่ยวกับลานกางเต็นท์…"));
  it("send", () => expect(th.send).toBe("ส่งคำถาม"));
  it("BR-3: typing", () => expect(th.typing).toBe("ผู้ช่วยกำลังพิมพ์…"));
  it("loading", () => expect(th.loading).toBe("กำลังโหลด…"));
  it("CAM-411 AC-2: welcomeHeading (name-voiced greeting)", () =>
    expect(th.welcomeHeading).toBe("สวัสดี เราน้องกองไฟเอง อยากได้ที่กางเต็นท์แบบไหน ลองเล่าให้ฟังได้เลย"));
  it("CAM-411 AC-2/BR-5: welcomeExamplesLabel", () => expect(th.welcomeExamplesLabel).toBe("ลองถามแบบนี้ดู"));
  it("AC-1/BR-2: suggestion1", () => expect(th.suggestion1).toBe("หาที่แคมป์ติดน้ำ หมาเข้าได้"));
  it("BR-2: suggestion2", () => expect(th.suggestion2).toBe("ลานใกล้เชียงใหม่ งบไม่เกิน 1500 บาท"));
  it("BR-2: suggestion3", () => expect(th.suggestion3).toBe("ที่กางเต็นท์สำหรับครอบครัว มีห้องน้ำสะอาด"));
  it("CAM-411 AC-4: zeroResult (name-voiced)", () =>
    expect(th.zeroResult).toBe("ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ"));
  it("AC-5/EC-5: error", () => expect(th.error).toBe("ผู้ช่วยขัดข้อง กรุณาลองใหม่อีกครั้ง"));
  it("AC-5: retry", () => expect(th.retry).toBe("ลองใหม่"));
  it("AC-6/EC-3: rateLimited", () => expect(th.rateLimited).toBe("มีคำถามเข้ามามากเกินไป กรุณารอสักครู่แล้วลองใหม่"));
  it("CAM-411 EC-2: disabled (name-voiced)", () => expect(th.disabled).toBe("น้องกองไฟยังไม่พร้อมให้บริการ"));
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
