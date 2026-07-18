/**
 * cam-272-ai-chat-components.test.ts — CAM-272
 *
 * Source-inspection coverage for the component layer — this repo's Vitest
 * config runs `environment: 'node'` with no jsdom/@testing-library (see
 * __tests__/cam-368-photo-modal-a11y.test.ts, __tests__/cam-396-*), so
 * rendered-DOM behaviour is proven by reading the shipped source for the
 * exact wiring the AC/BR/EC rows require. Pure logic already gets REAL unit
 * coverage in cam-272-ai-chat-conversation.test.ts.
 *
 * Design Gate items asserted here: token-only (no invented component),
 * lucide-only icons (no emoji), reduced-motion, a11y wiring, security
 * (BR-4 Critical: no dangerouslySetInnerHTML/markdown anywhere in the
 * feature), i18n (no hardcoded Thai/EN string), test-id convention, and the
 * lazy-load / FAB-collision seams called out in design.md.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const launcherSrc = read("components/ai-chat/AiChatLauncher.tsx");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");
const cardSrc = read("components/ai-chat/AiChatCampCard.tsx");
const conversationSrc = read("components/ai-chat/conversation.ts");
const useAiChatSrc = read("components/ai-chat/use-ai-chat.ts");
const campgroundCardSrc = read("components/CampgroundCard.tsx");
const apiClientSrc = read("lib/api-client.ts");
const pageSrc = read("app/page.tsx");

const ALL_FEATURE_SRC = [launcherSrc, panelSrc, listSrc, cardSrc, conversationSrc, useAiChatSrc];

describe("BR-4 (Critical/security) — the answer is ALWAYS plain text, never HTML", () => {
  it("[security] no file in the feature actually USES the dangerouslySetInnerHTML prop (a doc comment naming it is fine)", () => {
    for (const src of ALL_FEATURE_SRC) expect(src).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });

  it("[security] no markdown-to-HTML library is imported anywhere in the feature", () => {
    for (const src of ALL_FEATURE_SRC) {
      expect(src).not.toMatch(/from ["'](marked|markdown-it|react-markdown)/);
    }
  });

  it("[unit] the assistant answer renders through whitespace-pre-wrap (a text node, not markup)", () => {
    expect(listSrc).toContain("whitespace-pre-wrap");
    expect(listSrc).toContain("{entry.text}");
  });

  it("[unit] EC-6: cards render only from entry.cards — never parsed out of entry.text", () => {
    expect(listSrc).toContain("entry.cards.map");
    expect(listSrc).not.toMatch(/entry\.text\.(match|split|includes)\(.*card/i);
  });
});

describe("BR-1 — the launcher always renders on Home, including when the assistant is disabled", () => {
  it("[structural] no conditional hides the launcher itself (it is not gated on any disabled flag)", () => {
    expect(launcherSrc).not.toMatch(/if\s*\(.*disabled.*\)\s*return null/);
  });

  it("[unit] launcher has the aria-label + data-testid from design.md", () => {
    expect(launcherSrc).toContain("t.aiChat.launcherLabel");
    expect(launcherSrc).toContain('data-testid="btn--ai-chat-launcher"');
  });

  it("[structural] app/page.tsx mounts the launcher unconditionally on Home", () => {
    expect(pageSrc).toContain("<AiChatLauncher");
    expect(pageSrc).not.toMatch(/\{.*&&\s*<AiChatLauncher/);
  });

  it("[structural] design.md seam: offset avoids the HostOnboardingFab collision without editing that file", () => {
    expect(launcherSrc).toContain("bottom-24 right-6");
  });
});

describe("BR-2 — welcome/empty state (AC-1)", () => {
  it("[unit] shown only when the thread has no entries", () => {
    expect(listSrc).toContain("entries.length === 0");
    expect(listSrc).toContain('data-testid="empty--ai-chat-welcome"');
  });

  it("[unit] renders exactly the 3 documented suggestion keys", () => {
    expect(listSrc).toContain('"suggestion1", "suggestion2", "suggestion3"');
  });

  it("[unit] tapping a pill sends it as the user message (no request on open)", () => {
    expect(listSrc).toContain("onClick={() => onSuggestion(t.aiChat[key])}");
    expect(panelSrc).toContain("function handleSuggestion");
  });
});

describe("BR-3 — send disables the composer + shows an inline typing indicator, never a skeleton", () => {
  it("[unit] the composer + send button are disabled while sending", () => {
    expect(panelSrc).toContain("disabled={sending || disabled}");
    expect(panelSrc).toContain("disabled={!canSend}");
    expect(panelSrc).toContain("!sending && !disabled");
  });

  it("[unit] the send button shows an inline spinner while sending (not a skeleton)", () => {
    expect(panelSrc).toContain("sending ? (");
    expect(panelSrc).toContain("<LoadingSpinner");
    expect(panelSrc).not.toContain("Skeleton");
  });

  it("[unit] the typing indicator is gated on sending and carries the typing test id", () => {
    expect(listSrc).toContain('data-testid="status--ai-chat-typing"');
    expect(listSrc).toContain("{sending && (");
  });

  it("[security] BR-3: the panel/hook never import the model/OpenRouter client directly", () => {
    for (const src of [panelSrc, useAiChatSrc]) {
      expect(src).not.toMatch(/from ["']@\/lib\/ai\/openrouter-client/);
      expect(src).not.toContain("OPENROUTER");
    }
  });

  it("[unit] every question is sent through the aiChatAPI facade, not a raw fetch", () => {
    expect(useAiChatSrc).toContain("aiChatAPI.send");
    expect(panelSrc).not.toMatch(/\bfetch\(/);
    expect(listSrc).not.toMatch(/\bfetch\(/);
  });
});

describe("BR-4 — the in-chat card reuses CampgroundCard (compact, no wishlist/carousel)", () => {
  it("[structural] AiChatCampCard reuses CampgroundCard — no parallel card component", () => {
    expect(cardSrc).toContain('import { CampgroundCard } from "@/components/CampgroundCard"');
    expect(cardSrc).toContain('variant="compact"');
  });

  it('[unit] CampgroundCard hides the wishlist heart when variant="compact"', () => {
    expect(campgroundCardSrc).toContain('{variant !== "compact" && (');
    expect(campgroundCardSrc).toContain('data-testid="btn--wishlist-toggle"');
  });

  it('[unit] CampgroundCard hides the carousel arrows + dots when variant="compact"', () => {
    expect(campgroundCardSrc).toContain('variant !== "compact" && imageUrls.length > 1');
  });

  it("[unit] compact is opt-in — default variant preserves existing catalog/wishlist behaviour", () => {
    expect(campgroundCardSrc).toContain('variant = "default"');
  });

  it("[unit] cards are capped by rendering whatever cards[] contains (no client-side re-slicing)", () => {
    expect(listSrc).not.toMatch(/cards\.slice\(/);
  });
});

describe("AC-3 — each in-chat card is a link to /campgrounds/{slug}, no write fires (QA gap closed)", () => {
  it("[unit] AiChatCampCard forwards nameThSlug/nameEnSlug straight through to CampgroundCard (no synthetic slug)", () => {
    expect(cardSrc).toContain("nameThSlug: card.nameThSlug");
    expect(cardSrc).toContain("nameEnSlug: card.nameEnSlug");
  });

  it("[structural] CampgroundCard's Link targets /campgrounds/{slug} (nameEnSlug in EN, nameThSlug in TH) — unmodified pre-existing behaviour, AC-3 relies on it", () => {
    expect(campgroundCardSrc).toContain('<Link href={`/campgrounds/${slug}`}');
    expect(campgroundCardSrc).toContain("language === 'en' ? (campground.nameEnSlug || campground.nameThSlug) : campground.nameThSlug");
  });

  it("[security/structural] the in-chat card mounts no mutation/write handler of its own (AiChatCampCard has no onClick/fetch/POST) — Discover-only", () => {
    expect(cardSrc).not.toMatch(/onClick|fetch\(|POST/);
  });
});

describe("BR-5 — endpoint status maps to exactly one conversation state", () => {
  it("[unit] 429 -> rate-limited, 503 -> disabled, other non-2xx -> error (lib/api-client.ts)", () => {
    expect(apiClientSrc).toContain("response.status === 429) return { kind: 'rate-limited' }");
    expect(apiClientSrc).toContain("response.status === 503) return { kind: 'disabled' }");
    expect(apiClientSrc).toContain("!response.ok) return { kind: 'error' }");
  });

  it("[unit] the rate-limited notice carries no retry button (design.md: warning tone, no retry)", () => {
    const rateLimitedBlock = listSrc.slice(
      listSrc.indexOf('entry.kind === "rate-limited"'),
      listSrc.indexOf('entry.kind === "disabled"')
    );
    expect(rateLimitedBlock).not.toContain("onRetry");
    expect(rateLimitedBlock).not.toContain("aiChat.retry");
  });

  it("[unit] the error notice DOES carry a retry button that re-sends the last question", () => {
    expect(listSrc).toContain("onClick={onRetry}");
    expect(conversationSrc).toContain("export function entriesBeforeRetry");
  });
});

describe("BR-6 — send guard on empty/whitespace input", () => {
  it("[unit] canSend gates on isSendableQuestion(draft)", () => {
    expect(panelSrc).toContain("isSendableQuestion(draft)");
  });

  it("[unit] Enter sends, Shift+Enter inserts a newline", () => {
    expect(panelSrc).toContain('e.key === "Enter" && !e.shiftKey');
  });
});

describe("BR-7 — a11y wiring", () => {
  it("[unit] the message log is role=log + aria-live=polite + aria-busy tied to sending", () => {
    expect(listSrc).toContain('role="log"');
    expect(listSrc).toContain('aria-live="polite"');
    expect(listSrc).toContain("aria-busy={sending}");
  });

  it("[unit] the panel carries an aria-label (role=dialog is native to Radix Dialog.Content)", () => {
    expect(panelSrc).toContain("aria-label={t.aiChat.title}");
  });

  it("[unit] focus moves into the composer on open (onOpenAutoFocus)", () => {
    expect(panelSrc).toContain("onOpenAutoFocus={(e) => {");
    expect(panelSrc).toContain("composerRef.current?.focus();");
  });

  it("[unit] close + send + suggestions all carry an accessible name", () => {
    expect(panelSrc).toContain("aria-label={t.aiChat.close}");
    expect(panelSrc).toContain("aria-label={t.aiChat.send}");
    expect(launcherSrc).toContain("aria-label={t.aiChat.launcherLabel}");
  });

  it("[unit] color is never the only signal — every notice pairs an icon with text", () => {
    expect(listSrc).toContain("<Clock");
    expect(listSrc).toContain("<Info");
    expect(listSrc).toContain("<AlertCircle");
  });

  it("[unit] every documented data-testid from design.md is present somewhere in the feature", () => {
    const testIds = [
      "btn--ai-chat-launcher",
      "dialog--ai-chat-panel",
      "btn--ai-chat-close",
      "log--ai-chat-messages",
      "input--ai-chat-composer",
      "btn--ai-chat-send",
      "btn--ai-chat-suggestion",
      "msg--ai-chat-user",
      "msg--ai-chat-assistant",
      "status--ai-chat-typing",
      "card--ai-chat-campsite",
      "empty--ai-chat-welcome",
      "empty--ai-chat-zero-result",
      "error--ai-chat",
      "error--ai-chat-ratelimited",
      "info--ai-chat-disabled",
    ];
    const haystack = [launcherSrc, panelSrc, listSrc].join("\n");
    for (const id of testIds) expect(haystack, id).toContain(id);
  });
});

describe("AC-8 — Esc / close / tap-scrim closes the panel + focus returns to the launcher (QA gap closed)", () => {
  it("[structural] no onEscapeKeyDown/onPointerDownOutside/onInteractOutside override disables Radix Dialog.Content's native Esc-closes + outside-dismiss + focus-restore-to-trigger", () => {
    expect(panelSrc).not.toContain("onEscapeKeyDown");
    expect(panelSrc).not.toContain("onPointerDownOutside");
    expect(panelSrc).not.toContain("onInteractOutside");
  });

  it("[unit] the close button calls onOpenChange(false) — the same controlled prop Esc/scrim-dismiss drive natively", () => {
    expect(panelSrc).toContain("onClick={() => onOpenChange(false)}");
  });

  it("[structural] only onOpenAutoFocus is overridden (to redirect initial focus into the composer, AC-1/BR-7) — onCloseAutoFocus is left to Radix's default restore-to-trigger", () => {
    expect(panelSrc).toContain("onOpenAutoFocus");
    expect(panelSrc).not.toContain("onCloseAutoFocus");
  });
});

describe("EC-7 — reduced motion disables the typing dots + launcher hover/press scale", () => {
  it("[unit] typing dots pulse only under motion-safe", () => {
    expect(listSrc).toContain("motion-safe:animate-pulse");
  });

  it("[unit] launcher hover/active scale is motion-safe only", () => {
    expect(launcherSrc).toContain("motion-safe:hover:scale-105");
    expect(launcherSrc).toContain("motion-safe:active:scale-95");
  });

  it("[unit] the panel entrance animation is disabled under motion-reduce", () => {
    expect(panelSrc).toContain("motion-reduce:data-open:animate-none");
  });
});

describe("Icons — lucide only, no emoji (standing owner rule)", () => {
  it("[structural] no emoji literal anywhere in the feature's source", () => {
    // eslint-disable-next-line no-misleading-character-class
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const src of ALL_FEATURE_SRC) expect(emojiPattern.test(src)).toBe(false);
  });

  it('[structural] every icon import comes from "lucide-react"', () => {
    for (const src of [launcherSrc, panelSrc, listSrc]) {
      const iconImports = src.match(/from ["']([^"']+)["'];?\s*$/gm) || [];
      const suspicious = iconImports.filter(
        (line) => /Icon|Sparkles|Send|X|AlertCircle|Clock|Info/.test(line) && !line.includes("lucide-react")
      );
      expect(suspicious).toEqual([]);
    }
  });
});

describe("i18n — no hardcoded copy in components (code.md §4)", () => {
  it("[structural] the panel/list/launcher pull every user-facing string from t.aiChat.*", () => {
    for (const src of [launcherSrc, panelSrc, listSrc]) {
      expect(src).not.toMatch(/>[^<{]*[ก-๙][^<{]*</); // no raw Thai glyph inside JSX text
    }
  });
});

describe("Performance (not measured) — the heavy panel is lazy, not in the Home bundle eagerly", () => {
  it("[unit] AiChatLauncher lazy-loads AiChatPanel via next/dynamic(ssr:false)", () => {
    expect(launcherSrc).toContain('import dynamic from "next/dynamic"');
    expect(launcherSrc).toContain("ssr: false");
    expect(launcherSrc).toContain('import("@/components/ai-chat/AiChatPanel")');
  });

  it("[unit] the panel only mounts after the first open (not rendered eagerly)", () => {
    expect(launcherSrc).toContain("{open && <AiChatPanel");
  });
});

describe("Data (BR-4/security) — no server/model secret ever imported client-side", () => {
  it("[security] the feature never imports Prisma or an env secret directly", () => {
    for (const src of ALL_FEATURE_SRC) {
      expect(src).not.toContain("@/lib/prisma");
      expect(src).not.toContain("process.env.OPENROUTER_API_KEY");
    }
  });
});
