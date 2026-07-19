/**
 * cam-433-loading-flame.test.ts — CAM-433
 *
 * "Loading state = animated น้องกองไฟ flame, remove visible label (keep
 * sr-only)" — owner staging feedback C. Full spec:
 * docs/specs/ai-assistant/chat-experience-overhaul/CAM-433-loading-flame/story.md
 *
 * Source-inspection coverage (this repo's Vitest config runs
 * `environment: 'node'` with no jsdom for this class of `useSession()`-gated
 * client component — established precedent: cam-425-centered-loading-and
 * -single-thread.test.ts, cam-432-fire-aura-flicker.test.ts).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const listSrc = read("components/ai-chat/AiChatMessageList.tsx");
const globalsCss = read("app/globals.css");

const resumingStart = listSrc.indexOf('data-testid="status--ai-chat-resuming"');
const resumingBlock = listSrc.slice(Math.max(0, resumingStart - 200), resumingStart + 300);

describe("AC-1/EC-1 — the centered flame flickers on its own; no generic pulse wrapper left", () => {
  it("[unit] resuming block has no motion-safe:animate-pulse wrapper div (Prove-It: present before this fix)", () => {
    expect(resumingBlock).not.toContain("motion-safe:animate-pulse");
  });

  it("[unit] AiChatAvatar size=lg is rendered directly (not nested inside an extra wrapper div), with intensity=\"loading\" (CAM-435: keeps the strong ai-flame-flicker aura on this genuinely-loading surface, now that AiChatAvatar defaults to a calmer glow elsewhere)", () => {
    expect(resumingBlock).toContain('<AiChatAvatar size="lg" intensity="loading" />');
  });
});

describe("AC-2/AC-3 — the flicker/glow is AiChatAvatar's own (CAM-432), untouched here", () => {
  it("[unit] AiChatMessageList does not redeclare any @keyframes / animation CSS itself (only doc-comments may name ai-flame-flicker for traceability)", () => {
    expect(listSrc).not.toContain("@keyframes");
    expect(listSrc).not.toMatch(/className="[^"]*ai-flame-flicker[^"]*"/);
  });

  it("[unit] globals.css still gates the flicker to motion-safe and turns it off under reduce-motion (unchanged dependency)", () => {
    const motionSafeBlock = globalsCss.slice(
      globalsCss.lastIndexOf("@media (prefers-reduced-motion: no-preference)"),
      globalsCss.indexOf("@keyframes ai-aurora-drift")
    );
    expect(motionSafeBlock).toContain(".ai-flame-flicker {");
    const reduceBlock = globalsCss.slice(globalsCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduceBlock).toContain(".ai-flame-flicker");
    expect(reduceBlock).toContain("animation: none;");
  });
});

describe("AC-4/EC-2/BR-2 — the visible label is gone; sr-only + a11y contract kept", () => {
  it("[unit] no visible <span>{t.aiChat.loading}</span> text node remains (label is sr-only now)", () => {
    expect(resumingBlock).not.toMatch(/<span>\{t\.aiChat\.loading\}<\/span>/);
  });

  it("[unit] the loading label survives as an sr-only span with the same t.aiChat.loading string", () => {
    expect(resumingBlock).toContain('<span className="sr-only">{t.aiChat.loading}</span>');
  });

  it("[unit] role=status + aria-live=polite + aria-busy={resuming} are all still present", () => {
    const block = listSrc.slice(Math.max(0, resumingStart - 200), resumingStart + 50);
    expect(block).toContain('role="status"');
    expect(block).toContain('aria-live="polite"');
    expect(block).toContain("aria-busy={resuming}");
  });
});

describe("AC-5 — still centered (CAM-425 not regressed)", () => {
  it("[unit] the overlay keeps absolute inset-0 + items-center + justify-center", () => {
    expect(resumingBlock).toContain("absolute inset-0 flex flex-col items-center justify-center");
  });
});

describe("Standing rules — no emoji, token-only (design gate)", () => {
  it("[structural] no emoji literal in the touched file", () => {
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(listSrc)).toBe(false);
  });

  it("[structural] token-only: no stray hex/px literal introduced in the resuming block", () => {
    expect(resumingBlock).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(resumingBlock).not.toMatch(/\[\d+px\]/);
  });
});
