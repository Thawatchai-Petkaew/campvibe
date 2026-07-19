/**
 * cam-442-autoscroll-spinner.test.ts — CAM-442 (R3 owner feedback)
 *
 * Source-inspection coverage (this repo's Vitest config runs `environment:
 * 'node'` with no jsdom — see cam-272-ai-chat-components.test.ts's header
 * note). Two fixes, both scoped to components/ai-chat/AiChatPanel.tsx:
 *  1. Auto-scroll — the thread now follows the newest turn.
 *  2. Send spinner — Loader2 replaces the invisible LoadingSpinner.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const panelSrc = readFileSync(resolve(__dirname, "..", "components/ai-chat/AiChatPanel.tsx"), "utf-8");

describe("CAM-442 AC-1/AC-3/BR-1/BR-2 — auto-scroll wiring", () => {
  it("[unit/Prove-It] BR-1: a wrapper ref sits on the existing flex column holding <ScrollArea> (no new wrapper element) and resolves Radix's real viewport via querySelector", () => {
    expect(panelSrc).toContain("scrollWrapperRef");
    expect(panelSrc).toContain('<div ref={scrollWrapperRef} className="mx-auto flex w-full min-h-0 flex-1 flex-col">');
    expect(panelSrc).toContain('querySelector<HTMLElement>("[data-radix-scroll-area-viewport]")');
  });

  it("[structural] components/ui/scroll-area.tsx (the shared primitive) is never edited by this fix — no import of its internals beyond the existing ScrollArea component", () => {
    expect(panelSrc).toContain('import { ScrollArea } from "@/components/ui/scroll-area"');
  });

  it("[unit] BR-2: stickToBottomRef defaults true and a scroll listener flips it based on the ~120px near-bottom threshold", () => {
    expect(panelSrc).toContain("const stickToBottomRef = useRef(true)");
    expect(panelSrc).toContain("viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120");
    expect(panelSrc).toContain('viewport.addEventListener("scroll", handleScroll, { passive: true })');
  });

  it("[unit/Prove-It] BR-3/AC-1/EC-1: handleSend and handleSuggestion both force stickToBottomRef back to true before sending — camper-initiated send always jumps to the newest turn", () => {
    const sendBlock = panelSrc.slice(panelSrc.indexOf("function handleSend()"), panelSrc.indexOf("function toggleExpanded()"));
    expect(sendBlock).toContain("stickToBottomRef.current = true");

    const suggestionBlock = panelSrc.slice(
      panelSrc.indexOf("function handleSuggestion("),
      panelSrc.indexOf("function handleComposerKeyDown(")
    );
    expect(suggestionBlock).toContain("stickToBottomRef.current = true");
  });
});

describe("CAM-442 AC-2/AC-4/BR-4 — the follow-effect re-fires on growth + resume", () => {
  it("[unit] the auto-scroll effect depends on entries.length, sending, the last assistant text length, and resuming (AC-2 streaming growth + AC-4 restore-then-jump)", () => {
    expect(panelSrc).toContain("[entries.length, sending, lastAssistantTextLength, resuming]");
  });

  it("[unit] lastAssistantTextLength is derived from the last entry only when it's an assistant answer/streaming turn (EC-3: 0 on an empty/user-only thread, no crash)", () => {
    expect(panelSrc).toContain(
      'lastEntry && lastEntry.role === "assistant" && (lastEntry.kind === "answer" || lastEntry.kind === "streaming")'
    );
  });

  it("[unit] the scroll effect only acts while stickToBottomRef is true and defers the scrollHeight read to a requestAnimationFrame (post-commit measurement)", () => {
    expect(panelSrc).toContain("if (!stickToBottomRef.current) return;");
    expect(panelSrc).toContain("requestAnimationFrame(() => {");
    expect(panelSrc).toContain('viewport.scrollTo({ top: viewport.scrollHeight');
  });

  it("[unit/Prove-It] EC-2: the effect cleans up its pending requestAnimationFrame (guards against a stale scroll firing after unmount/re-run)", () => {
    expect(panelSrc).toContain("return () => cancelAnimationFrame(raf);");
  });
});

describe("CAM-442 BR-5 — reduced-motion scroll behavior", () => {
  it("[unit] scroll behavior checks prefers-reduced-motion live via matchMedia, not a cached value", () => {
    expect(panelSrc).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
    expect(panelSrc).toContain('behavior: reduceMotion ? "auto" : "smooth"');
  });
});

describe("CAM-442 AC-5/BR-6 — the send spinner is now visible on the button fill", () => {
  it("[unit/Prove-It] the sending branch renders Loader2 tokened text-primary-foreground (visible against bg-primary) instead of the invisible LoadingSpinner", () => {
    const sendButtonBlock = panelSrc.slice(
      panelSrc.indexOf('data-testid="btn--ai-chat-send"'),
      panelSrc.indexOf("</Button>", panelSrc.indexOf('data-testid="btn--ai-chat-send"'))
    );
    expect(sendButtonBlock).toContain(
      '<Loader2 className="size-4 animate-spin text-primary-foreground motion-reduce:animate-none" aria-hidden="true" />'
    );
    expect(sendButtonBlock).not.toContain("LoadingSpinner");
  });

  it("[structural] the LoadingSpinner import is fully removed (it was this file's only use; a doc comment naming it is fine, an import/JSX usage isn't)", () => {
    expect(panelSrc).not.toContain('from "@/components/ui/loading-spinner"');
    expect(panelSrc).not.toMatch(/<LoadingSpinner\s+\w+=/); // a real JSX usage always carries a prop; the doc comment's `<LoadingSpinner>` mention doesn't
  });

  it("[unit] Loader2 is imported from lucide-react alongside the panel's other icons (no new icon library)", () => {
    expect(panelSrc).toMatch(/import\s*\{[^}]*Loader2[^}]*\}\s*from\s*"lucide-react"/);
  });

  it("[unit] the spinner keeps the same size-4 footprint as the Send icon it replaces (no layout shift)", () => {
    expect(panelSrc).toContain('<Send className="size-4" aria-hidden="true" />');
  });
});
