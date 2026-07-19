/**
 * cam-425-centered-loading-and-single-thread.test.ts — CAM-425 "Chat loading
 * is centered + the assistant stays a single thread".
 *
 * Both `AiChatMessageList.tsx` and `AiChatPanel.tsx` are `useSession()`-gated
 * client components with no jsdom/RTL harness in this repo for this class of
 * component (established precedent: __tests__/cam-397-live-session-gate.test.ts,
 * __tests__/cam-423-ui-resume.test.ts) — source-inspection Prove-It tests.
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────
 * AC-1/BR-1/BR-2/BR-4   resuming indicator is centered (absolute overlay,
 *                       items-center + justify-center), uses AiChatAvatar
 *                       size="lg" + motion-safe pulse, a11y unchanged
 * AC-2/BR-3             the new-chat button is gone from the panel header
 *                       (Prove-It: red against the pre-fix source, green now)
 * AC-3/BR-2             the pulse class is motion-safe-scoped
 * ─────────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const listSrc = read("components/ai-chat/AiChatMessageList.tsx");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const useAiChatSrc = read("components/ai-chat/use-ai-chat.ts");
const scrollAreaSrc = read("components/ui/scroll-area.tsx");

describe("AC-1/BR-1 — the resuming indicator is centered, not pinned top-left", () => {
  it("[unit] the resuming branch is an absolute overlay centered with items-center + justify-center", () => {
    const start = listSrc.indexOf('data-testid="status--ai-chat-resuming"');
    expect(start).toBeGreaterThan(-1);
    const block = listSrc.slice(Math.max(0, start - 400), start + 200);
    expect(block).toContain("absolute inset-0");
    expect(block).toContain("items-center");
    expect(block).toContain("justify-center");
  });

  it("[unit] no longer uses the old top-left row layout (flex items-center gap-2 py-2) for the resuming region", () => {
    const start = listSrc.indexOf('data-testid="status--ai-chat-resuming"');
    const block = listSrc.slice(Math.max(0, start - 400), start + 200);
    expect(block).not.toContain("flex items-center gap-2 py-2");
  });

  // QA gap close: BR-1's centering claim depends structurally on the
  // ScrollArea Root carrying `position: relative` (components/ui/scroll-area.tsx,
  // untouched by this diff) — the shipped suite never pinned that load-bearing
  // dependency. If a future refactor drops it, `absolute inset-0` would resolve
  // against a further-up positioned ancestor and silently break centering with
  // no test catching it.
  it("[unit] the shared ScrollArea Root the overlay centers against still carries position:relative (BR-1's load-bearing dependency, CAM-407)", () => {
    expect(scrollAreaSrc).toContain('className={cn("relative", className)}');
  });
});

describe("AC-1/BR-2 — on-brand treatment: AiChatAvatar renders directly, no new component", () => {
  // CAM-433 (owner staging feedback C, SUPERSEDES this row's original claim):
  // the generic motion-safe:animate-pulse wrapper is gone — AiChatAvatar's
  // OWN ai-flame-flicker/ai-flame-glow (CAM-432) now supplies the on-brand
  // motion directly. See cam-433-loading-flame.test.ts for the full AC set.
  it("[unit] resuming block renders AiChatAvatar size=lg directly (no wrapper div), intensity=\"loading\" (CAM-435: keeps the strong flicker on this genuinely-loading surface)", () => {
    const start = listSrc.indexOf('data-testid="status--ai-chat-resuming"');
    const block = listSrc.slice(start, start + 300);
    expect(block).toContain('<AiChatAvatar size="lg" intensity="loading" />');
  });

  it("[unit] reuses the existing aiChat.loading label — no new locale key (now sr-only, CAM-433)", () => {
    expect(listSrc).toContain("{t.aiChat.loading}");
  });
});

describe("AC-1/BR-4/AC-3 — a11y contract unchanged; label is sr-only (CAM-433)", () => {
  it("[unit] the resuming region keeps role=status + aria-live=polite + aria-busy={resuming}", () => {
    const start = listSrc.indexOf('data-testid="status--ai-chat-resuming"');
    const block = listSrc.slice(Math.max(0, start - 200), start + 50);
    expect(block).toContain('role="status"');
    expect(block).toContain('aria-live="polite"');
    expect(block).toContain("aria-busy={resuming}");
  });

  it("[unit] the loading label is sr-only (CAM-433 removed the visible caption, kept the a11y announcement)", () => {
    const start = listSrc.indexOf('data-testid="status--ai-chat-resuming"');
    const block = listSrc.slice(start, start + 300);
    expect(block).toContain('<span className="sr-only">{t.aiChat.loading}</span>');
  });
});

describe("AC-2/BR-3 — the '+' new-chat button is removed from the panel header (single-thread)", () => {
  // Prove-It (manually verified, not git-encoded to keep this test stable
  // post-commit): before the fix, `panelSrc` contained
  // `data-testid="btn--ai-chat-new"` and imported `MessageSquarePlus` — both
  // assertions below FAILED against the pre-fix source and pass now.
  it("[unit] no btn--ai-chat-new testid anywhere in the current panel source", () => {
    expect(panelSrc).not.toContain('data-testid="btn--ai-chat-new"');
  });

  it("[unit] no MessageSquarePlus import/usage left (dead icon removed with the button)", () => {
    expect(panelSrc).not.toMatch(/MessageSquarePlus/);
  });

  it("[unit] the Close button is still present and still works the same way", () => {
    expect(panelSrc).toContain('data-testid="btn--ai-chat-close"');
    // CAM-412: routes through the handleOpenChange wrapper (aborts an
    // in-flight stream on close) instead of calling the prop directly — the
    // wrapper still drives the SAME onOpenChange prop underneath.
    expect(panelSrc).toContain("onClick={() => handleOpenChange(false)}");
  });

  it("[unit] the panel no longer destructures isAuthenticated/startNewChat from useAiChat (unused-var clean)", () => {
    const destructureLine = panelSrc.split("\n").find((l) => l.includes("= useAiChat();"));
    expect(destructureLine).toBeDefined();
    expect(destructureLine).not.toContain("isAuthenticated");
    expect(destructureLine).not.toContain("startNewChat");
  });
});

describe("BR-3 — startNewChat stays in the hook, exported-but-unreferenced (future conversation switcher)", () => {
  it("[unit] use-ai-chat.ts still exports/implements startNewChat unchanged", () => {
    expect(useAiChatSrc).toContain("const startNewChat = useCallback(() => {");
    expect(useAiChatSrc).toContain("conversationIdRef.current = undefined;");
    expect(useAiChatSrc).toContain("startNewChat,");
  });
});
