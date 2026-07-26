/**
 * cam-438-card-price-hero.test.ts — CAM-438
 *
 * "In-chat camp cards show their full border and lead with price."
 * R2 owner staging feedback: carousel track clipped the card border/glow/
 * hover-lift top and bottom, and price read at the same weight as rating.
 *
 * Source-inspection coverage (this repo's Vitest runs `environment: 'node'`,
 * no jsdom — see cam-272-ai-chat-components.test.ts's header comment).
 *
 * Prove-It guards (each assertion goes RED if the fix were reverted):
 *   AC-1 (un-crop)    -> track className carries pt-4/pb-14 (CAM-547 widened the
 *                        original symmetric py-4 into an asymmetric pair, sized to
 *                        the shadow token's own measured downward reach) alongside
 *                        overflow-x-auto/px-4
 *   AC-2/AC-3 (hero)  -> price <p> is text-lg/font-semibold/text-primary, BEFORE
 *                        the province row in source order; /คืน suffix is
 *                        text-xs/text-muted-foreground
 *   BR-3 (dedup)      -> data-testid="text--ai-chat-card-price" appears EXACTLY
 *                        ONCE (reintroducing the old inline meta-row price turns
 *                        this red)
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const cardSrc = read("components/ai-chat/AiChatCampCard.tsx");
const carouselSrc = read("components/ai-chat/AiChatCardCarousel.tsx");

describe("AC-1 — carousel track no longer clips the card border/glow/hover-lift", () => {
  it("[unit] the multi-card track className carries pt-4/pb-14 (CAM-547 widened the original py-4) alongside the existing overflow-x-auto/px-4 peek", () => {
    const trackClassMatch = carouselSrc.match(/data-testid="carousel--ai-chat-cards"[\s\S]*?className="([^"]+)"/);
    expect(trackClassMatch, "multi-card track className not found").not.toBeNull();
    const trackClass = trackClassMatch![1];
    expect(trackClass).toContain("overflow-x-auto");
    expect(trackClass).toContain("px-4");
    expect(trackClass).toContain("pt-4");
    expect(trackClass).toContain("pb-14");
  });

  it("[structural] the single-card branch (no carousel chrome) is untouched — no pt-4/pb-14 needed there, it was never clipped", () => {
    const singleCardBlock = carouselSrc.match(/cards\.length === 1[\s\S]*?<\/div>\s*\);/)?.[0] ?? "";
    expect(singleCardBlock).toContain('data-testid="card--ai-chat-campsite" className="w-full max-w-full"');
    expect(singleCardBlock).not.toContain("pt-4");
    expect(singleCardBlock).not.toContain("pb-14");
  });
});

describe("AC-2/AC-3 — price renders as its own hero line, before the province row", () => {
  // CAM-444 (owner R3 feedback): the price hero now reads text-ai-price, a
  // dedicated token brightened in dark mode — --primary itself is unchanged
  // (would break white-on-primary buttons + the chat bubble site-wide).
  it("[unit] the price <p> carries the hero classes: text-lg, font-semibold, text-ai-price", () => {
    const priceBlockMatch = cardSrc.match(
      /<p className="flex items-baseline gap-1 tabular-nums" data-testid="text--ai-chat-card-price">([\s\S]*?)<\/p>/
    );
    expect(priceBlockMatch, "hero price <p> not found").not.toBeNull();
    const priceBlock = priceBlockMatch![1];
    // priced case
    expect(priceBlock).toContain('<span className="text-lg font-semibold text-ai-price">฿{THB_FORMAT.format(card.priceLow)}</span>');
    // free case — same hero weight
    expect(priceBlock).toContain('<span className="text-lg font-semibold text-ai-price">{t.aiChat.card.free}</span>');
  });

  it("[unit] the /คืน (perNight) suffix is small + muted, not hero weight", () => {
    expect(cardSrc).toContain('<span className="text-xs font-normal text-muted-foreground">{t.aiChat.card.perNight}</span>');
  });

  it("[structural] price hero line appears BEFORE the province row in source order (reading order: name -> price -> province)", () => {
    const priceIdx = cardSrc.indexOf('data-testid="text--ai-chat-card-price"');
    const provinceIdx = cardSrc.indexOf('data-testid="text--ai-chat-card-province"');
    expect(priceIdx).toBeGreaterThan(-1);
    expect(provinceIdx).toBeGreaterThan(-1);
    expect(priceIdx).toBeLessThan(provinceIdx);
  });

  it("[structural] price hero line appears AFTER the name (reading order: name -> price)", () => {
    const nameIdx = cardSrc.indexOf('data-testid="text--ai-chat-card-name"');
    const priceIdx = cardSrc.indexOf('data-testid="text--ai-chat-card-price"');
    expect(nameIdx).toBeGreaterThan(-1);
    expect(priceIdx).toBeGreaterThan(nameIdx);
  });
});

describe("BR-3 — price appears exactly once per card (no duplicate in the shared meta row)", () => {
  it("[unit] data-testid=\"text--ai-chat-card-price\" occurs EXACTLY ONCE in the card source", () => {
    const occurrences = cardSrc.match(/data-testid="text--ai-chat-card-price"/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it("[structural] the shared meta row (rating/remaining) no longer inlines a price span", () => {
    const metaRowMatch = cardSrc.match(
      /<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">([\s\S]*?)<\/div>/
    );
    expect(metaRowMatch, "meta row not found").not.toBeNull();
    const metaRow = metaRowMatch![1];
    expect(metaRow).not.toContain("text--ai-chat-card-price");
    expect(metaRow).not.toContain("THB_FORMAT.format(card.priceLow)");
  });
});
