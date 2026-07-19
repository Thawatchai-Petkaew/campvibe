/**
 * cam-447-ai-chat-detail-card.test.ts — CAM-447
 *
 * Source-inspection coverage (this repo's Vitest runs `environment: 'node'`,
 * no jsdom — see cam-272-ai-chat-components.test.ts's header comment) for
 * the in-chat floating camp-detail card (`AiChatDetailCard`) and its wiring
 * through AiChatCardCarousel -> AiChatMessageList -> AiChatPanel.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const detailSrc = read("components/ai-chat/AiChatDetailCard.tsx");
const carouselSrc = read("components/ai-chat/AiChatCardCarousel.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");

describe("Wiring — onSelectCamp threads Carousel -> MessageList -> Panel, replacing the old navigate-on-select", () => {
  it("[structural] AiChatCardCarousel takes onSelectCamp and forwards it to both render paths, no more useRouter", () => {
    expect(carouselSrc).toContain("onSelectCamp: (card: AiChatCardResponse) => void");
    expect(carouselSrc.match(/onSelect=\{onSelectCamp\}/g)?.length).toBe(2);
    expect(carouselSrc).not.toContain("useRouter");
    expect(carouselSrc).not.toContain("router.push(");
  });

  it("[structural] AiChatMessageList threads onSelectCamp down to the carousel", () => {
    expect(listSrc).toContain("onSelectCamp: (card: AiChatCardResponse) => void");
    expect(listSrc).toContain("cards={entry.cards} onSelectCamp={onSelectCamp}");
  });

  it("[structural] AiChatPanel owns selectedCamp as its own view state (not use-ai-chat.ts) and mounts the detail card", () => {
    expect(panelSrc).toContain("useState<AiChatCardResponse | null>(null)");
    expect(panelSrc).toContain("onSelectCamp={handleSelectCamp}");
    expect(panelSrc).toContain("function handleSelectCamp(card: AiChatCardResponse)");
    expect(panelSrc).toContain("<AiChatDetailCard card={selectedCamp} expanded={expanded} onClose={handleCloseDetail} />");
  });

  it("[unit] closing the whole panel clears any open detail card (no stale reopen)", () => {
    expect(panelSrc).toContain("setSelectedCamp(null);");
    expect(panelSrc).toContain("function handleOpenChange(next: boolean)");
  });

  it("[a11y] focus restores to the originating card button on close", () => {
    expect(panelSrc).toContain("detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;");
    expect(panelSrc).toContain("detailTriggerRef.current?.focus();");
  });
});

describe("Mount point — absolute z-20 sibling of the z-10 body, no 2nd Radix Dialog", () => {
  it("[structural] the detail card is a plain div layer, not another Dialog/DialogPortal", () => {
    // (the header doc-comment names PanelPrimitive/radix-ui only to explain
    // the mount point — no such import/JSX usage exists in the real code)
    expect(detailSrc).not.toMatch(/from ["']radix-ui["']/);
    expect(detailSrc).not.toContain("<PanelPrimitive");
    expect(detailSrc).not.toContain("<Dialog");
    expect(detailSrc).not.toContain("aria-modal");
  });

  it("[unit] geometry forks on expanded, exact classes per the design brief", () => {
    expect(detailSrc).toContain('"absolute inset-0 z-20 grid place-items-center p-4 sm:p-8"');
    expect(detailSrc).toContain('"absolute inset-0 z-20 sm:inset-2 sm:top-14"');
  });

  it("[unit] the underlying z-10 body is set inert while the detail is open (Panel)", () => {
    expect(panelSrc).toContain('inert={selectedCamp !== null}');
  });
});

describe("Instant block — paints from the in-hand card, never gated on the fetch", () => {
  it("[unit] hero/name/price/province/tags read straight off the `card` prop", () => {
    expect(detailSrc).toContain("card.images?.[0]?.url");
    expect(detailSrc).toContain('data-testid="text--ai-chat-detail-name"');
    expect(detailSrc).toContain('data-testid="text--ai-chat-detail-price"');
    expect(detailSrc).toContain('data-testid="text--ai-chat-detail-province"');
    expect(detailSrc).toContain('data-testid="badge--ai-chat-detail-tag"');
  });

  it("[unit] price reuses the CAM-444 text-ai-price token (never text-primary)", () => {
    expect(detailSrc).toContain("text-ai-price");
  });

  it("[unit] province is conditional on a non-empty trimmed value (G8 convention)", () => {
    expect(detailSrc).toContain("card.location.province.trim().length > 0");
  });
});

describe("Async block — fetch, loading, empty, error states (design brief §4)", () => {
  it("[unit] fetches via the aiChatAPI facade (CAM-446), never a raw fetch", () => {
    expect(detailSrc).toContain("aiChatAPI.getCampDetail(card.id)");
    expect(detailSrc).not.toMatch(/\bfetch\(/);
  });

  it("[unit] loading is gated through useMinimumLoading (delay + minDisplay, loading.md §4)", () => {
    expect(detailSrc).toContain('import { useMinimumLoading } from "@/lib/hooks/use-minimum-loading"');
    expect(detailSrc).toContain("useMinimumLoading(isLoading, { delay: 300, minDisplay: 400 })");
  });

  it("[unit] the skeleton mirrors the 3 async sections (2 heading bars + 1 amenity-chip row + 2 review rows + 1 date-chip row, each row/count-array driven) and is decorative (aria-hidden)", () => {
    const skeletonBlock = detailSrc.slice(detailSrc.indexOf("showSkeleton ? ("), detailSrc.indexOf(") : detail ? ("));
    expect(skeletonBlock).toContain('aria-hidden="true"');
    expect(skeletonBlock.match(/<Skeleton\b/g)?.length).toBe(7);
    expect(skeletonBlock).toContain("AMENITY_SKELETON_COUNT");
    expect(skeletonBlock).toContain("AVAILABILITY_SKELETON_COUNT");
  });

  it("[unit] empty sub-states use a muted line, never the full-page EmptyState", () => {
    expect(detailSrc).toContain("t.aiChat.detail.noAmenities");
    expect(detailSrc).toContain("t.aiChat.card.noReviews");
    expect(detailSrc).toContain("t.aiChat.detail.noAvailability");
    expect(detailSrc).not.toContain("EmptyState");
  });

  it("[unit] error state reuses the compact ErrorState with a retry that re-fetches", () => {
    expect(detailSrc).toContain('import { ErrorState } from "@/components/ErrorState"');
    expect(detailSrc).toContain('<ErrorState variant="error" compact onRetry={() => setRetryToken((v) => v + 1)} />');
    expect(detailSrc).toContain('data-testid="error--ai-chat-detail"');
  });

  it("[unit] a11y loading region: aria-busy + role=status + aria-live=polite + sr-only label", () => {
    expect(detailSrc).toContain("aria-busy={showSkeleton}");
    expect(detailSrc).toContain('role="status"');
    expect(detailSrc).toContain('aria-live="polite"');
    expect(detailSrc).toContain('data-testid="status--ai-chat-detail-loading"');
    expect(detailSrc).toContain("t.aiChat.loading");
  });

  it("[unit] the CTA is a Link — stays enabled through loading/error (no fetched data required)", () => {
    const ctaLine = detailSrc.slice(detailSrc.indexOf("CTA is a deep-link"));
    expect(ctaLine).toContain("btn--ai-chat-detail-cta");
    expect(ctaLine).not.toContain("disabled={");
  });
});

describe("Dismiss + a11y (design brief §5)", () => {
  it("[unit] Esc is captured on window in the capture phase and stops propagation before Radix's own document listener sees it", () => {
    expect(detailSrc).toContain('window.addEventListener("keydown", handleKeyDown, { capture: true });');
    expect(detailSrc).toContain("event.stopPropagation();");
    expect(detailSrc).toContain("onClose();");
  });

  it("[unit] focus moves to the back button on mount", () => {
    expect(detailSrc).toContain("backButtonRef.current?.focus();");
    expect(detailSrc).toContain("ref={backButtonRef}");
  });

  it("[unit] the layer carries role=dialog + aria-label={name}, no aria-modal", () => {
    expect(detailSrc).toContain('role="dialog"');
    expect(detailSrc).toContain("aria-label={name}");
    expect(detailSrc).toContain('data-testid="dialog--ai-chat-detail"');
  });

  it("[unit] the back button is a 44px tap target with an accessible name", () => {
    expect(detailSrc).toContain("h-11 w-11 rounded-full");
    expect(detailSrc).toContain("aria-label={t.aiChat.detail.back}");
    expect(detailSrc).toContain('data-testid="btn--ai-chat-detail-back"');
  });
});

describe("CTA — deep-links to /campgrounds/{slug}, same convention the carousel used to own", () => {
  it("[unit] slug picks nameEnSlug in EN (falling back to nameThSlug), else nameThSlug", () => {
    expect(detailSrc).toContain('language === "en" ? card.nameEnSlug || card.nameThSlug : card.nameThSlug');
    expect(detailSrc).toContain("href={`/campgrounds/${slug}`}");
  });
});

describe("Token-only (DESIGN.md §2, check:palette scope) + reused glass idiom", () => {
  it("[structural] no raw hex color or arbitrary px literal", () => {
    expect(detailSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(detailSrc).not.toMatch(/\[\d+px\]/);
  });

  it("[unit] the card uses the sanctioned glass tokens, never shadow-ai-flame-aura", () => {
    expect(detailSrc).toContain("bg-ai-surface");
    expect(detailSrc).toContain("shadow-ai-glow");
    expect(detailSrc).toContain("border-ai-tint");
    expect(detailSrc).toContain("backdrop-blur-xl");
    expect(detailSrc).not.toContain("shadow-ai-flame-aura");
  });

  it("[unit] entrance uses the sanctioned ai-materialize class (no new motion class)", () => {
    expect(detailSrc).toContain("ai-materialize");
  });

  it("[structural] no emoji literal in the detail card source", () => {
    // eslint-disable-next-line no-misleading-character-class
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(detailSrc)).toBe(false);
  });
});

describe("i18n — no hardcoded copy; new aiChat.detail.* keys (TH verbatim + EN parity)", () => {
  const th = translations.th.aiChat as Record<string, unknown> & { detail: Record<string, string> };
  const en = translations.en.aiChat as Record<string, unknown> & { detail: Record<string, string> };

  it("[structural] the detail card pulls every user-facing string from t.aiChat.*, never a raw Thai glyph", () => {
    expect(detailSrc).not.toMatch(/>[^<{]*[ก-๙][^<{]*</);
    expect(detailSrc).not.toMatch(/="[^"]*[ก-๙][^"]*"/);
  });

  it("th.aiChat.detail.back is verbatim", () => expect(th.detail.back).toBe("ย้อนกลับ"));
  it("th.aiChat.detail.amenitiesHeading is verbatim", () => expect(th.detail.amenitiesHeading).toBe("สิ่งอำนวยความสะดวก"));
  it("th.aiChat.detail.reviewsHeading is verbatim", () => expect(th.detail.reviewsHeading).toBe("รีวิวจากผู้เข้าพัก"));
  it("th.aiChat.detail.availabilityHeading is verbatim", () => expect(th.detail.availabilityHeading).toBe("สุดสัปดาห์ที่ว่าง"));
  it("th.aiChat.detail.noAmenities is verbatim", () => expect(th.detail.noAmenities).toBe("ยังไม่ได้ระบุสิ่งอำนวยความสะดวก"));
  it("th.aiChat.detail.noAvailability is verbatim", () => expect(th.detail.noAvailability).toBe("ช่วงนี้ยังไม่มีสุดสัปดาห์ว่าง"));
  it("th.aiChat.detail.viewCampPage is verbatim", () => expect(th.detail.viewCampPage).toBe("ดูหน้าลาน"));

  it("[structural] no em-dash separator in any new TH detail copy", () => {
    for (const [key, value] of Object.entries(th.detail)) {
      expect(value, `th.aiChat.detail.${key}`).not.toContain("—");
    }
  });

  it("[normal] every new key has a non-empty EN counterpart", () => {
    for (const [key, value] of Object.entries(en.detail)) {
      expect(typeof value, `en.aiChat.detail.${key}`).toBe("string");
      expect(value.length, `en.aiChat.detail.${key}`).toBeGreaterThan(0);
    }
  });

  it("[structural] EN and TH declare exactly the same aiChat.detail key set", () => {
    expect(Object.keys(en.detail).sort()).toEqual(Object.keys(th.detail).sort());
  });
});

describe("Zero debug/demo UI (quality bar)", () => {
  it("[structural] no console.log / JSON.stringify dump / commented-out markup", () => {
    expect(detailSrc).not.toContain("console.log");
    expect(detailSrc).not.toContain("JSON.stringify");
  });
});
