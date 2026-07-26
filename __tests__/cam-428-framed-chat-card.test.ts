/**
 * cam-428-framed-chat-card.test.ts — CAM-428
 *
 * "Framed chat-only camp card: a dedicated, READABLE card for the chat
 * surface on REAL DB fields." Full spec:
 * docs/specs/ai-assistant/chat-experience-overhaul/CAM-426-ai-expression-layer/design.md §4
 *
 * Source-inspection coverage (this repo's Vitest runs `environment: 'node'`,
 * no jsdom — see cam-272-ai-chat-components.test.ts's header comment).
 *
 * Covers: real-field rendering (price/tag/rating-or-empty/province-nullable/
 * image/availability chip), the BR-4 decouple from CampgroundCard's baked
 * <Link> (onSelect prop instead), and the new aiChat.card.* locale keys.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const cardSrc = read("components/ai-chat/AiChatCampCard.tsx");
const carouselSrc = read("components/ai-chat/AiChatCardCarousel.tsx");

describe("Decouple from CampgroundCard (BR-4 exception, design.md §4)", () => {
  it("[structural] AiChatCampCard imports no CampgroundCard and renders no <Link>", () => {
    expect(cardSrc).not.toMatch(/CampgroundCard/);
    expect(cardSrc).not.toContain("<Link");
    expect(cardSrc).not.toContain('from "next/link"');
  });

  it("[unit] the whole card is a real <button> (native focus/keyboard/role=button) that calls onSelect(card)", () => {
    expect(cardSrc).toContain('<button');
    expect(cardSrc).toContain('type="button"');
    expect(cardSrc).toContain("onClick={() => onSelect(card)}");
  });

  it("[unit] onSelect is a required prop — the caller decides what selecting a card does", () => {
    expect(cardSrc).toContain("onSelect: (card: AiChatCardResponse) => void");
  });
});

describe("Real fields only — priceLow / free / tag / rating / province / image (design.md §4 field map)", () => {
  it("[unit] priceLow renders ฿ + th-TH formatted number + the perNight key; null/0 falls back to the free key (same convention CampgroundCard.tsx uses)", () => {
    expect(cardSrc).toContain("THB_FORMAT.format(card.priceLow)");
    expect(cardSrc).toContain("t.aiChat.card.perNight");
    expect(cardSrc).toContain("t.aiChat.card.free");
    expect(cardSrc).toContain("card.priceLow && card.priceLow > 0");
  });

  it("[unit] the tag badge's source is card.matchedTag (CAM-564 — search-aware, supersedes the CAM-427 fixed options[0]), hidden when absent", () => {
    expect(cardSrc).toContain("card.matchedTag");
    expect(cardSrc).toContain("tagName &&");
  });

  it("[unit] G7: shows the star+avgRating+reviewCount row only when there are reviews, else the noReviews key — never a bare 0.0", () => {
    expect(cardSrc).toContain("card.hasReviews ?? (card.reviewCount > 0 && card.avgRating != null)");
    expect(cardSrc).toContain("t.aiChat.card.noReviews");
    expect(cardSrc).not.toMatch(/>\s*0\.0\s*</);
  });

  it("[unit] G8: the province row is omitted when location.province is empty (server coerces a null province to '')", () => {
    expect(cardSrc).toContain("card.location.province.trim().length > 0");
    expect(cardSrc).toContain("hasProvince &&");
  });

  it("[unit] the hero image goes through ImageWithFallback (frame + fade), not a raw <img>", () => {
    expect(cardSrc).toContain('import { ImageWithFallback } from "@/components/ui/image-with-fallback"');
    expect(cardSrc).toContain("src={card.images?.[0]?.url}");
    expect(cardSrc).not.toMatch(/<img\s/);
  });
});

describe("G3 — availability chip is date-range dependent: shown only when remaining is a real number", () => {
  it("[unit] the chip renders only when typeof card.remaining === 'number' (never fabricated when absent/null)", () => {
    expect(cardSrc).toContain('typeof card.remaining === "number"');
    expect(cardSrc).toContain("hasRemaining &&");
    expect(cardSrc).toContain('t.aiChat.card.remaining.replace("{count}", String(card.remaining))');
  });
});

describe("Carousel wiring (CAM-447 SUPERSEDES) — onSelect forwards to the caller's onSelectCamp, which opens the floating detail card instead of navigating", () => {
  it("[unit] both the single-card and multi-card render paths pass onSelect={onSelectCamp}", () => {
    const occurrences = carouselSrc.match(/onSelect=\{onSelectCamp\}/g) ?? [];
    expect(occurrences.length).toBe(2);
  });

  it("[unit] the carousel no longer navigates itself — no useRouter/router.push/window.location", () => {
    expect(carouselSrc).not.toContain('import { useRouter } from "next/navigation"');
    expect(carouselSrc).not.toContain("const router = useRouter();");
    expect(carouselSrc).not.toMatch(/router\.push\(/);
    expect(carouselSrc).not.toMatch(/window\.location/);
  });
});

describe("a11y — accessible name + visible focus ring on the whole-card tap target", () => {
  it("[unit] aria-label composes the camp name + the viewDetail copy (design.md §4 tap-target rule)", () => {
    expect(cardSrc).toContain("aria-label={`${name} ${t.aiChat.card.viewDetail}`}");
  });

  it("[unit] focus-visible ring uses the semantic ring token, never a hardcoded ring color", () => {
    expect(cardSrc).toContain("focus-visible:ring-ring");
    expect(cardSrc).not.toMatch(/focus-visible:ring-(primary|foreground)\b/);
  });

  // CAM-547 AC-5 — Star now lives inside the image-overlay Badge (its own
  // CVA forces child svgs to size-3), so it no longer carries an explicit
  // size className; ChevronRight is gone entirely (AC-3, see below).
  it("[unit] decorative icons (MapPin/Star) are aria-hidden — meaning is carried by the adjacent text", () => {
    expect(cardSrc).toContain('<MapPin className="size-3.5 shrink-0" aria-hidden="true" />');
    expect(cardSrc).toContain('<Star className="fill-current" aria-hidden="true" />');
  });
});

describe("Copy — the card's own aiChat.card.* keys (TH verbatim + EN parity, design.md §7)", () => {
  const th = (translations.th.aiChat as Record<string, unknown>).card as Record<string, string>;
  const en = (translations.en.aiChat as Record<string, unknown>).card as Record<string, string>;

  it("th.aiChat.card.* is verbatim", () => {
    expect(th.perNight).toBe("/คืน");
    expect(th.free).toBe("ฟรี");
    expect(th.noReviews).toBe("ยังไม่มีรีวิว");
    expect(th.reviews).toBe("{count} รีวิว");
    expect(th.remaining).toBe("เหลือ {count} ที่");
    expect(th.viewDetail).toBe("ดูรายละเอียด");
  });

  it("[structural] no em-dash separator in the new TH card copy", () => {
    for (const key of Object.keys(th)) expect(th[key], `th.aiChat.card.${key}`).not.toContain("—");
  });

  it("[structural] EN and TH declare exactly the same card key set", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(th).sort());
  });

  it("[normal] every EN card key is a non-empty string", () => {
    for (const key of Object.keys(en)) {
      expect(typeof en[key], `en.aiChat.card.${key}`).toBe("string");
      expect(en[key].length).toBeGreaterThan(0);
    }
  });
});

describe("Token-only (DESIGN.md §2, check:palette/check:ds scope) + Expression Layer tokens", () => {
  it("[structural] no raw hex or arbitrary px literal", () => {
    expect(cardSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(cardSrc).not.toMatch(/\[\d+px\]/);
  });

  it("[unit] the frame uses the sanctioned Expression Layer tokens (bg-card content + ai-tint border + ai-glow), per design.md §4", () => {
    expect(cardSrc).toContain("bg-card");
    expect(cardSrc).toContain("border-ai-tint");
    expect(cardSrc).toContain("shadow-ai-glow");
  });
});

describe("Icons — lucide only, no emoji (standing owner rule)", () => {
  it('[structural] MapPin/Star import from lucide-react (ChevronRight removed, CAM-547 AC-3)', () => {
    expect(cardSrc).toContain('import { MapPin, Star } from "lucide-react"');
    expect(cardSrc).not.toContain("ChevronRight");
  });

  it("[structural] no emoji literal in the card source", () => {
    // eslint-disable-next-line no-misleading-character-class
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(cardSrc)).toBe(false);
  });
});
