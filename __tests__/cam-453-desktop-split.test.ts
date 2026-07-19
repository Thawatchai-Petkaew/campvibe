/**
 * cam-453-desktop-split.test.ts — CAM-453
 *
 * Prove-It coverage for the responsive fork on top of CAM-451's push track:
 * on desktop (`sm:`+) while `expanded`, the detail no longer fully pushes
 * the chat off-screen — the track becomes a row split (chat stays in-flow
 * + visible, detail becomes a bounded right-hand rail). Mobile and the
 * collapsed 384px card keep the CAM-451 full-push behaviour unchanged
 * (asserted in `cam-451-drawer-push.test.ts`, not re-duplicated here).
 * Same source-inspection convention as CAM-451/447/450 (Vitest
 * `environment: 'node'`, no jsdom).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const panelSrc = read("components/ai-chat/AiChatPanel.tsx");

describe("(a) split layout is gated by expanded + Tailwind's sm: prefix", () => {
  it("[normal] the track forks a sm: row layout only when expanded", () => {
    expect(panelSrc).toContain('expanded && "sm:flex sm:flex-row"');
  });

  it("[normal] the chat pane keeps a visible in-flow flex-1 variant, gated the same way", () => {
    expect(panelSrc).toContain(
      'expanded && "sm:relative sm:inset-auto sm:flex-1 sm:min-w-0 sm:translate-x-0"'
    );
  });

  it("[normal] the detail pane forks a bounded sm:w-[...] side-panel variant, gated the same way", () => {
    expect(panelSrc).toContain("sm:w-[22rem] sm:border-l sm:border-border/60 lg:w-[26rem]");
    expect(panelSrc).toContain('selectedCamp ? "sm:w-[22rem]');
  });

  it("[boundary] the detail rail collapses to sm:w-0 when nothing is selected (still in-flow, not translated off)", () => {
    expect(panelSrc).toMatch(/selectedCamp\s*\?\s*"sm:w-\[22rem\][^"]*"\s*:\s*"sm:w-0"/);
  });

  it("[structural] every split override is wrapped in `expanded &&`, never bare on its own", () => {
    // The track's row-split fork sits directly behind `expanded &&`.
    expect(panelSrc).toMatch(/expanded && "sm:flex sm:flex-row"/);
    // The detail rail's width fork sits behind `expanded && cn(...)`, with
    // the actual `sm:w-[22rem]` literal nested inside that same cn() call.
    expect(panelSrc).toMatch(
      /expanded &&\s*cn\(\s*"sm:relative[^"]*sm:motion-reduce:transition-none",\s*selectedCamp \? "sm:w-\[22rem\]/
    );
  });
});

describe("(b) full-push variant (CAM-451) is retained unprefixed for mobile + collapsed", () => {
  it("[normal] the chat pane's unprefixed translate fork is unchanged (mobile / !expanded fallback)", () => {
    expect(panelSrc).toContain('selectedCamp ? "-translate-x-full" : "translate-x-0"');
  });

  it("[normal] the detail pane's unprefixed translate fork is unchanged (mobile / !expanded fallback)", () => {
    expect(panelSrc).toContain('selectedCamp ? "translate-x-0" : "translate-x-full"');
  });

  it("[normal] both panes still carry the base absolute inset-0 + transition-transform classes with no sm: prefix", () => {
    expect(panelSrc.match(/absolute inset-0 flex h-full min-h-0 flex-col transition-transform duration-200 ease-out motion-reduce:transition-none/g)?.length).toBe(2);
  });
});

describe("(c) chat pane inert is conditional on full-push mode, not split mode", () => {
  it("[normal] chat pane inert reads !isSplitMode && selectedCamp !== null (never inert while split is active)", () => {
    expect(panelSrc).toContain("inert={!isSplitMode && selectedCamp !== null}");
  });

  it("[normal] isSplitMode is derived from expanded AND a real viewport check, not from expanded alone", () => {
    expect(panelSrc).toContain("const isSplitMode = expanded && isDesktopViewport;");
  });

  it("[normal] the viewport check is a real matchMedia hook via useSyncExternalStore (SSR snapshot returns false, no window access at module scope)", () => {
    expect(panelSrc).toContain("window.matchMedia(DESKTOP_SPLIT_QUERY)");
    expect(panelSrc).toContain("useSyncExternalStore(");
    expect(panelSrc).toContain("function getServerIsDesktopViewport(): boolean {\n  return false;\n}");
  });

  it("[normal] the detail pane's own inert is unchanged (still gated on selectedCamp alone in both modes)", () => {
    expect(panelSrc).toContain("inert={selectedCamp === null}");
  });
});

describe("(d) motion-reduce is preserved through the split's transitioned property", () => {
  it("[normal] both panes still carry the base motion-reduce:transition-none guard", () => {
    expect(panelSrc.match(/motion-reduce:transition-none/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("[normal] the detail rail's width-transition (split mode) repeats the guard at the sm: variant", () => {
    expect(panelSrc).toContain("sm:motion-reduce:transition-none");
  });

  it("[boundary] the split's transitioned property is width, not transform (a fixed-width flex sibling can't be translated without leaving a gap)", () => {
    expect(panelSrc).toContain("sm:transition-[width]");
  });
});

describe("Zero debug/demo UI (quality bar)", () => {
  it("no console.log / JSON.stringify dump in the touched file", () => {
    expect(panelSrc).not.toContain("console.log");
    expect(panelSrc).not.toContain("JSON.stringify");
  });
});
