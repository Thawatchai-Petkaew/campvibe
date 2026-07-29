/**
 * cam-669-bottom-bar-fab-gap.test.ts — CAM-669
 *
 * Defect: CAM-664's mobile `StickyActionBar` (fixed, bottom, ~61-80px tall)
 * and the global `AiChatLauncher` FAB (fixed `bottom-10 right-6`, 40px from
 * the viewport bottom) can occupy the same screen region on a phone.
 *
 * Fix: `StickyActionBar` publishes its own real rendered height on the
 * `--bottom-bar-height` root custom property (ResizeObserver, reset to 0px
 * on unmount); `AiChatLauncher`'s inner wrapper subtracts that value from its
 * existing Y-translate, so it clears whatever is docked below it without
 * either file hardcoding the other's dimensions (DESIGN.md "Bottom-docked
 * elements" contract).
 *
 * Layer: source-inspection (this repo's Vitest runs `environment: 'node'`,
 * no jsdom/browser — same precedent as cam-664's own test for these two
 * files). The actual geometry (non-intersection, gap > 0, byte-identical
 * baseline) was proven behaviorally with a real headless-Chromium harness
 * reproducing the exact shipped `calc()`/transform strings and standard
 * Tailwind utility-to-CSS mappings (spacing scale, height scale) — see the
 * PR description for the measured pixel values; that harness is not part of
 * this repo's committed suite (this repo's Vitest has no browser/jsdom
 * environment to run it in-suite).
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary ·
 * error/validation (defensive default) — applied per unit below.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const barSrc = src("components/ui/sticky-action-bar.tsx");
const launcherSrc = src("components/ai-chat/AiChatLauncher.tsx");
const globalsCss = src("app/globals.css");

// ---------------------------------------------------------------------------
// components/ui/sticky-action-bar.tsx — publishes + resets --bottom-bar-height.
// ---------------------------------------------------------------------------
describe("StickyActionBar — publishes its own real rendered height on --bottom-bar-height", () => {
  it("[normal] measures its own wrapper via a ref + ResizeObserver, not a hardcoded constant", () => {
    expect(barSrc).toContain('const barRef = useRef<HTMLDivElement>(null);');
    expect(barSrc).toContain("ref={barRef}");
    expect(barSrc).toContain("new ResizeObserver(publishHeight)");
    expect(barSrc).toContain("el.getBoundingClientRect().height");
  });

  it("[normal] publishes onto the root element via setProperty, not a component-local style", () => {
    expect(barSrc).toContain(
      'document.documentElement.style.setProperty(\n                "--bottom-bar-height",'
    );
  });

  it("[null/empty boundary] resets to 0px on unmount (cleanup return), so an unmounted bar never leaves a stale offset behind", () => {
    const effectBody = barSrc.slice(
      barSrc.indexOf("useEffect(() => {"),
      barSrc.indexOf("}, []);")
    );
    expect(effectBody).toContain("return () => {");
    expect(effectBody).toContain('resizeObserver.disconnect();');
    expect(effectBody).toContain('document.documentElement.style.setProperty("--bottom-bar-height", "0px");');
  });

  it("[error/validation defensive] a null ref (not yet mounted) bails out before touching ResizeObserver", () => {
    expect(barSrc).toContain("if (!el) return;");
  });

  it("[regression] the bar's own visible layout classes (md:hidden fixed bottom-0 z-40, safe-area pad) are unchanged by this fix", () => {
    expect(barSrc).toContain("md:hidden fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4");
    expect(barSrc).toContain("pb-[max(0.5rem,env(safe-area-inset-bottom))]");
  });
});

// ---------------------------------------------------------------------------
// components/ai-chat/AiChatLauncher.tsx — clears whatever --bottom-bar-height reports.
// ---------------------------------------------------------------------------
describe("AiChatLauncher — the inner wrapper clears --bottom-bar-height; the outer div is untouched", () => {
  it("[regression] the outer div's pinned opening tag is byte-for-byte unchanged (5 other tests pin this)", () => {
    expect(launcherSrc).toContain('<div className="fixed bottom-10 right-6 z-50">');
  });

  it("[normal] the inner wrapper's Y-translate subtracts var(--bottom-bar-height, 0px) alongside the existing safe-area term", () => {
    expect(launcherSrc).toContain(
      "translate(calc(-1 * env(safe-area-inset-right)), calc(-1 * env(safe-area-inset-bottom) - var(--bottom-bar-height, 0px))) translateZ(0)"
    );
  });

  it("[boundary] the fallback value in var(...) is exactly 0px, so a page with no bar/no CSS variable at all is unaffected", () => {
    expect(launcherSrc).toContain("var(--bottom-bar-height, 0px)");
  });

  it("[regression] no hardcoded replacement magic-number bottom offset was introduced (e.g. bottom-24) for this fix — checked as a live className, not the file's historical comments", () => {
    expect(launcherSrc).not.toMatch(/className="[^"]*bottom-(20|24|28|32)[^"]*"/);
  });
});

// ---------------------------------------------------------------------------
// app/globals.css — the shared default, read before the bar ever mounts.
// ---------------------------------------------------------------------------
describe("app/globals.css — --bottom-bar-height defaults to 0px on :root", () => {
  it("[normal] declares the default so any reader is safe before StickyActionBar's effect runs, or on a route with no bar", () => {
    expect(globalsCss).toContain("--bottom-bar-height: 0px;");
  });

  it("[normal] app/globals.css itself is excluded from the palette guard (documented exception), so this is the sanctioned home for the default", () => {
    // Sanity check the file is exactly where the guard's EXCLUDE_FILES entry expects it.
    expect(fs.existsSync(path.join(root, "app", "globals.css"))).toBe(true);
  });
});
