/**
 * cam-569-carousel-counter-contrast.test.ts — CAM-569
 *
 * "The chat carousel counter is unreadable in light mode." Full spec:
 * docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-569-carousel-counter/story.md
 *
 * Source-inspection + real token-math coverage (node env, no jsdom — see
 * cam-541-assistant-visuals.test.ts for the established convention). Every
 * contrast ratio below is COMPUTED from the real `app/globals.css` via
 * `scripts/check-contrast.mjs`'s own engine — no hardcoded expected ratio.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  CSS_PATH,
  ENFORCED_PAIRS,
  measureAll,
  parseTokens,
  resolveForeground,
  resolveOver,
  resolveSurface,
  contrastRatio,
} from "../scripts/check-contrast.mjs";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const carouselSrc = read("components/ai-chat/AiChatCardCarousel.tsx");
const globalsCss = readFileSync(CSS_PATH, "utf8");

type TokenSet = Record<string, string>;
const tokens = (css: string) => parseTokens(css) as { light: TokenSet; dark: TokenSet };

describe("AC-1/BR-1 — the {cur}/{N} counter clears 4.5:1 in both themes (was 4.40:1 light, below floor)", () => {
  const { light, dark } = tokens(globalsCss);

  it("[regression] PROVES the reported defect: opaque --muted-foreground on --ai-surface measures BELOW 4.5:1 in light mode", () => {
    const surface = resolveSurface(light, "--ai-surface");
    const ratio = contrastRatio(resolveOver(light, "--muted-foreground", surface), surface);
    expect(ratio).toBeLessThan(4.5);
  });

  it("[normal] the reused fix (text-foreground/70) clears 4.5:1 on --ai-surface in BOTH themes", () => {
    for (const themeTokens of [light, dark]) {
      const surface = resolveSurface(themeTokens, "--ai-surface");
      const ratio = contrastRatio(resolveForeground(themeTokens, "--foreground", surface, 0.7), surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("[guard] the pair (--foreground@70% vs --ai-surface) is registered in ENFORCED_PAIRS, so it blocks CI, not just this file", () => {
    const hasPair = ENFORCED_PAIRS.some(
      (p: { fg: string; fgAlpha?: number; bg: string }) =>
        p.fg === "--foreground" && p.fgAlpha === 0.7 && p.bg === "--ai-surface"
    );
    expect(hasPair).toBe(true);
  });

  it("[guard] the pair's context explicitly names the carousel counter (traceability, not a silent coincidence)", () => {
    const pair = ENFORCED_PAIRS.find(
      (p: { fg: string; fgAlpha?: number; bg: string; context: string }) =>
        p.fg === "--foreground" && p.fgAlpha === 0.7 && p.bg === "--ai-surface"
    ) as { context: string } | undefined;
    expect(pair?.context).toMatch(/pagination counter/);
  });

  it("[guard] the full enforced registry is 100% green against the real app/globals.css", () => {
    const { enforced } = measureAll(globalsCss);
    const failures = enforced.filter((r: { pass: boolean }) => !r.pass);
    expect(failures).toEqual([]);
  });

  it("[structural] the counter's container uses text-foreground/70, not text-muted-foreground", () => {
    expect(carouselSrc).toContain(
      'className="flex items-center gap-1.5 text-xs tabular-nums text-foreground/70"'
    );
    expect(carouselSrc).not.toMatch(
      /text-xs tabular-nums text-muted-foreground"/
    );
  });
});

describe("AC-2/BR-2 — CAM-547's dot indicator is unchanged (colour alone was already proven insufficient there)", () => {
  it("[structural] the active dot is still the wider pill (h-1.5 w-4 rounded-full bg-primary)", () => {
    expect(carouselSrc).toContain("h-1.5 w-4 rounded-full bg-primary");
  });

  it("[structural] the inactive dot is still h-1.5 w-1.5 rounded-full bg-muted-foreground/60", () => {
    expect(carouselSrc).toContain("h-1.5 w-1.5 rounded-full bg-muted-foreground/60");
  });

  it("[structural] the MAX_DOTS threshold (dots vs counter switch) is unchanged", () => {
    expect(carouselSrc).toContain("const MAX_DOTS = 5;");
    expect(carouselSrc).toContain("cards.length > MAX_DOTS");
  });
});

describe("Zero debug/demo UI (quality bar)", () => {
  it("no console.log / JSON.stringify dump in the touched file", () => {
    expect(carouselSrc).not.toContain("console.log");
    expect(carouselSrc).not.toContain("JSON.stringify");
  });

  it("[structural] no stray hex introduced in the touched file", () => {
    expect(carouselSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
