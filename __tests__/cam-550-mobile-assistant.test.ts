/**
 * cam-550-mobile-assistant.test.ts — CAM-550 (mobile is full-screen only, no
 * minimize/collapse control; the header stays put; the launcher is fully
 * visible + not cropped).
 *
 * Source-inspection coverage (this repo's Vitest config runs
 * `environment: 'node'`, no jsdom — see __tests__/cam-272-ai-chat-components
 * .test.ts for the established convention). Real-browser behavior (does the
 * toggle actually render at a phone width vs a desktop width, does the
 * header actually stay in view while scrolling, is the launcher actually
 * fully inside the viewport) is proven in
 * e2e/regression/cam-550-mobile-fullscreen.spec.ts — a real browser is the
 * only honest instrument for those three claims (per the ticket).
 *
 * AC coverage:
 *   AC-1 no minimize/collapse control exists on a small viewport; desktop
 *        keeps both (this file: the SAME toggle node carries `hidden
 *        sm:inline-flex` — proven at the class level; the e2e spec proves
 *        the real rendered difference at two real viewports)
 *   AC-2 the panel is forced full-screen below `sm:` regardless of the
 *        `expanded` state, using a real visible-viewport unit (`dvh`), with
 *        top/bottom safe-area breathing room
 *   AC-3 the launcher is nudged clear of a notch/dynamic-island/home-
 *        indicator via `env(safe-area-inset-*)`, additive on top of its
 *        existing bottom-10/right-6 anchor
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const launcherSrc = read("components/ai-chat/AiChatLauncher.tsx");

describe("AC-1 — no minimize/collapse control on mobile; desktop keeps it (teeth: both halves asserted on the SAME node)", () => {
  it("[unit] the expand/collapse toggle button exists (not deleted) and is hidden by default, shown only at sm:+", () => {
    expect(panelSrc).toContain('data-testid="btn--ai-chat-expand-toggle"');
    // The toggle's OWN className carries the responsive pair — a test that
    // only checked "hidden" is present (without also proving "sm:inline-flex"
    // exists) would still pass if the button were hidden on EVERY viewport,
    // which would silently break the desktop affordance too.
    const toggleBlock = panelSrc.slice(
      panelSrc.indexOf('data-testid="btn--ai-chat-expand-toggle"') - 200,
      panelSrc.indexOf('data-testid="btn--ai-chat-expand-toggle"') + 200
    );
    expect(toggleBlock).toContain('className="hidden sm:inline-flex"');
  });

  it("[unit] the close button (the one control mobile DOES keep) carries no `hidden` class at all — proves the fix scopes to the expand toggle only, not every header control", () => {
    const closeIdx = panelSrc.indexOf('data-testid="btn--ai-chat-close"');
    expect(closeIdx).toBeGreaterThan(-1);
    // Scoped to the Close <Button ...> tag itself (testid to the next `>`),
    // not a wider window — a wider slice would false-positive on the
    // unrelated "hidden while a detail is open" comment nearby.
    const closeTagEnd = panelSrc.indexOf(">", closeIdx);
    const closeOpenTag = panelSrc.slice(panelSrc.lastIndexOf("<Button", closeIdx), closeTagEnd);
    expect(closeOpenTag).not.toContain("hidden");
    expect(closeOpenTag).not.toContain("className=");
  });

  it("[unit/Prove-It] a toggle carrying only 'hidden' (no sm: variant) would never re-appear on desktop — this exact failure mode is why sm:inline-flex must co-exist with hidden in the SAME className string", () => {
    expect(panelSrc).not.toMatch(/data-testid="btn--ai-chat-expand-toggle"[\s\S]{0,300}?className="hidden"/);
  });
});

describe("AC-2 — mobile (max-sm, below 640px) is full-screen ONLY, always — regardless of `expanded`", () => {
  it("[unit] the panel geometry carries a max-sm: override that forces full-screen positioning (wins the cascade below 640px over EITHER expanded/collapsed branch)", () => {
    expect(panelSrc).toContain(
      "max-sm:inset-x-0 max-sm:top-0 max-sm:bottom-auto max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:border-none"
    );
  });

  it("[unit/Prove-It] max-h is overridden alongside h — the collapsed branch's OWN max-h-[85dvh] would otherwise still cap the box at 85% even with height forced to 100dvh (this is the exact defect measured before this line was added)", () => {
    expect(panelSrc).toContain("max-h-[85dvh]"); // the untouched collapsed-branch value this must out-cascade
    expect(panelSrc).toContain("max-sm:max-h-[100dvh]"); // the override that wins below 640px
  });

  it("[unit] the entrance animation is normalized to the calmer fullscreen fade+zoom on mobile regardless of which branch supplied slide-in-from-bottom", () => {
    expect(panelSrc).toContain(
      "max-sm:transform-gpu max-sm:data-open:fade-in-0 max-sm:data-open:zoom-in-95 max-sm:data-open:slide-in-from-bottom-0 max-sm:data-closed:fade-out-0 max-sm:data-closed:zoom-out-95 max-sm:data-closed:slide-out-to-bottom-0"
    );
  });

  it("[unit] the pre-existing expanded/collapsed branch strings are untouched (byte-identical) — this fix is additive, not a rewrite", () => {
    // Same literal strings several pre-CAM-550 tests already pin.
    expect(panelSrc).toContain(
      "inset-0 duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
    );
    expect(panelSrc).toContain("inset-x-0 bottom-0 h-[85dvh] max-h-[85dvh] rounded-t-3xl border-t border-border");
    expect(panelSrc).toContain("border-b border-border/60 px-4 py-3");
    expect(panelSrc).toContain("border-t border-border/60 p-4");
  });

  it("[unit] header + composer carry env(safe-area-inset-*) breathing room on mobile (the 'flush against the edges' defect)", () => {
    expect(panelSrc).toContain("max-sm:pt-[max(1rem,env(safe-area-inset-top))]");
    expect(panelSrc).toContain("max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]");
  });
});

describe("AC-3 — the launcher clears a notch/dynamic-island/home-indicator and is never cropped", () => {
  it("[unit] the launcher's outer fixed anchor is untouched (byte-identical opening tag — a pre-existing test pins it)", () => {
    expect(launcherSrc).toContain('<div className="fixed bottom-10 right-6 z-50">');
  });

  it("[unit] a nested wrapper additively nudges the disc clear of the safe area + forces GPU compositing", () => {
    expect(launcherSrc).toContain("env(safe-area-inset-right)");
    expect(launcherSrc).toContain("env(safe-area-inset-bottom)");
    expect(launcherSrc).toContain("translateZ(0)");
  });

  it("[unit] the launcher button + its decorative aura spans still render inside the new wrapper (nothing dropped)", () => {
    expect(launcherSrc).toContain('data-testid="btn--ai-chat-launcher"');
    expect(launcherSrc).toContain("shadow-ai-flame-aura");
  });
});
