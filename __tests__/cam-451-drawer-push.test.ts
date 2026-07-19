/**
 * cam-451-drawer-push.test.ts — CAM-451
 *
 * Prove-It coverage for the overlay -> push-navigation change: the AI-chat
 * camp-detail view no longer floats over the chat behind a scrim; it now
 * shares a two-pane push track (chat | detail) inside `AiChatPanel.tsx`,
 * each pane an `absolute inset-0` sibling that slides fully on/off screen
 * via its own `transition-transform`. This repo's Vitest runs
 * `environment: 'node'` (no jsdom) — coverage follows the same
 * source-inspection convention already used by
 * `cam-447-ai-chat-detail-card.test.ts` / `cam-450-detail-drawer.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const detailSrc = read("components/ai-chat/AiChatDetailCard.tsx");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");

describe("(a) no scrim — the overlay's dimmed backdrop is gone", () => {
  it("[normal] the scrim testid + its bg-background/backdrop-blur classes no longer exist anywhere", () => {
    expect(detailSrc).not.toContain("scrim--ai-chat-detail");
    expect(panelSrc).not.toContain("scrim--ai-chat-detail");
    expect(detailSrc).not.toContain("bg-background/70 backdrop-blur-sm");
  });
});

describe("(b) detail is a full-width in-flow view, not an absolute-inset floating card", () => {
  it("[normal] AiChatDetailCard's root is a plain in-flow h-full w-full column", () => {
    expect(detailSrc).toContain(
      'className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-ai-tint bg-ai-surface shadow-ai-glow backdrop-blur-xl"'
    );
  });

  it("[normal] no absolute inset-0/z-20 wrapper and no floating inset-x/inset-y geometry remain", () => {
    expect(detailSrc).not.toContain("absolute inset-0 z-20");
    expect(detailSrc).not.toMatch(/absolute inset-x-2 bottom-2 top-16/);
  });
});

describe("(c) the push track applies translate/transition, forking on selectedCamp", () => {
  it("[normal] both panes carry transition-transform + motion-reduce safety, ≤250ms duration", () => {
    const matches = panelSrc.match(/transition-transform duration-200 ease-out motion-reduce:transition-none/g);
    expect(matches?.length).toBe(2);
  });

  it("[normal] the chat pane translates -translate-x-full when selected, translate-x-0 when not", () => {
    expect(panelSrc).toContain('selectedCamp ? "-translate-x-full" : "translate-x-0"');
  });

  it("[normal] the detail pane translates translate-x-0 when selected, translate-x-full when not (opposite direction, same track)", () => {
    expect(panelSrc).toContain('selectedCamp ? "translate-x-0" : "translate-x-full"');
  });

  it("[structural] both panes are absolute inset-0 siblings inside one overflow-hidden track", () => {
    // CAM-453: the track's className moved from a bare string literal to a
    // cn(...) call (it now also forks a desktop-split row layout on
    // `expanded`) — the base classes are unchanged, just no longer inlined.
    expect(panelSrc).toContain('"relative z-10 h-full min-h-0 overflow-hidden"');
    expect(panelSrc.match(/absolute inset-0 flex h-full min-h-0 flex-col/g)?.length).toBe(2);
  });
});

describe("(d) the off-screen pane is inert in both directions", () => {
  it("[normal] chat pane is inert while a camp is selected, in full-push mode (CAM-453: not while desktop-split is active)", () => {
    expect(panelSrc).toContain("inert={!isSplitMode && selectedCamp !== null}");
  });

  it("[normal] detail pane is inert while nothing is selected (symmetric guarantee)", () => {
    expect(panelSrc).toContain("inert={selectedCamp === null}");
  });

  it("[null/empty] the detail component itself only mounts (and only fetches) while selected — never for the off-screen pane", () => {
    expect(panelSrc).toMatch(
      /\{selectedCamp && \(\s*<AiChatDetailCard card=\{selectedCamp\} expanded=\{expanded\} onClose=\{handleCloseDetail\} \/>\s*\)\}/
    );
  });
});

describe("(e) back still closes the detail + restores focus to the originating card", () => {
  it("[normal] the back button closes via onClose (unchanged wiring)", () => {
    expect(detailSrc).toContain("onClick={onClose}");
    expect(detailSrc).toContain('data-testid="btn--ai-chat-detail-back"');
  });

  it("[normal] closing clears selectedCamp + restores focus to the originating card button", () => {
    expect(panelSrc).toContain("function handleCloseDetail()");
    expect(panelSrc).toContain("setSelectedCamp(null);");
    expect(panelSrc).toContain("detailTriggerRef.current?.focus();");
  });

  it("[normal] Esc still closes the detail (window-capture listener unchanged)", () => {
    expect(detailSrc).toContain('window.addEventListener("keydown", handleKeyDown, { capture: true });');
    expect(detailSrc).toContain("onClose();");
  });
});

describe("(f) the new next-weekend label renders on the availability stat tile", () => {
  const th = translations.th.aiChat as { detail: Record<string, string> };
  const en = translations.en.aiChat as { detail: Record<string, string> };

  it("[normal] the stat tile label is prefixed with statNextWeekendLabel, not the bare date alone", () => {
    expect(detailSrc).toContain(
      "label: `${t.aiChat.detail.statNextWeekendLabel} · ${dateFormatter.format(new Date(`${nextWeekend.date}T00:00:00Z`))}`"
    );
  });

  it("[normal] th/en copy exists, is non-empty, and is verbatim", () => {
    expect(th.detail.statNextWeekendLabel).toBe("สุดสัปดาห์หน้า");
    expect(en.detail.statNextWeekendLabel).toBe("Next weekend");
  });

  it("[structural] no em-dash separator in the new key's TH or EN copy", () => {
    expect(th.detail.statNextWeekendLabel).not.toContain("—");
    expect(en.detail.statNextWeekendLabel).not.toContain("—");
  });

  it("[boundary] only the glance stat tile changes — the full weekendAvailability section below keeps its own unrelated heading copy", () => {
    expect(detailSrc).toContain("t.aiChat.detail.availabilityHeading");
    expect(detailSrc).not.toContain("statNextWeekendLabel} · ${t.aiChat.detail.availabilityHeading");
  });
});

describe("WCAG AA token bump — near-floor secondary labels moved off text-muted-foreground", () => {
  it("[normal] the section heading + stat-tile caption use text-foreground/70 (measured ~7.4:1 light / ~8.5:1 dark vs ai-surface, computed via OKLCH->linear-sRGB), not the ~4.3:1 muted-foreground pairing", () => {
    expect(detailSrc).toContain('text-xs font-semibold tracking-wide text-foreground/70 uppercase');
    expect(detailSrc).toContain('<p className="mt-1 truncate text-xs text-foreground/70">{label}</p>');
  });

  it("[structural] no new hardcoded hex/token was introduced to fix contrast — text-foreground/70 already exists elsewhere in the design system", () => {
    expect(detailSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe("Zero debug/demo UI (quality bar)", () => {
  it("no console.log / JSON.stringify dump in either touched file", () => {
    expect(detailSrc).not.toContain("console.log");
    expect(detailSrc).not.toContain("JSON.stringify");
    expect(panelSrc).not.toContain("console.log");
    expect(panelSrc).not.toContain("JSON.stringify");
  });
});
