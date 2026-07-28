/**
 * cam-643-chat-price-per-night.test.ts — CAM-643
 *
 * The AI chat was the only surface quoting price as per-guest
 * ("statPriceLabel"/"perGuestNight" = "per guest / night") while every
 * sibling surface (camp card, camp detail page, host price input,
 * `computeBookingPrice`) treats price as strictly per-night. The fix
 * removes the two private duplicate keys and points both AiChatDetailCard
 * call sites at the SAME key the chat's own card carousel already uses
 * (`aiChat.card.perNight`) — this is the guard: the two spots literally
 * cannot drift apart again because there is only one string to read.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const detailSrc = read("components/ai-chat/AiChatDetailCard.tsx");
const cardSrc = read("components/ai-chat/AiChatCampCard.tsx");
const campgroundCardSrc = read("components/CampgroundCard.tsx");

describe("[unit] the two wrong per-guest keys are gone from both locales", () => {
  it("normal: aiChat.detail no longer has statPriceLabel or perGuestNight in en/th", () => {
    const enDetail = translations.en.aiChat.detail as Record<string, unknown>;
    const thDetail = translations.th.aiChat.detail as Record<string, unknown>;
    expect(enDetail.statPriceLabel).toBeUndefined();
    expect(enDetail.perGuestNight).toBeUndefined();
    expect(thDetail.statPriceLabel).toBeUndefined();
    expect(thDetail.perGuestNight).toBeUndefined();
  });

  it("error/validation: no remaining per-guest-per-night phrasing anywhere in translations.json", () => {
    const raw = JSON.stringify(translations);
    expect(raw).not.toContain("per guest / night");
    expect(raw).not.toContain("/guest/night");
    expect(raw).not.toContain("ต่อคน/คืน");
    expect(raw).not.toContain("/คน/คืน");
  });
});

describe("[structural] the chat's price label reuses the SAME key as the chat's own card (cannot drift apart again)", () => {
  it("normal: both AiChatDetailCard price call sites read aiChat.card.perNight", () => {
    // the quick-glance stat tile (was statPriceLabel)
    expect(detailSrc).toContain("label: t.aiChat.card.perNight,");
    // the price section suffix (was perGuestNight)
    expect(detailSrc).toContain('<span className="text-xs text-foreground/70">{t.aiChat.card.perNight}</span>');
    // no reference to either retired key remains
    expect(detailSrc).not.toContain("t.aiChat.detail.statPriceLabel");
    expect(detailSrc).not.toContain("t.aiChat.detail.perGuestNight");
  });

  it("normal: card carousel (AiChatCampCard) also reads the same aiChat.card.perNight key", () => {
    expect(cardSrc).toContain("t.aiChat.card.perNight");
  });
});

describe("[unit] the chat's per-night phrasing matches the site-wide per-night phrasing (camp card page)", () => {
  it("normal: aiChat.card.perNight equals common.perNight in both locales", () => {
    expect(translations.en.aiChat.card.perNight).toBe(translations.en.common.perNight);
    expect(translations.th.aiChat.card.perNight).toBe(translations.th.common.perNight);
  });

  it("normal: the real camp card (CampgroundCard) reads common.perNight, the same phrasing the chat now reuses", () => {
    expect(campgroundCardSrc).toContain("t.common.perNight");
  });

  it("normal: verbatim TH values are the per-night suffix, not a per-guest one", () => {
    expect(translations.th.aiChat.card.perNight).toBe("/คืน");
    expect(translations.en.aiChat.card.perNight).toBe("/night");
  });
});
