/**
 * cam-409-ai-chat-card-carousel.test.ts — CAM-409
 *
 * Source-inspection coverage (this repo's Vitest runs `environment: 'node'`,
 * no jsdom — see cam-272-ai-chat-components.test.ts's header comment) for
 * the carousel-with-peek layout that replaces CAM-272's vertical card
 * stack. Covers AC-1..4, BR-1..4, EC-1..3 from story.md + design.md.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const carouselSrc = read("components/ai-chat/AiChatCardCarousel.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");

describe("AC-1/BR-2 — cards sit in a horizontal row with peek (replaces the vertical stack)", () => {
  it("[structural] AiChatMessageList delegates to AiChatCardCarousel, not a space-y-3 stack", () => {
    expect(listSrc).toContain("AiChatCardCarousel");
    expect(listSrc).toContain("cards={entry.cards}");
    // the old CAM-272 vertical card-stack wrapper is gone (welcome state's
    // unrelated `space-y-3 py-2` is still fine — only this exact string must go)
    expect(listSrc).not.toContain("w-full max-w-full space-y-3");
    expect(listSrc).not.toContain("AiChatCampCard");
  });

  it("[unit] the track snaps horizontally with the on-scale peek width (w-64 sm:w-60)", () => {
    expect(carouselSrc).toContain("snap-x snap-mandatory");
    expect(carouselSrc).toContain("overflow-x-auto");
    expect(carouselSrc).toContain("w-64 shrink-0 snap-start sm:w-60");
  });

  it("[unit] the track bleeds to the panel edges (matches the p-4 message list)", () => {
    expect(carouselSrc).toContain("-mx-4");
    expect(carouselSrc).toContain("px-4");
  });

  it("[structural] the card visual is reused unchanged — AiChatCampCard, no parallel CampgroundCard import or aspect-ratio fork", () => {
    expect(carouselSrc).toContain('import { AiChatCampCard } from "@/components/ai-chat/AiChatCampCard"');
    expect(carouselSrc).not.toContain("CampgroundCard.tsx");
    expect(carouselSrc).not.toMatch(/aspect-(square|video|\[)/);
  });
});

describe("BR-1/EC-1 — carousel chrome renders only when cards.length > 1", () => {
  it("[unit] 0 cards renders nothing (the parent's zero-result notice covers it, no carousel)", () => {
    expect(carouselSrc).toContain("if (cards.length === 0) return null");
  });

  it("[unit] exactly 1 card renders the single card with NO carousel chrome", () => {
    const singleCardBlock = carouselSrc.slice(
      carouselSrc.indexOf("if (cards.length === 1)"),
      carouselSrc.indexOf("const groupLabel")
    );
    expect(singleCardBlock).toContain('data-testid="card--ai-chat-campsite" className="w-full max-w-full"');
    expect(singleCardBlock).not.toContain("carousel--ai-chat-cards");
    expect(singleCardBlock).not.toContain("btn--ai-chat-cards-prev");
    expect(singleCardBlock).not.toContain("btn--ai-chat-cards-next");
    expect(singleCardBlock).not.toContain("status--ai-chat-cards-position");
  });

  it("[unit] >1 cards renders the group + both chevrons + the indicator", () => {
    const multiCardBlock = carouselSrc.slice(carouselSrc.indexOf("const groupLabel"));
    expect(multiCardBlock).toContain('data-testid="carousel--ai-chat-cards"');
    expect(multiCardBlock).toContain('data-testid="btn--ai-chat-cards-prev"');
    expect(multiCardBlock).toContain('data-testid="btn--ai-chat-cards-next"');
    expect(multiCardBlock).toContain('data-testid="status--ai-chat-cards-position"');
  });
});

describe("Regression guard — the carousel's un-shrinkable track never forces the row/panel wider (real bug caught by empirical Playwright measurement, see summary)", () => {
  it("[unit] the carousel root is grid-cols-1 + min-w-0, not a plain flex/block wrapper", () => {
    expect(carouselSrc).toContain("grid w-full max-w-full min-w-0 grid-cols-1");
  });

  it("[unit] atStart/atEnd are derived from the snapped CARD INDEX, not a raw scrollLeft<=1 threshold (the track's own px-4 edge padding means the resting scrollLeft at card 1 is never exactly 0)", () => {
    expect(carouselSrc).toContain("track.scrollLeft - items[0].offsetLeft");
    expect(carouselSrc).toContain("setAtStart(clampedIndex <= 0)");
    expect(carouselSrc).toContain("setAtEnd(clampedIndex >= items.length - 1)");
    expect(carouselSrc).not.toMatch(/scrollLeft\s*<=\s*1\b/);
  });
});

describe("AC-2/BR-3/EC-2 — chevron ‹ › scrolls one card + disables at the ends", () => {
  it("[unit] Prev disables at scroll-start, Next disables at scroll-end", () => {
    expect(carouselSrc).toContain("disabled={atStart}");
    expect(carouselSrc).toContain("disabled={atEnd}");
  });

  it("[unit] both chevrons are a reused Button (ghost, icon, tap >= 44px), not a hand-rolled <button>", () => {
    expect(carouselSrc).toContain('import { Button } from "@/components/ui/button"');
    expect(carouselSrc).toContain('variant="ghost"');
    expect(carouselSrc).toContain('size="icon"');
    expect(carouselSrc).toContain("h-11 w-11 rounded-full");
  });

  it("[unit] chevrons carry the cardsPrev/cardsNext accessible name + test id", () => {
    expect(carouselSrc).toContain("aria-label={t.aiChat.cardsPrev}");
    expect(carouselSrc).toContain("aria-label={t.aiChat.cardsNext}");
  });

  it("[unit] chevron click scrolls the track by exactly one card width", () => {
    expect(carouselSrc).toContain("scrollByOneCard(-1)");
    expect(carouselSrc).toContain("scrollByOneCard(1)");
    expect(carouselSrc).toContain("track.scrollBy({ left: direction * step })");
  });
});

describe("EC-3 — prefers-reduced-motion disables smooth programmatic scroll", () => {
  it("[unit] the track's smoothness is motion-safe only (CSS class, not forced in JS)", () => {
    expect(carouselSrc).toContain("motion-safe:scroll-smooth");
  });

  it("[unit] scrollBy never forces behavior:'smooth' in JS (that would bypass prefers-reduced-motion)", () => {
    expect(carouselSrc).not.toMatch(/behavior:\s*["']smooth["']/);
  });
});

describe("AC-3 — the strip is a labelled, reachable group (a11y)", () => {
  it('[unit] role=group + aria-roledescription + counted aria-label (APG carousel pattern, not listbox)', () => {
    expect(carouselSrc).toContain('role="group"');
    expect(carouselSrc).toContain("aria-roledescription={t.aiChat.cardsRoleDescription}");
    expect(carouselSrc).toContain("aria-label={groupLabel}");
    expect(carouselSrc).toContain('cardsLabel.replace("{count}", String(cards.length))');
  });

  it("[unit] the strip is not an aria-live region (the answer bubble's role=log already announces)", () => {
    expect(carouselSrc).not.toContain("aria-live");
  });

  it("[unit] the indicator (dots/counter) is presentational — aria-hidden, tabular-nums", () => {
    expect(carouselSrc).toContain('aria-hidden="true"');
    expect(carouselSrc).toContain("tabular-nums");
  });

  // CAM-547 AC-1 — colour alone (bg-primary vs bg-muted-foreground) measured
  // 1.04-2.17:1 dot-to-dot across every opacity tried (never a comfortable
  // separation, since --primary/--muted-foreground sit close in perceptual
  // lightness in dark mode), so the active state is now carried by SHAPE
  // (a wider pill) first, colour second — pinning both, not colour alone.
  it("[unit] active dot is a wider pill (w-4, bg-primary); inactive is a smaller dot at a stronger opacity (muted-foreground/60, was /30 — 1.78:1 -> 3.40:1 vs the panel surface, clears the WCAG 1.4.11 3:1 non-text floor)", () => {
    expect(carouselSrc).toContain("h-1.5 w-4 rounded-full bg-primary");
    expect(carouselSrc).toContain("h-1.5 w-1.5 rounded-full bg-muted-foreground/60");
    // the OLD value is still named in prose (the investigation comment
    // explaining WHY it changed) — assert it is gone as a CLASS (quoted).
    expect(carouselSrc).not.toContain('bg-muted-foreground/30"');
  });
});

describe("AC-4 (CAM-428 SUPERSEDES) — tap-through navigates via onSelect/router.push, not a CampgroundCard link (Discover-only, no new write path)", () => {
  it("[security/structural] no mutation/write handler on the carousel's own card wrapper (only the chevrons + the onSelect->router.push navigation have onClick/router calls, never a fetch/POST)", () => {
    const cardWrapperLine = '<div key={card.id} data-testid="card--ai-chat-campsite"';
    expect(carouselSrc).toContain(cardWrapperLine);
    expect(carouselSrc).not.toMatch(/fetch\(|POST/);
  });
});

describe("Icons — lucide only (design.md §7), no emoji", () => {
  it("[structural] ChevronLeft/ChevronRight import from lucide-react", () => {
    expect(carouselSrc).toContain('import { ChevronLeft, ChevronRight } from "lucide-react"');
  });

  it("[structural] no emoji literal in the carousel source", () => {
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(carouselSrc)).toBe(false);
  });
});

describe("Token-only — no stray hex/px (DESIGN.md §2, check:palette scope)", () => {
  it("[structural] no raw hex color or arbitrary px literal in the carousel", () => {
    expect(carouselSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(carouselSrc).not.toMatch(/\[\d+px\]/);
  });
});

describe("BR-4 — copy (locales/translations.json aiChat namespace, TH verbatim + EN parity)", () => {
  // CAM-428 added a nested `card` object under aiChat — widen to `unknown`
  // leaves so this file's own flat-key lookups (cardsLabel/cardsPrev/etc.)
  // still narrow fine at each call site.
  const th = translations.th.aiChat as Record<string, unknown>;
  const en = translations.en.aiChat as Record<string, unknown>;

  it("th.aiChat.cardsLabel is verbatim", () => expect(th.cardsLabel).toBe("ลานกางเต็นท์ที่แนะนำ {count} แห่ง"));
  it("th.aiChat.cardsPrev is verbatim", () => expect(th.cardsPrev).toBe("ดูลานก่อนหน้า"));
  it("th.aiChat.cardsNext is verbatim", () => expect(th.cardsNext).toBe("ดูลานถัดไป"));
  it("th.aiChat.cardsRoleDescription is verbatim", () => expect(th.cardsRoleDescription).toBe("แถบเลื่อนการ์ด"));

  it("[structural] no em-dash separator in the new TH copy", () => {
    for (const key of ["cardsLabel", "cardsPrev", "cardsNext", "cardsRoleDescription"]) {
      expect(th[key], `th.aiChat.${key}`).not.toContain("—");
    }
  });

  it("[normal] every new key has a non-empty EN counterpart", () => {
    for (const key of ["cardsLabel", "cardsPrev", "cardsNext", "cardsRoleDescription"]) {
      expect(typeof en[key], `en.aiChat.${key}`).toBe("string");
      expect((en[key] as string).length).toBeGreaterThan(0);
    }
  });

  it("[structural] EN and TH still declare exactly the same aiChat key set", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(th).sort());
  });
});
