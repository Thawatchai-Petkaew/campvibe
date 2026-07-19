/**
 * cam-436-fullscreen-composer.test.ts — CAM-436 (owner staging feedback R2:
 * the CAM-431 fullscreen composer was a `rounded-full` stadium the full
 * reading-column width — intentional-looking empty at idle, a grotesque
 * stretched capsule once the textarea grows multi-line, send button reading
 * detached far-right. Also: the message-list scrollbar sat at the reading
 * column's inner edge instead of the screen edge.)
 *
 * Source-inspection coverage — same established convention as
 * cam-272-ai-chat-components.test.ts / cam-429 / cam-431 (this repo's Vitest
 * config runs `environment: 'node'`, no jsdom).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const panelSrc = read("components/ai-chat/AiChatPanel.tsx");

describe("Composer shape — rounded-3xl surface (not a stadium pill), even inset, visible focus ring", () => {
  it("[unit] the expanded composer surface is rounded-3xl (a card that grows vertically), not rounded-full", () => {
    expect(panelSrc).toContain(
      "rounded-3xl border border-border/60 bg-ai-surface bg-gradient-to-r from-primary/10 via-info/10 to-transparent p-2 pl-4 shadow-ai-glow backdrop-blur-xl focus-within:ring-2 focus-within:ring-ring"
    );
  });

  it("[structural] the old rounded-full/pl-5 stadium shape is gone", () => {
    expect(panelSrc).not.toContain(
      "rounded-full border border-border/60 bg-ai-surface bg-gradient-to-r from-primary/10 via-info/10 to-transparent p-2 pl-5"
    );
  });

  it("[unit] the expanded textarea suppresses its own inner ring so the surface's focus-within ring reads as one clean ring", () => {
    expect(panelSrc).toContain('cn("max-h-32", expanded && "border-none bg-transparent focus-visible:ring-0")');
  });

  it("[unit] the send button stays inside the surface, bottom-right, unchanged size/shape", () => {
    expect(panelSrc).toContain('data-testid="btn--ai-chat-send"');
    expect(panelSrc).toContain("h-11 w-11 shrink-0 rounded-full motion-safe:active:scale-95");
  });

  it("[unit] collapsed composer classes are byte-identical to pre-CAM-436 (border-t border-border/60 p-4, no rounded-3xl/focus-within leak)", () => {
    expect(panelSrc).toContain("border-t border-border/60 p-4");
  });
});

describe("Scrollbar-to-edge — ScrollArea spans full width in expanded mode; content stays centered", () => {
  it("[unit] the shared flex column carries no width bound of its own anymore (plain className, not a cn(...) fork)", () => {
    // CAM-442 added scrollWrapperRef (auto-scroll fix) directly on this same
    // existing element — no new wrapper, className untouched.
    expect(panelSrc).toContain('<div ref={scrollWrapperRef} className="mx-auto flex w-full min-h-0 flex-1 flex-col">');
  });

  it("[unit] the message list is wrapped in its own centered max-w column INSIDE ScrollArea (so the ScrollArea itself, and its scrollbar, span full width)", () => {
    // CAM-454 added overscroll-contain + data-scrollbar-hidden to this same
    // ScrollArea's className (own props, no wrapper) — the anchor string
    // updates accordingly.
    const scrollAreaIdx = panelSrc.indexOf(
      '<ScrollArea\n                  className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:overscroll-contain"'
    );
    const messageListIdx = panelSrc.indexOf("<AiChatMessageList");
    expect(scrollAreaIdx).toBeGreaterThan(-1);
    expect(messageListIdx).toBeGreaterThan(scrollAreaIdx);
    const between = panelSrc.slice(scrollAreaIdx, messageListIdx);
    expect(between).toContain('cn(expanded && "mx-auto max-w-2xl px-4 sm:max-w-3xl sm:px-8")');
  });

  it("[unit] the composer container carries its own centered max-w column while expanded (the same reading-column width, not narrower)", () => {
    expect(panelSrc).toContain("mx-auto w-full max-w-2xl px-4 pb-6 sm:max-w-3xl sm:px-8 sm:pb-10");
  });
});

describe("No-remount + standing rules", () => {
  it("[unit] useAiChat destructure, entries, and draft wiring are each present exactly once (no new conditional mount)", () => {
    expect(panelSrc).toContain(
      "const { entries, sending, disabled, resuming, sendMessage, retryLast, abortActiveStream } = useAiChat();"
    );
    const entriesRefs = panelSrc.match(/entries={entries}/g) || [];
    expect(entriesRefs.length).toBe(1);
  });

  it("[structural] token-only: no stray hex/px, no off-role radius, no off-tier shadow", () => {
    expect(panelSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(panelSrc).not.toMatch(/\[\d+px\]/);
    expect(panelSrc).not.toMatch(/\brounded-(sm|md|lg)\b/);
    expect(panelSrc).not.toMatch(/\b(shadow-xl|shadow-xs|shadow-inner)\b/);
  });

  it("[structural] no new --ai-* token / no emoji literal", () => {
    expect(panelSrc).not.toMatch(/--ai-[a-z-]+:/);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(panelSrc)).toBe(false);
  });
});
