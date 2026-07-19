/**
 * cam-431-fullscreen-immersive-chat.test.ts — CAM-431 (owner staging
 * feedback: the CAM-429 `expanded` near-full-page card becomes a TRUE
 * full-screen immersive surface).
 *
 * Source-inspection coverage — this repo's Vitest config runs
 * `environment: 'node'` with no jsdom (see cam-272-ai-chat-components.test.ts
 * for the established convention); rendered-DOM behaviour is proven by
 * reading the shipped source for the exact wiring the AC/BR/EC rows require.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const panelSrc = read("components/ai-chat/AiChatPanel.tsx");

describe("AC-1/AC-2/BR-1 — expanded geometry (CAM-454 supersedes CAM-431's true-fullscreen inset-0 with an inset sliding card)", () => {
  it("[unit] CAM-454: the expanded branch is now an inset card (rounded-3xl + border), not edge-to-edge inset-0", () => {
    expect(panelSrc).toContain(
      "inset-4 rounded-3xl border border-border/60 lg:inset-y-4 lg:right-4 lg:left-24"
    );
    expect(panelSrc).not.toMatch(/expanded\s*\n\s*\?\s*"inset-0 duration-200/);
  });

  it("[unit] CAM-454: the expanded entrance slides in from the right (replaces the CAM-431 zoom-in-95)", () => {
    expect(panelSrc).toContain(
      "duration-200 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-right-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-10"
    );
    expect(panelSrc).not.toContain("data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95");
  });

  it("[structural] the old near-full-page card geometry (inset-2/sm:inset-6/rounded-3xl+border) is gone", () => {
    expect(panelSrc).not.toContain("inset-2 rounded-3xl border border-border/60");
    expect(panelSrc).not.toContain("sm:inset-6");
  });

  it("[unit] the collapsed bottom-sheet/anchored-card variant is byte-identical to CAM-407 (untouched by this story)", () => {
    expect(panelSrc).toContain("inset-x-0 bottom-0 h-[85dvh] max-h-[85dvh] rounded-t-3xl border-t border-border");
    expect(panelSrc).toContain(
      "sm:inset-x-auto sm:inset-y-auto sm:left-auto sm:top-auto sm:right-6 sm:bottom-6 sm:h-[min(37.5rem,80dvh)] sm:w-96 sm:rounded-3xl sm:border sm:border-border/60"
    );
  });

  it("[unit] the glass shell (bg-ai-surface + backdrop-blur-xl + shadow-ai-glow) still binds regardless of geometry (DESIGN.md §2.1 items 3-4)", () => {
    expect(panelSrc).toContain("bg-ai-surface shadow-ai-glow outline-none backdrop-blur-xl");
  });
});

describe("AC-3/BR-3 — reading + composing centers in a max-w column with side gutters", () => {
  it("[unit] the shared flex column has no width bound of its own (CAM-436 moved it onto the list wrapper + composer container so the ScrollArea spans full width)", () => {
    expect(panelSrc).toContain("mx-auto flex w-full min-h-0 flex-1 flex-col");
  });

  it("[unit] the message-list wrapper (inside ScrollArea) carries the centered max-w-2xl/sm:max-w-3xl column, forked on `expanded` (CAM-436)", () => {
    expect(panelSrc).toContain('cn(expanded && "mx-auto max-w-2xl px-4 sm:max-w-3xl sm:px-8")');
  });

  it("[unit] the composer container also carries the centered max-w column while expanded (CAM-436)", () => {
    expect(panelSrc).toContain("mx-auto w-full max-w-2xl px-4 pb-6 sm:max-w-3xl sm:px-8 sm:pb-10");
  });
});

describe("AC-4/AC-5/BR-4 — fullscreen composer = a floating glass dock; collapsed composer unchanged", () => {
  it("[unit] the expanded composer is a rounded-3xl glass dock with glow + a teal->sky gradient accent + a visible focus-within ring (CAM-436 supersedes the CAM-431 rounded-full pill)", () => {
    expect(panelSrc).toContain(
      "rounded-3xl border border-border/60 bg-ai-surface bg-gradient-to-r from-primary/10 via-info/10 to-transparent p-2 pl-4 shadow-ai-glow backdrop-blur-xl focus-within:ring-2 focus-within:ring-ring"
    );
  });

  it("[unit] the collapsed composer classes are byte-identical to pre-CAM-431 (border-t border-border/60 p-4)", () => {
    expect(panelSrc).toContain("border-t border-border/60 p-4");
  });

  it("[unit] the send button is unchanged", () => {
    expect(panelSrc).toContain('data-testid="btn--ai-chat-send"');
    expect(panelSrc).toContain("h-11 w-11 shrink-0 rounded-full motion-safe:active:scale-95");
  });

  it("[structural] no new --ai-* token or app/globals.css edit — gradient uses only the existing primary/info semantic tokens", () => {
    expect(panelSrc).not.toMatch(/--ai-[a-z-]+:/);
    expect(panelSrc).not.toContain("ai-gradient");
  });
});

describe("AC-6/BR-2 — header loses its border; expand/close group into a floating pill; no remount", () => {
  it("[unit] the header row drops border-b while expanded, keeps it collapsed", () => {
    expect(panelSrc).toContain("flex shrink-0 items-center justify-between");
    expect(panelSrc).toContain('expanded ? "px-4 pt-4 sm:px-8 sm:pt-6" : "border-b border-border/60 px-4 py-3"');
  });

  it("[unit] the expand/close button group becomes a rounded-full glass pill while expanded", () => {
    expect(panelSrc).toContain('expanded && "rounded-full bg-ai-surface p-1 shadow-ai-glow backdrop-blur-md"');
  });

  it("[unit] the identity cluster (avatar + name/role) is the SAME single element in both branches", () => {
    const matches = panelSrc.match(/<AiChatAvatar size="md" \/>/g) || [];
    expect(matches.length).toBe(1);
  });

  it("[unit] BR-2 no-remount: useAiChat destructure, entries, and draft wiring are each present exactly once (unconditional, not duplicated per branch)", () => {
    expect(panelSrc).toContain(
      "const { entries, sending, disabled, resuming, sendMessage, retryLast, abortActiveStream } = useAiChat();"
    );
    const entriesRefs = panelSrc.match(/entries={entries}/g) || [];
    expect(entriesRefs.length).toBe(1);
    const draftState = panelSrc.match(/const \[draft, setDraft\] = useState\(""\);/g) || [];
    expect(draftState.length).toBe(1);
  });
});

describe("Icons/copy — lucide only, no emoji, token-only, i18n (standing rules)", () => {
  it("[structural] no emoji literal", () => {
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(panelSrc)).toBe(false);
  });

  it("[structural] token-only: no stray hex/px, no off-role radius, no off-tier shadow", () => {
    expect(panelSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(panelSrc).not.toMatch(/\[\d+px\]/);
    expect(panelSrc).not.toMatch(/\brounded-(sm|md|lg)\b/);
    expect(panelSrc).not.toMatch(/\b(shadow-xl|shadow-xs|shadow-inner)\b/);
  });

  it("[structural] no new locales/ key was needed — no raw Thai glyph inside JSX text or an attribute literal", () => {
    expect(panelSrc).not.toMatch(/>[^<{]*[ก-๙][^<{]*</);
    expect(panelSrc).not.toMatch(/="[^"]*[ก-๙][^"]*"/);
  });
});
