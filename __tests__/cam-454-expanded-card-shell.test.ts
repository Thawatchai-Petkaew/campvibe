/**
 * cam-454-expanded-card-shell.test.ts — CAM-454 (owner staging feedback):
 * the EXPANDED AI-chat panel becomes an inset sliding card, the page behind
 * it is locked (scroll + pointer), and chrome/scrollbars/spacing are
 * cleaned up. Source-inspection coverage — this repo's Vitest config runs
 * `environment: 'node'` (no jsdom), same convention as every other
 * `cam-*-ai-chat-*`/`cam-45*` test in this suite.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const detailSrc = read("components/ai-chat/AiChatDetailCard.tsx");
const globalsCss = read("app/globals.css");
const launcherSrc = read("components/ai-chat/AiChatLauncher.tsx");

describe("(1) [CAM-455 SUPERSEDES] expanded chat is fullscreen inset-0 again — the inset-card treatment moved to the detail pane", () => {
  it("[normal] the expanded branch is a bare inset-0, not the CAM-454 bounded inset/rounded/border", () => {
    expect(panelSrc).toContain(
      "inset-0 duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
    );
  });

  it("[structural] the CAM-454 bounded-inset/rounded/border geometry is gone", () => {
    expect(panelSrc).not.toContain(
      "inset-4 rounded-3xl border border-border/60 lg:inset-y-4 lg:right-4 lg:left-24"
    );
  });

  it("[normal] the entrance is the calmer zoom-in-95/zoom-out-95 + fade (replaces CAM-454's slide-in-from-right)", () => {
    expect(panelSrc).toContain("data-open:zoom-in-95");
    expect(panelSrc).toContain("data-closed:zoom-out-95");
    expect(panelSrc).not.toContain("data-open:slide-in-from-right-10");
    expect(panelSrc).not.toContain("data-closed:slide-out-to-right-10");
  });

  it("[boundary] motion stays <=250ms (duration-200) and the shared motion-reduce guard is untouched", () => {
    expect(panelSrc).toContain(
      "motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
    );
    expect(panelSrc).not.toMatch(/duration-(3\d\d|[4-9]\d\d|\d{4,})/);
  });

  it("[normal] the desktop split (CAM-453 chat+detail rail) still lives inside this same Content — the track div is untouched", () => {
    expect(panelSrc).toContain('expanded && "lg:flex lg:flex-row"');
  });
});

describe("(1b) [CAM-455, margin gated selectedCamp per QA follow-up] the detail pane is the floating inset card instead", () => {
  it("[normal] the base detail-pane string no longer inlines the margin (QA fix: an unconditional margin reserved a dead strip in split mode)", () => {
    expect(panelSrc).toContain(
      "absolute inset-0 flex min-h-0 flex-col transition-transform duration-200 ease-out motion-reduce:transition-none"
    );
  });

  it("[normal] the full-push (mobile/collapsed) margin only applies when selectedCamp is truthy, alongside translate-x-0", () => {
    expect(panelSrc).toContain('selectedCamp ? "my-3 mx-2 translate-x-0" : "translate-x-full"');
  });

  it("[normal] the desktop split base lg: string carries no margin; the margin joins lg:w-[26rem] only when selectedCamp is truthy", () => {
    expect(panelSrc).toContain(
      "lg:relative lg:inset-auto lg:shrink-0 lg:translate-x-0 lg:overflow-hidden lg:transition-[width] lg:duration-200 lg:ease-out lg:motion-reduce:transition-none"
    );
    expect(panelSrc).toContain('selectedCamp ? "lg:my-4 lg:mr-4 lg:w-[26rem]" : "lg:w-0"');
  });

  it("[boundary] when nothing is selected, the split rail carries no reserved margin (lg:w-0 alone) — the fullscreen chat reaches the right edge", () => {
    expect(panelSrc).not.toMatch(/"lg:w-0[^"]*lg:my-4/);
    expect(panelSrc).not.toMatch(/"lg:w-0[^"]*lg:mr-4/);
  });

  it("[structural] the detail pane drops h-full (kept on the chat pane) so the added margin doesn't over-constrain an absolutely-positioned box with both height and inset set", () => {
    expect(panelSrc).toContain(
      "absolute inset-0 flex h-full min-h-0 flex-col transition-transform duration-200 ease-out motion-reduce:transition-none"
    ); // chat pane keeps h-full, unaffected
    expect(panelSrc).not.toContain(
      "absolute inset-0 flex h-full min-h-0 flex-col transition-transform duration-200 ease-out motion-reduce:transition-none\",\n                selectedCamp ? \"my-3 mx-2 translate-x-0\""
    ); // detail pane no longer shares that exact (h-full) string
  });

  it("[normal] AiChatDetailCard's own card surface (rounded-3xl/border/shadow-ai-glow) is unchanged — the card look comes from the child, the wrapper only reserves the gap", () => {
    expect(detailSrc).toContain(
      'className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-ai-tint bg-ai-surface shadow-ai-glow backdrop-blur-xl"'
    );
  });
});

describe("(2) scroll containment — overscroll-contain on both ScrollArea viewports", () => {
  it("[normal] the chat ScrollArea viewport carries overscroll-contain", () => {
    expect(panelSrc).toContain("[&>[data-slot=scroll-area-viewport]]:overscroll-contain");
  });

  it("[normal] the detail ScrollArea viewport carries overscroll-contain", () => {
    expect(detailSrc).toContain("[&>[data-slot=scroll-area-viewport]]:overscroll-contain");
  });
});

describe("(3) background scroll-lock is manual, NEVER via Radix modal", () => {
  it("[structural/Prove-It] modal={false} is still present — the CAM-440 fix is not regressed", () => {
    expect(panelSrc).toContain("<Dialog open={open} onOpenChange={handleOpenChange} modal={false}>");
  });

  it("[normal] a manual effect toggles a scroll-lock class only while open && expanded", () => {
    expect(panelSrc).toMatch(
      /if \(typeof document === "undefined" \|\| !\(open && expanded\)\) return;/
    );
    expect(panelSrc).toContain('root.classList.add("ai-chat-scroll-lock", "no-scrollbar");');
    expect(panelSrc).toContain('root.classList.remove("ai-chat-scroll-lock", "no-scrollbar");');
  });

  it("[normal] the lock class is defined in globals.css as overflow:hidden only (no scrollbar-gutter reservation, unlike Radix RemoveScroll)", () => {
    expect(globalsCss).toMatch(/\.ai-chat-scroll-lock\s*{\s*overflow:\s*hidden;\s*}/);
  });

  it("[null/empty] collapsed mode (expanded=false) never locks — the effect early-returns", () => {
    expect(panelSrc).toContain("!(open && expanded)");
  });
});

describe("(4) background is marked inert while locked", () => {
  it("[normal] every other document.body child is set inert, excluding this panel's own portal nodes", () => {
    expect(panelSrc).toContain('child.hasAttribute("data-ai-chat-node")');
    expect(panelSrc).toContain("child.inert = true;");
    expect(panelSrc).toContain("el.inert = false;");
  });

  it("[normal] both the backdrop and the Content carry the data-ai-chat-node exclusion marker", () => {
    const matches = panelSrc.match(/data-ai-chat-node=""/g) || [];
    expect(matches.length).toBe(2);
  });
});

describe("(5) pointer-capturing backdrop — plain div, not Radix modal", () => {
  it("[structural] DialogOverlay stays bg-transparent (kept, per CAM-429/440) — no regression", () => {
    expect(panelSrc).toContain('<DialogOverlay className="bg-transparent" />');
  });

  it("[normal] a plain backdrop div only captures pointer events while expanded", () => {
    expect(panelSrc).toContain(
      'className={cn("fixed inset-0 z-40", expanded ? "pointer-events-auto" : "pointer-events-none")}'
    );
  });

  it("[structural] the backdrop never imports/uses RemoveScroll or hideOthers as real code (mentioned only in prose comments, would reintroduce CAM-440)", () => {
    expect(panelSrc).not.toContain('from "react-remove-scroll"');
    expect(panelSrc).not.toContain('from "aria-hidden"');
    expect(panelSrc).not.toContain("<RemoveScroll");
    expect(panelSrc).not.toContain("hideOthers(");
  });
});

describe("(6) no divider between the chat and detail split panes", () => {
  it("[structural] lg:border-l is gone from the detail rail", () => {
    expect(panelSrc).not.toContain("lg:border-l");
    expect(panelSrc).not.toContain("lg:border-l lg:border-border/60");
  });

  it("[normal] the detail rail's width fork is otherwise unchanged (lg:w-[26rem] / lg:w-0, now paired with the CAM-455 gated margin)", () => {
    expect(panelSrc).toContain('selectedCamp ? "lg:my-4 lg:mr-4 lg:w-[26rem]" : "lg:w-0"');
  });
});

describe("(7) all 3 scrollbars hidden via a reusable utility, scrolling still works", () => {
  it("[normal] a .no-scrollbar utility exists in globals.css (scrollbar-width:none + webkit hide)", () => {
    expect(globalsCss).toMatch(/\.no-scrollbar\s*{\s*scrollbar-width:\s*none;/);
    expect(globalsCss).toContain(".no-scrollbar::-webkit-scrollbar");
    expect(globalsCss).toContain("display: none;");
  });

  it("[normal] the chat + detail ScrollArea both opt in via data-scrollbar-hidden", () => {
    expect(panelSrc).toContain("data-scrollbar-hidden");
    expect(detailSrc).toContain("data-scrollbar-hidden");
  });

  it("[normal] the opt-in rule hides the Radix custom scrollbar thumb/track too (not just the native scrollbar)", () => {
    expect(globalsCss).toContain('[data-scrollbar-hidden] [data-slot="scroll-area-scrollbar"]');
    expect(globalsCss).toContain("display: none;");
  });

  it("[boundary] scrolling itself is never disabled — no overflow-hidden/overflow-clip added to either ScrollArea's own className", () => {
    expect(panelSrc).not.toMatch(/<ScrollArea\s*\n\s*className="[^"]*overflow-hidden/);
    expect(detailSrc).not.toMatch(/<ScrollArea\s*\n\s*className="[^"]*overflow-hidden/);
  });
});

describe("(8) chat's close/expand controls hide while a detail is open", () => {
  it("[normal] the button group is conditionally rendered on selectedCamp === null", () => {
    expect(panelSrc).toContain("{selectedCamp === null && (");
  });

  it("[normal] both the expand-toggle and close buttons sit after the conditional guard, before the scroll wrapper", () => {
    const openIdx = panelSrc.indexOf("{selectedCamp === null && (");
    const expandIdx = panelSrc.indexOf('data-testid="btn--ai-chat-expand-toggle"');
    const closeIdx = panelSrc.indexOf('data-testid="btn--ai-chat-close"');
    const scrollWrapperIdx = panelSrc.indexOf("<div ref={scrollWrapperRef}");
    expect(openIdx).toBeGreaterThan(-1);
    expect(expandIdx).toBeGreaterThan(openIdx);
    expect(closeIdx).toBeGreaterThan(expandIdx);
    expect(scrollWrapperIdx).toBeGreaterThan(closeIdx);
  });

  it("[normal] a close/back path still exists: AiChatDetailCard's back button + window-capture Esc listener are unchanged", () => {
    expect(detailSrc).toContain('data-testid="btn--ai-chat-detail-back"');
    expect(detailSrc).toContain("onClick={onClose}");
    expect(detailSrc).toContain('window.addEventListener("keydown", handleKeyDown, { capture: true });');
  });

  it("[normal] closing the detail clears selectedCamp, so the buttons reappear", () => {
    expect(panelSrc).toContain("function handleCloseDetail()");
    expect(panelSrc).toContain("setSelectedCamp(null);");
  });
});

describe("(9) AiChatDetailCard section-divider spacing is balanced (mid-turn add, point 7)", () => {
  it("[normal] DetailSection carries pb-6 alongside the existing pt-6, using the same spacing-scale value", () => {
    expect(detailSrc).toContain(
      'className="space-y-3 border-t border-border/60 pt-6 pb-6 first:border-t-0 first:pt-0 last:pb-0"'
    );
  });

  it("[structural] no new spacing token/value was introduced — 6 already existed on pt-6", () => {
    expect(detailSrc).not.toMatch(/\bp[tby]?-(5|7|8|10|12)\b(?=[^-])/);
  });

  it("[boundary] the final section's trailing edge stays flush (last:pb-0)", () => {
    expect(detailSrc).toContain("last:pb-0");
  });
});

describe("(10) QA regression fix: the panel closes on route change (detail CTA navigation)", () => {
  it("[normal] AiChatLauncher reads usePathname and calls setOpen(false) whenever the pathname changes", () => {
    expect(launcherSrc).toContain('import { usePathname } from "next/navigation";');
    expect(launcherSrc).toContain("const pathname = usePathname();");
    expect(launcherSrc).toMatch(/useEffect\(\(\) => \{[\s\S]*setOpen\(false\);[\s\S]*\}, \[pathname\]\);/);
  });

  it("[boundary] the initial mount is skipped so it never fights the FAB's own setOpen(true) on first open", () => {
    expect(launcherSrc).toContain("const didMountRef = useRef(false);");
    expect(launcherSrc).toMatch(/if \(!didMountRef\.current\) \{\s*didMountRef\.current = true;\s*return;\s*\}/);
  });

  it("[structural] closing (not just hiding) the panel is what re-runs its scroll-lock/inert cleanup — setOpen(false) unmounts <AiChatPanel> via its existing `{open && <AiChatPanel .../>}` guard", () => {
    expect(launcherSrc).toContain("{open && <AiChatPanel open={open} onOpenChange={setOpen} />}");
  });
});

describe("Zero debug/demo UI (quality bar)", () => {
  it("no console.log / JSON.stringify dump in either touched file", () => {
    for (const src of [panelSrc, detailSrc, launcherSrc]) {
      expect(src).not.toContain("console.log");
      expect(src).not.toContain("JSON.stringify");
    }
  });
});
