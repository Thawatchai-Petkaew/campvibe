/**
 * cam-410-chip-render.test.ts — CAM-410 FE half (AC-1/AC-2/AC-3/AC-4/AC-5/AC-6).
 *
 * Source-inspection coverage, matching this repo's existing convention for
 * the ai-chat feature (__tests__/cam-272-ai-chat-components.test.ts) — the
 * Vitest config runs `environment: 'node'` with no jsdom/@testing-library,
 * so rendered-DOM behaviour is proven by reading the shipped source for the
 * exact wiring the AC/BR/EC rows require. Server-side extraction/parse/
 * conversation-entry coverage already lives in cam-410-suggestions.test.ts;
 * this file covers ONLY the render + tap-to-send layer added on top.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const listSrc = read("components/ai-chat/AiChatMessageList.tsx");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");

describe("CAM-410 AC-1/AC-6 — chips render as a labelled, keyboard-focusable group", () => {
  it("[unit] the chip group carries role=group + the i18n aria-label (never a hardcoded string)", () => {
    expect(listSrc).toContain('role="group"');
    expect(listSrc).toContain("aria-label={t.aiChat.suggestedQuestionsLabel}");
    expect(listSrc).not.toMatch(/aria-label=\{?["']คำถามแนะนำ["']/);
  });

  it("[unit] each chip is a real <Button> (native <button>, keyboard-focusable), not a <div>/<span>", () => {
    expect(listSrc).toContain('data-testid="btn--ai-chat-suggestion-chip"');
    // reuse the shared Button primitive — no bespoke clickable element for this feature
    expect(listSrc).toMatch(/<Button[\s\S]{0,300}data-testid="btn--ai-chat-suggestion-chip"/);
  });

  it("[unit] data-testid follows the repo convention (<type>--<module>-<detail>)", () => {
    expect(listSrc).toContain('data-testid="group--ai-chat-suggestion-chips"');
  });
});

describe("CAM-410 AC-2/BR-7 — tap sends the verbatim text via the SAME path as the welcome pills", () => {
  it("[unit] a chip tap calls onSuggestion(text) — no prefix, no edit, no parallel send path", () => {
    expect(listSrc).toContain("onClick={() => onSuggestion(text)}");
  });

  it("[structural] the panel wires the identical handleSuggestion -> sendMessage path already used for welcome pills", () => {
    expect(panelSrc).toContain("function handleSuggestion");
    expect(panelSrc).toContain("<AiChatMessageList");
    expect(panelSrc).toContain("onSuggestion={handleSuggestion}");
  });
});

describe("CAM-410 AC-3/AC-5/BR-7 — chips exist ONLY under the latest, non-in-flight answer", () => {
  it("[unit] showSuggestions is computed as (not sending) AND (this is the last entry)", () => {
    expect(listSrc).toContain("showSuggestions={!sending && index === entries.length - 1}");
  });

  it("[unit] the row only reads entry.suggestions when showSuggestions is true — never for an older answer", () => {
    expect(listSrc).toContain("showSuggestions ? (entry.suggestions ?? []) : []");
  });
});

describe("CAM-410 AC-4 — no chip area when the turn produced no usable suggestions", () => {
  it("[unit] the chip group is gated on suggestions.length > 0 (renders nothing for an empty array)", () => {
    expect(listSrc).toContain("suggestions.length > 0 && (");
  });
});

describe("CAM-410 component-reuse + a11y tap target — welcome-pill visual, bumped to 44px", () => {
  it("[unit] the chip reuses the exact welcome-pill visual contract: outline / sm / rounded-full", () => {
    expect(listSrc).toMatch(/variant="outline"\s*\n\s*size="sm"\s*\n\s*className="h-11 rounded-full/);
  });

  it("[a11y] the chip's explicit h-11 override meets the 44px tap-target floor (sm alone is only h-9/36px)", () => {
    expect(listSrc).toContain('className="h-11 rounded-full motion-safe:active:scale-95"');
  });
});

describe("CAM-410 security — a suggestion renders as inert plain text, never markup", () => {
  it("[security] the chip label is a plain text child ({text}), never dangerouslySetInnerHTML", () => {
    expect(listSrc).not.toMatch(/dangerouslySetInnerHTML\s*=/);
    expect(listSrc).toMatch(/onClick=\{\(\) => onSuggestion\(text\)\}\s*>\s*\{text\}/);
  });
});
