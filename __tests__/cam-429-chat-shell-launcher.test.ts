/**
 * cam-429-chat-shell-launcher.test.ts — CAM-429 (owner staging feedback:
 * no background dim, expand-to-full-page, FAB collision, campfire aura).
 *
 * Source-inspection coverage — this repo's Vitest config runs
 * `environment: 'node'` with no jsdom (see cam-272-ai-chat-components.test.ts
 * for the established convention); rendered-DOM behaviour is proven by
 * reading the shipped source for the exact wiring the AC/BR/EC rows require.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const launcherSrc = read("components/ai-chat/AiChatLauncher.tsx");
const fabSrc = read("components/HostOnboardingFab.tsx");

describe("AC-1 — no background dim, dismiss/a11y untouched", () => {
  it("[unit] DialogOverlay renders bg-transparent, kept in the tree (not removed)", () => {
    expect(panelSrc).toContain('<DialogOverlay className="bg-transparent" />');
  });

  it("[structural] no dismiss override disables Radix's native Esc/outside-dismiss/focus-trap (unchanged from CAM-272)", () => {
    expect(panelSrc).not.toContain("onEscapeKeyDown");
    expect(panelSrc).not.toContain("onPointerDownOutside");
    expect(panelSrc).not.toContain("onInteractOutside");
  });

  it("[unit] the panel aria-label + onOpenAutoFocus wiring is unchanged", () => {
    expect(panelSrc).toContain("aria-label={`${t.aiChat.name} ${t.aiChat.role}`}");
    expect(panelSrc).toContain("onOpenAutoFocus={(e) => {");
  });
});

describe("AC-2/AC-3/AC-4/BR-3/BR-4 — expand-to-full-page toggle", () => {
  it("[unit] a Maximize2/Minimize2 header toggle exists, aria-labelled, wired to toggleExpanded", () => {
    expect(panelSrc).toContain('import { Maximize2, Minimize2, Send, X } from "lucide-react"');
    expect(panelSrc).toContain('data-testid="btn--ai-chat-expand-toggle"');
    expect(panelSrc).toContain("aria-label={expanded ? t.aiChat.collapse : t.aiChat.expand}");
    expect(panelSrc).toContain("onClick={toggleExpanded}");
    expect(panelSrc).toContain("<Minimize2 className=");
    expect(panelSrc).toContain("<Maximize2 className=");
  });

  it("[unit] the Content className switches between the expanded variant and the collapsed bottom-sheet/anchored-card variant (CAM-431 supersedes the near-full-page geometry with true fullscreen: inset-0, no card frame)", () => {
    expect(panelSrc).toContain("inset-0 duration-200");
    expect(panelSrc).not.toContain("inset-2 rounded-3xl border border-border/60");
    expect(panelSrc).not.toContain("sm:inset-6");
    // the collapsed (CAM-407) sizing is preserved byte-identical
    expect(panelSrc).toContain("sm:h-[min(37.5rem,80dvh)]");
    expect(panelSrc).toContain("sm:w-96");
    expect(panelSrc).toContain("h-[85dvh] max-h-[85dvh]");
  });

  it("[unit] the collapsed desktop anchor resets from sm:bottom-24 to sm:bottom-6 (matches AiChatLauncher's own reset, item 3)", () => {
    expect(panelSrc).toContain("sm:right-6 sm:bottom-6 sm:h-[min(37.5rem,80dvh)]");
    // the old anchor may survive only in a traceability doc-comment, never as the live class literal
    expect(panelSrc).not.toContain("sm:right-6 sm:bottom-24 sm:h-[min(37.5rem,80dvh)]");
  });

  it("[unit] toggleExpanded flips state and persists to sessionStorage on every toggle", () => {
    expect(panelSrc).toContain("function toggleExpanded() {");
    expect(panelSrc).toContain("writeExpandedToStorage(next);");
  });

  it("[unit] BR-3: sessionStorage read/write never throw (privacy-mode/quota safe, EC-2)", () => {
    expect(panelSrc).toContain('window.sessionStorage.getItem(EXPANDED_STORAGE_KEY) === "1"');
    expect(panelSrc).toContain("} catch {\n    return false;\n  }");
    expect(panelSrc).toContain('window.sessionStorage.setItem(EXPANDED_STORAGE_KEY, value ? "1" : "0");');
  });

  it("[unit] BR-4: the useAiChat destructure is unchanged — expand/collapse never remounts the conversation", () => {
    expect(panelSrc).toContain(
      "const { entries, sending, disabled, resuming, sendMessage, retryLast } = useAiChat();"
    );
    // CAM-431 nests the scroll region one level deeper (centered max-w column);
    // CAM-436 adds one more wrapper div around the list inside ScrollArea
    // (full-width scrollbar-to-edge restructure) — indentation shifts +2 again.
    expect(panelSrc).toContain('<AiChatMessageList\n                    entries={entries}');
  });
});

describe("AC-5/BR-5 — FAB collision resolved by moving HostOnboardingFab left", () => {
  it("[unit] HostOnboardingFab's live wrapper div is fixed bottom-6 left-6 (moved off the right side)", () => {
    // the old position may survive only in a traceability doc-comment, never as a live className
    expect(fabSrc).toContain('<div className="fixed bottom-6 left-6 z-50">');
    expect(fabSrc).not.toContain('className="fixed bottom-6 right-6 z-50"');
  });

  it("[unit] AiChatLauncher's live wrapper div sits at bottom-10 right-6 (CAM-432 reposition, no live bottom-24/bottom-6 className)", () => {
    // the old offsets may survive only in a traceability doc-comment, never as a live className
    expect(launcherSrc).toContain('<div className="fixed bottom-10 right-6 z-50">');
    expect(launcherSrc).not.toMatch(/className="[^"]*bottom-24[^"]*"/);
    expect(launcherSrc).not.toMatch(/className="fixed bottom-6 right-6 z-50"/);
  });
});

describe("AC-6/BR-6 — campfire aura reuses only already-sanctioned §2.1 primitives", () => {
  it("[unit] CAM-432: the launcher button is fire-toned (bg-ai-ember tint, not teal bg-primary/shadow-ai-glow)", () => {
    expect(launcherSrc).toContain("bg-ai-ember/10 hover:bg-ai-ember/20");
    // the old shadow-ai-glow may survive only in a traceability doc-comment, never as a live className
    expect(launcherSrc).not.toMatch(/className="[^"]*shadow-ai-glow[^"]*"/);
  });

  it("[unit] the flame reuses the AiChatAvatar idiom: text-ai-ember + fill-current + ai-flame-glow", () => {
    expect(launcherSrc).toContain("ai-flame-glow size-5 fill-current text-ai-ember");
  });

  it("[unit] CAM-432/CAM-435: a visible fire-toned aura halo span (shadow-ai-flame-aura + the calm ai-flame-glow pulse, R2 supersedes the CAM-432 flicker for this persistent FAB) sits behind the FAB, aria-hidden + pointer-events-none + -z-10", () => {
    expect(launcherSrc).toMatch(
      /aria-hidden="true"\s*\n\s*className="pointer-events-none absolute inset-0 -z-10 rounded-full shadow-ai-flame-aura ai-flame-glow"/
    );
  });

  it("[unit] two decorative ember/firefly <span> dots still exist, aria-hidden + pointer-events-none, motion-safe/reduce gated", () => {
    // count only the live <span aria-hidden="true" ...> elements (excludes the prose doc-comment above them)
    const spanBlocks = launcherSrc.match(/<span\b[\s\S]*?\/>/g) || [];
    expect(spanBlocks.length).toBe(3); // CAM-432: aura halo + the 2 pre-existing dots
    const dotSpans = spanBlocks.filter((s) => s.includes("animate-pulse"));
    expect(dotSpans.length).toBe(2);
    for (const span of spanBlocks) {
      expect(span).toContain('aria-hidden="true"');
      expect(span).toContain("pointer-events-none");
    }
    for (const span of dotSpans) {
      expect(span).toMatch(/motion-safe:animate-pulse motion-reduce:animate-none/);
    }
    expect(dotSpans.some((s) => s.includes("bg-ai-ember"))).toBe(true);
    expect(dotSpans.some((s) => s.includes("bg-ai-firefly"))).toBe(true);
  });

  it("[structural] no new inline keyframe/animation literal is introduced in this file — only class-name references to globals.css loops + stock Tailwind animate-pulse", () => {
    expect(launcherSrc).not.toContain("@keyframes");
    expect(launcherSrc).not.toContain("animation:");
    // every stock Tailwind animate- token in the file is one of the two allowed names
    // (ai-flame-flicker/ai-flame-glow are globals.css class names, not animate- tokens)
    const animTokens = launcherSrc.match(/\b(?:motion-safe:|motion-reduce:)?animate-[a-z-]+\b/g) || [];
    for (const token of animTokens) expect(token.endsWith("animate-pulse") || token.endsWith("animate-none")).toBe(true);
  });
});

describe("Icons/copy — lucide only, no emoji, token-only, i18n (standing rules)", () => {
  it("[structural] no emoji literal in the touched files", () => {
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const src of [panelSrc, launcherSrc, fabSrc]) expect(emojiPattern.test(src)).toBe(false);
  });

  it("[structural] token-only: no stray hex/px in the touched files", () => {
    for (const src of [panelSrc, launcherSrc, fabSrc]) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(src).not.toMatch(/\[\d+px\]/);
    }
  });

  it("[structural] no raw Thai glyph inside JSX text or an attribute literal in the touched files", () => {
    for (const src of [panelSrc, launcherSrc, fabSrc]) {
      expect(src).not.toMatch(/>[^<{]*[ก-๙][^<{]*</);
      expect(src).not.toMatch(/="[^"]*[ก-๙][^"]*"/);
    }
  });

  it("[i18n] aiChat.expand / aiChat.collapse exist TH+EN, no hardcoded copy", () => {
    expect(translations.en.aiChat.expand).toBe("Expand to full screen");
    expect(translations.en.aiChat.collapse).toBe("Exit full screen");
    expect(translations.th.aiChat.expand).toBe("ขยายเต็มจอ");
    expect(translations.th.aiChat.collapse).toBe("ย่อกลับ");
  });
});
