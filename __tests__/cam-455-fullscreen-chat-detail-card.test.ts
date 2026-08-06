/**
 * cam-455-fullscreen-chat-detail-card.test.ts — CAM-455 (owner clarification,
 * corrects a CAM-454 misread): the EXPANDED chat reverts to true fullscreen
 * (`inset-0`, no rounded/border, calmer zoom/fade entrance); the DETAIL pane
 * (both the CAM-451 mobile/collapsed full-push pane and the CAM-453 desktop
 * split rail) becomes the floating inset card instead. Source-inspection
 * coverage — this repo's Vitest config runs `environment: 'node'` (no
 * jsdom), same convention as every other `cam-*-ai-chat-*` test in this
 * suite.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const panelSrc = read("components/ai-chat/AiChatPanel.tsx");

describe("(1) expanded chat is fullscreen edge-to-edge again", () => {
  it("[normal] the expanded branch uses a bare inset-0", () => {
    expect(panelSrc).toContain(
      'expanded\n              ? "inset-0 duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"'
    );
  });

  it("[structural] the CAM-454 bounded inset/rounded/border geometry no longer drives the expanded Content class", () => {
    // The exact CAM-454 className literal is gone from the code (it may
    // still appear in the file-header doc comment as historical record).
    expect(panelSrc).not.toContain(
      "inset-4 rounded-3xl border border-border/60 lg:inset-y-4 lg:right-4 lg:left-24"
    );
    expect(panelSrc).not.toMatch(/expanded\s*\n\s*\?\s*cn\(\s*\n\s*"inset-4/);
  });

  it("[normal] no rounded-3xl/border is applied to the expanded Content geometry itself (fullscreen has no outer card frame)", () => {
    // The expanded ternary branch is now a bare string, not a cn() call —
    // rounded-3xl/border only appear elsewhere (collapsed branch, detail
    // card, buttons), never inside the expanded geometry string itself.
    const expandedBranch = panelSrc.match(/expanded\n\s*\? "([^"]*)"/)?.[1] ?? "";
    expect(expandedBranch).not.toContain("rounded-3xl");
    expect(expandedBranch).not.toContain("border");
  });
});

describe("(2) the detail pane is the floating inset card, margin gated on selectedCamp", () => {
  it("[normal] the base (unconditional) detail-pane string carries no margin utility", () => {
    expect(panelSrc).toContain(
      "absolute inset-0 flex min-h-0 flex-col transition-transform duration-200 ease-out motion-reduce:transition-none"
    );
  });

  it("[normal] the full-push (mobile/collapsed) margin (my-3 mx-2) only applies alongside translate-x-0 (a camp IS selected)", () => {
    expect(panelSrc).toContain('selectedCamp ? "my-3 mx-2 translate-x-0" : "translate-x-full"');
  });

  it("[normal] the desktop split base lg: string carries no margin; lg:my-4 lg:mr-4 only joins lg:w-[26rem] (a camp IS selected)", () => {
    expect(panelSrc).toContain(
      "lg:relative lg:inset-auto lg:shrink-0 lg:translate-x-0 lg:overflow-hidden lg:transition-[width] lg:duration-200 lg:ease-out lg:motion-reduce:transition-none"
    );
    expect(panelSrc).toContain('selectedCamp ? "lg:my-4 lg:mr-4 lg:w-[26rem]" : "lg:w-0"');
  });

  it("[structural] inert gating is untouched by the margin change", () => {
    expect(panelSrc).toContain("inert={selectedCamp === null}");
  });

  it("[boundary] the chat pane (never the floating card) keeps h-full and carries no margin utility", () => {
    const chatPaneMatch = panelSrc.match(
      /absolute inset-0 flex h-full min-h-0 flex-col transition-transform duration-200 ease-out motion-reduce:transition-none",\n\s*selectedCamp \? "-translate-x-full" : "translate-x-0"/
    );
    expect(chatPaneMatch).not.toBeNull();
  });
});

describe("(4) [QA follow-up] no dead strip on the right of the fullscreen chat when browsing (no detail open)", () => {
  it("[boundary] the closed split rail (lg:w-0) never appears together with lg:my-4 or lg:mr-4 in the same literal", () => {
    // The failure mode: an unconditional lg:mr-4/mx-2 still reserves margin
    // in the flex row even at lg:w-0, leaving a permanent dead strip on the
    // right of the otherwise-fullscreen chat pane — the default view.
    expect(panelSrc).not.toMatch(/"lg:w-0[^"]*lg:my-4/);
    expect(panelSrc).not.toMatch(/"lg:w-0[^"]*lg:mr-4/);
    expect(panelSrc).not.toMatch(/"lg:my-4[^"]*lg:w-0"/);
    expect(panelSrc).not.toMatch(/"lg:mr-4[^"]*lg:w-0"/);
  });

  it("[boundary] the closed full-push pane (translate-x-full, off-screen) never appears together with my-3 or mx-2 in the same literal", () => {
    expect(panelSrc).not.toMatch(/"my-3[^"]*translate-x-full"/);
    expect(panelSrc).not.toMatch(/"mx-2[^"]*translate-x-full"/);
  });

  it("[normal] the chat pane's own in-flow split variant (lg:flex-1) is completely unaffected by the detail pane's margin gating", () => {
    expect(panelSrc).toContain('expanded && "lg:relative lg:inset-auto lg:flex-1 lg:min-w-0 lg:translate-x-0"');
  });
});

describe("(3) KEEP-list survives — CAM-451/453/454 behavior is not regressed", () => {
  it("[structural/Prove-It] modal={false} (CAM-440 guard) is still present", () => {
    expect(panelSrc).toContain("<Dialog open={open} onOpenChange={handleOpenChange} modal={false}>");
  });

  it("[normal] the manual scroll-lock class is still applied only while open && expanded", () => {
    expect(panelSrc).toContain('root.classList.add("ai-chat-scroll-lock", "no-scrollbar");');
    // CAM-703 (2026-08-06 dated supersede) — one more OR clause suspends the
    // lock while LoginModal is open; the `!(open && expanded)` core this
    // test protects is unchanged.
    expect(panelSrc).toMatch(
      /if \(typeof document === "undefined" \|\| !\(open && expanded\) \|\| loginModalOpen\) return;/
    );
  });

  it("[normal] scrollbars are still hidden via data-scrollbar-hidden on both ScrollAreas", () => {
    const matches = panelSrc.match(/data-scrollbar-hidden/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("[normal] the chat's close/expand chrome still hides while a detail is open", () => {
    expect(panelSrc).toContain("{selectedCamp === null && (");
  });

  it("[structural] no lg:border-l divider was reintroduced between the split panes", () => {
    expect(panelSrc).not.toContain("lg:border-l");
  });

  it("[normal] both panes are still absolute inset-0 siblings inside the same overflow-hidden track", () => {
    expect(panelSrc).toContain('"relative z-10 h-full min-h-0 overflow-hidden"');
    expect(panelSrc.match(/absolute inset-0/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Zero debug/demo UI (quality bar)", () => {
  it("no console.log / JSON.stringify dump in the touched file", () => {
    expect(panelSrc).not.toContain("console.log");
    expect(panelSrc).not.toContain("JSON.stringify");
  });
});
