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
const carouselSrc = read("components/ai-chat/AiChatCardCarousel.tsx"); // CAM-409
const avatarSrc = read("components/ai-chat/AiChatAvatar.tsx"); // CAM-411
const conversationSrc = read("components/ai-chat/conversation.ts");
const useAiChatSrc = read("components/ai-chat/use-ai-chat.ts");
const campgroundCardSrc = read("components/CampgroundCard.tsx");
const apiClientSrc = read("lib/api-client.ts");
const pageSrc = read("app/page.tsx");
const layoutSrc = read("app/layout.tsx"); // CAM-434: launcher now mounts here, not in page.tsx

const ALL_FEATURE_SRC = [launcherSrc, panelSrc, listSrc, cardSrc, carouselSrc, avatarSrc, conversationSrc, useAiChatSrc];

describe("BR-4 (Critical/security) — the answer is ALWAYS plain text, never HTML", () => {
  it("[security] no file in the feature actually USES the dangerouslySetInnerHTML prop (a doc comment naming it is fine)", () => {
    for (const src of ALL_FEATURE_SRC) expect(src).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });

  it("[security] no markdown-to-HTML library is imported anywhere in the feature", () => {
    for (const src of ALL_FEATURE_SRC) {
      expect(src).not.toMatch(/from ["'](marked|markdown-it|react-markdown)/);
    }
  });

  it("[unit/Prove-It] BR-4: the assistant answer path (post-CAM-439) renders parseAnswer(entry.text)'s output as escaped React children — never entry.text interpolated directly, never dangerouslySetInnerHTML", () => {
    // Scoped to the assistant answer row only — the USER bubble (a separate,
    // unchanged path) still renders `{entry.text}` directly and correctly;
    // this test asserts the ASSISTANT path specifically routes through the parser.
    const answerBlock = listSrc.slice(listSrc.indexOf('entry.kind === "answer"'), listSrc.indexOf('if (entry.kind === "rate-limited"'));
    expect(answerBlock).toMatch(/parseAnswer\(entry\.text\)/);
    // entry.text is never interpolated as a bare paragraph child in this block —
    // it only ever reaches the DOM through the parsed block.text/item strings.
    expect(answerBlock).not.toMatch(/>\s*\{entry\.text\}\s*<\/p>/);
    // parsed paragraph/list content still lands as a plain-text React child
    // (whitespace-pre-wrap for paragraphs, a plain <li> for items) — a text
    // node, never markup — and no dangerouslySetInnerHTML in this path.
    expect(answerBlock).toMatch(/<p key=\{i\} className="whitespace-pre-wrap">\s*\{block\.text\}\s*<\/p>/);
    expect(answerBlock).toMatch(/<li key=\{j\}>\{item\}<\/li>/);
    // (a doc comment naming dangerouslySetInnerHTML is fine — only a real USE isn't)
    expect(answerBlock).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });

  it("[unit] EC-6: cards render only from entry.cards (fed to the carousel) — never parsed out of entry.text", () => {
    // CAM-409: the map moved into AiChatCardCarousel; the list only forwards entry.cards as a prop.
    expect(listSrc).toContain("cards={entry.cards}");
    expect(carouselSrc).toContain("cards.map");
    expect(listSrc).not.toMatch(/entry\.text\.(match|split|includes)\(.*card/i);
  });
});

describe("BR-1 — the launcher always renders (root layout, every page), including when the assistant is disabled", () => {
  it("[structural] no conditional hides the launcher itself on a disabled flag (CAM-434's route-hide guard is a separate, named exception)", () => {
    expect(launcherSrc).not.toMatch(/if\s*\(.*disabled.*\)\s*return null/);
  });

  it("[unit] launcher has the aria-label + data-testid from design.md", () => {
    expect(launcherSrc).toContain("t.aiChat.launcherLabel");
    expect(launcherSrc).toContain('data-testid="btn--ai-chat-launcher"');
  });

  it("[structural] CAM-434: app/layout.tsx mounts the launcher globally; app/page.tsx no longer mounts it", () => {
    expect(layoutSrc).toContain("<AiChatLauncher");
    expect(pageSrc).not.toContain("<AiChatLauncher");
  });

  it("[structural] CAM-432: launcher sits at bottom-10 right-6 (repositioned up from CAM-429's bottom-6; the FAB collision stays resolved by HostOnboardingFab on the left)", () => {
    // the old bottom-24/bottom-6 offsets may survive only in a traceability doc-comment, never as a live className
    expect(launcherSrc).toContain('<div className="fixed bottom-10 right-6 z-50">');
    expect(launcherSrc).not.toMatch(/className="[^"]*bottom-24[^"]*"/);
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

describe("BR-4 (CAM-428 SUPERSEDES) — the in-chat card is now a DEDICATED, decoupled card — no CampgroundCard reuse", () => {
  it("[structural] AiChatCampCard no longer imports CampgroundCard (BR-4 exception, design.md §4)", () => {
    expect(cardSrc).not.toContain('from "@/components/CampgroundCard"');
    expect(cardSrc).not.toContain('variant="compact"');
  });

  it("[unit] CampgroundCard's variant=\"compact\" branches still exist untouched (out of this story's surface; now unused by AI chat, flagged for a follow-up cleanup ticket)", () => {
    expect(campgroundCardSrc).toContain('{variant !== "compact" && (');
    expect(campgroundCardSrc).toContain('variant = "default"');
  });

  it("[unit] cards are capped by rendering whatever cards[] contains (no client-side re-slicing)", () => {
    expect(listSrc).not.toMatch(/cards\.slice\(/);
    expect(carouselSrc).not.toMatch(/cards\.slice\(/);
  });

  it("[unit] CAM-428: avgRating/reviewCount are read directly on the card (no longer forwarded as CampgroundCard props)", () => {
    expect(cardSrc).toContain("card.avgRating");
    expect(cardSrc).toContain("card.reviewCount");
  });
});

describe("AC-3 (CAM-428 SUPERSEDES) — the in-chat card selects via onSelect; the carousel navigates to /campgrounds/{slug}", () => {
  it('[structural] AiChatCampCard takes an onSelect prop and calls it with the full card — no baked <Link>', () => {
    expect(cardSrc).toContain("onSelect: (card: AiChatCardResponse) => void");
    expect(cardSrc).toContain("onClick={() => onSelect(card)}");
    expect(cardSrc).not.toContain("<Link");
  });

  it("[unit] the carousel derives the slug from nameThSlug/nameEnSlug (mirrors CampgroundCard.tsx's own convention) and pushes /campgrounds/{slug}", () => {
    expect(carouselSrc).toContain('language === "en" ? card.nameEnSlug || card.nameThSlug : card.nameThSlug');
    expect(carouselSrc).toContain("router.push(`/campgrounds/${slug}`)");
  });

  it("[security/structural] the in-chat card mounts no mutation/write handler of its own — onClick navigates only, never fetch/POST", () => {
    expect(cardSrc).not.toMatch(/fetch\(|POST/);
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

  it("[unit] CAM-411: the panel aria-label composes {name} {role} (role=dialog is native to Radix Dialog.Content)", () => {
    expect(panelSrc).toContain("aria-label={`${t.aiChat.name} ${t.aiChat.role}`}");
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
    // The error notice reuses ErrorBanner (design-gate fix) — ErrorBanner
    // itself pairs an AlertCircle icon with text, so the icon lives there
    // now, not re-implemented inline in AiChatMessageList.
    expect(listSrc).toContain("<ErrorBanner");
  });

  it("[unit] design-gate fix: the error notice reuses ErrorBanner instead of re-implementing its tint inline", () => {
    expect(listSrc).toContain('import { ErrorBanner } from "@/components/ui/error-banner"');
    expect(listSrc).toContain('<ErrorBanner message={t.aiChat.error} className="rounded-2xl" data-testid="error--ai-chat" />');
    expect(listSrc).not.toContain("bg-destructive/2 border border-destructive/20");
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
      // CAM-409 — carousel chrome
      "carousel--ai-chat-cards",
      "btn--ai-chat-cards-prev",
      "btn--ai-chat-cards-next",
      "status--ai-chat-cards-position",
    ];
    const haystack = [launcherSrc, panelSrc, listSrc, carouselSrc].join("\n");
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
  it("[structural] the panel/list/launcher/carousel pull every user-facing string from t.aiChat.*", () => {
    for (const src of [launcherSrc, panelSrc, listSrc, carouselSrc]) {
      expect(src).not.toMatch(/>[^<{]*[ก-๙][^<{]*</); // no raw Thai glyph inside JSX text
      expect(src).not.toMatch(/="[^"]*[ก-๙][^"]*"/); // no raw Thai glyph inside an attribute literal
    }
  });
});

describe("CAM-407 — desktop panel keeps a fixed size + bounded scroll (G4 defect fix)", () => {
  it("[unit] desktop panel has a definite height (not auto) so the scroll region can bound itself", () => {
    // A flex item whose height comes only from flex-grow (no CSS `height`
    // length) is not a "definite size" for percentage-height descendants —
    // ScrollArea's Viewport (height:100%) silently grows to content instead
    // of scrolling. `sm:h-auto` regresses this; it must never come back.
    expect(panelSrc).not.toContain("sm:h-auto");
    expect(panelSrc).toContain("sm:h-[min(37.5rem,80dvh)]");
  });

  it("[unit] desktop panel keeps its on-scale fixed width from design.md (~384px)", () => {
    expect(panelSrc).toContain("sm:w-96");
  });

  it("[unit] header and composer never compress (shrink-0) so the scroll region is the only flexible region (CAM-431: className now forks on `expanded`, collapsed classes preserved byte-identical)", () => {
    expect(panelSrc).toContain("flex shrink-0 items-center justify-between");
    expect(panelSrc).toContain("border-b border-border/60 px-4 py-3");
    expect(panelSrc).toContain("border-t border-border/60 p-4");
  });

  it("[unit] the message scroll region is flex-1 + min-h-0 (bounded, not content-driven)", () => {
    expect(panelSrc).toContain('<ScrollArea className="min-h-0 flex-1">');
  });

  it("[unit] CAM-430 (SUPERSEDES): the answer row is w-full max-w-full now — the avatar that justified the assistant bubble's narrower cap is gone (the USER bubble keeps its own cap, unaffected)", () => {
    expect(listSrc).toContain("w-full max-w-full min-w-0 grid-cols-1 gap-3 self-start");
    // Scoped to the assistant-side answer row only — the user bubble (rendered
    // earlier in the file) intentionally keeps its own narrower chat-bubble cap.
    const answerBlock = listSrc.slice(listSrc.indexOf('entry.kind === "answer"'), listSrc.indexOf('if (entry.kind === "rate-limited"'));
    expect(answerBlock).not.toMatch(/max-w-\[85%\]/);
  });

  it("[unit] CAM-439 (SUPERSEDES CAM-426 for the answer only): the answer text is plain text on the panel glass — no bg-ai-tint bubble — while typing/rate-limited/disabled notices keep bg-ai-tint", () => {
    expect(listSrc).toContain(
      'data-testid="msg--ai-chat-assistant" className="space-y-2 text-sm leading-relaxed text-foreground"'
    );
    const answerBlock = listSrc.slice(listSrc.indexOf('entry.kind === "answer"'), listSrc.indexOf('if (entry.kind === "rate-limited"'));
    expect(answerBlock).not.toMatch(/className="[^"]*bg-ai-tint/);
  });

  it("[unit/Prove-It] AC-3: the answer row actually WIRES parseAnswer() into real <ol>/<ul> markup — not just the plain-paragraph path (would go RED if reverted to bare {entry.text})", () => {
    const answerBlock = listSrc.slice(listSrc.indexOf('entry.kind === "answer"'), listSrc.indexOf('if (entry.kind === "rate-limited"'));
    // the call that produces typed blocks from the raw answer text
    expect(answerBlock).toMatch(/parseAnswer\(entry\.text\)/);
    // both list block types are actually rendered with the canonical DS classes
    expect(answerBlock).toMatch(/<ol[^>]*className="[^"]*list-decimal[^"]*"/);
    expect(answerBlock).toMatch(/<ul[^>]*className="[^"]*list-disc[^"]*"/);
    // this is NOT the CAM-272-era bare-text path — a reverted `{entry.text}` in this
    // block (with no parseAnswer call) is exactly the regression this test guards.
    expect(answerBlock).not.toMatch(/>\s*\{entry\.text\}\s*<\/p>/);
  });

  it("[unit] CAM-409: the row uses grid-cols-1 (min-w-0), not flex-col — stops the carousel's un-shrinkable track width from forcing the row/panel wider (real bug caught by empirical measurement)", () => {
    expect(listSrc).toContain("grid w-full max-w-full min-w-0 grid-cols-1");
    expect(listSrc).not.toContain("flex w-full max-w-full flex-col");
  });

  it("[unit] CAM-409: a single in-chat card still renders w-full max-w-full (no carousel chrome, EC-1)", () => {
    expect(carouselSrc).toContain('data-testid="card--ai-chat-campsite" className="w-full max-w-full"');
  });

  it("[unit] CAM-409: carousel cards use the on-scale peek width (w-64 sm:w-60), not the full panel width", () => {
    expect(carouselSrc).toContain('data-testid="card--ai-chat-campsite" className="w-64 shrink-0 snap-start sm:w-60"');
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
