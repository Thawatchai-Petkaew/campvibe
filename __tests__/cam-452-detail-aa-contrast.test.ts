/**
 * cam-452-detail-aa-contrast.test.ts — CAM-452
 *
 * CAM-451 bumped the 2 most prominent secondary labels (DetailSection heading
 * + StatTile caption) from `text-muted-foreground` to `text-foreground/70` on
 * the detail drawer's `bg-ai-surface` glass (measured ~4.3:1 light, below the
 * 4.5:1 AA floor). This story sweeps the remaining ~16 sibling small
 * labels/captions/meta on the SAME surface that were still left on
 * `text-muted-foreground` / `text-muted-foreground/80` — rating/province
 * line, the distance caption, price captions, activities heading, review
 * meta + content, travel/about sub-labels, the per-night CTA caption.
 *
 * Same node-env source-inspection convention as cam-450/cam-451 (no jsdom).
 * The contrast math re-derives CAM-444's OKLCH -> linear-sRGB matrices, but
 * additionally composites through the alpha layers (--ai-surface's own
 * alpha over --background, then text-foreground's /70 alpha over that
 * composited surface) — alpha blending happens in gamma-encoded sRGB, not
 * linear light, so linear values are gamma-encoded before compositing and
 * gamma-decoded back before computing WCAG relative luminance.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const detailSrc = read("components/ai-chat/AiChatDetailCard.tsx");
const globalsCss = read("app/globals.css");

// ── OKLCH -> linear-sRGB (same matrices as cam-444-dark-price-contrast.test.ts) ──

function oklchToLinearRGB(L: number, C: number, Hdeg: number): [number, number, number] {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [R, G, B].map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

function linToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function srgbToLin(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relLuminance([R, G, B]: [number, number, number]): number {
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(rgbA: [number, number, number], rgbB: [number, number, number]): number {
  const lA = relLuminance(rgbA);
  const lB = relLuminance(rgbB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Alpha-composite fg over bg, blending in gamma-encoded sRGB (Porter-Duff "over" on display pixels). */
function compositeGamma(
  fgLinRGB: [number, number, number],
  alpha: number,
  bgLinRGB: [number, number, number]
): [number, number, number] {
  const fgGamma = fgLinRGB.map(linToSrgb);
  const bgGamma = bgLinRGB.map(linToSrgb);
  const outGamma = fgGamma.map((c, i) => alpha * c + (1 - alpha) * bgGamma[i]);
  return outGamma.map(srgbToLin) as [number, number, number];
}

function parseOklch(cssBlock: string, varName: string): [number, number, number] {
  const re = new RegExp(`${varName}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`);
  const m = cssBlock.match(re);
  expect(m, `${varName} not found as oklch(...) in the given CSS block`).not.toBeNull();
  return [Number(m![1]), Number(m![2]), Number(m![3])];
}

const rootBlock = globalsCss.match(/^:root \{([\s\S]*?)\n\}/m)?.[1] ?? "";
const darkBlock = globalsCss.match(/^\.dark \{([\s\S]*?)\n\}/m)?.[1] ?? "";

describe("WCAG AA — text-foreground/70 vs bg-ai-surface, composited through both alpha layers", () => {
  it("[normal] light: --ai-surface(0.86) over --background, then --foreground/0.7 over that, clears 4.5:1", () => {
    const bg = oklchToLinearRGB(...parseOklch(rootBlock, "--background"));
    const fg = oklchToLinearRGB(...parseOklch(rootBlock, "--foreground"));
    const surfaceRaw = oklchToLinearRGB(...parseOklch(rootBlock, "--ai-surface"));
    const surfaceEff = compositeGamma(surfaceRaw, 0.86, bg);
    const textEff = compositeGamma(fg, 0.7, surfaceEff);
    const ratio = contrastRatio(textEff, surfaceEff);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // matches CAM-451's own measured ~7.3-7.4:1 light figure (story.md)
    expect(ratio).toBeGreaterThan(7);
    expect(ratio).toBeLessThan(8);
  });

  it("[normal] dark: --ai-surface(0.84) over --background, then --foreground/0.7 over that, clears 4.5:1", () => {
    const bg = oklchToLinearRGB(...parseOklch(darkBlock, "--background"));
    const fg = oklchToLinearRGB(...parseOklch(darkBlock, "--foreground"));
    const surfaceRaw = oklchToLinearRGB(...parseOklch(darkBlock, "--ai-surface"));
    const surfaceEff = compositeGamma(surfaceRaw, 0.84, bg);
    const textEff = compositeGamma(fg, 0.7, surfaceEff);
    const ratio = contrastRatio(textEff, surfaceEff);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // matches CAM-451's own measured ~8.3-8.5:1 dark figure (story.md)
    expect(ratio).toBeGreaterThan(8);
    expect(ratio).toBeLessThan(9);
  });

  it("[regression] confirms the ORIGINAL gap: opaque --muted-foreground vs the same composited light surface is BELOW 4.5:1", () => {
    const bg = oklchToLinearRGB(...parseOklch(rootBlock, "--background"));
    const mutedFg = oklchToLinearRGB(...parseOklch(rootBlock, "--muted-foreground"));
    const surfaceRaw = oklchToLinearRGB(...parseOklch(rootBlock, "--ai-surface"));
    const surfaceEff = compositeGamma(surfaceRaw, 0.86, bg);
    const ratio = contrastRatio(mutedFg, surfaceEff);
    expect(ratio).toBeLessThan(4.5);
  });
});

describe("No remaining text-muted-foreground class on the detail-drawer glass", () => {
  it("[normal] zero live `text-muted-foreground` class usages remain (only a historical CAM-451 code comment mentions the string)", () => {
    const classUsages = detailSrc
      .split("\n")
      .filter((line) => line.includes("text-muted-foreground") && line.includes("className="));
    expect(classUsages).toHaveLength(0);
  });
});

describe("Every previously-flagged label now uses text-foreground/70", () => {
  it("[normal] rating line + province/distance line", () => {
    expect(detailSrc).toContain('className="flex items-center gap-1 text-sm text-foreground/70"\n                  data-testid="text--ai-chat-detail-rating"');
    // CAM-598 — the province/distance line no longer wraps (flex-wrap
    // removed) and no longer splits across 2 spans; still text-foreground/70.
    expect(detailSrc).toContain('className="flex items-center gap-1 text-sm text-foreground/70 min-w-0"\n                  data-testid="text--ai-chat-detail-province"');
    expect(detailSrc).toContain('<span className="line-clamp-1 min-w-0">{locationLineText}</span>');
  });

  it("[normal] price captions: per-guest/night, extra-fee one-time, fee info, no-availability empty state", () => {
    expect(detailSrc).toContain('<span className="text-xs text-foreground/70">{t.aiChat.detail.perGuestNight}</span>');
    expect(detailSrc).toContain('<span className="text-xs text-foreground/70">{t.aiChat.detail.extraFeeOneTime}</span>');
    expect(detailSrc).toContain('<p className="text-xs text-foreground/70">{detail.price.feeInfo}</p>');
    expect(detailSrc).toContain('<p className="text-sm text-foreground/70">{t.aiChat.detail.noAvailability}</p>');
  });

  it("[normal] activities heading + no-amenities empty state", () => {
    expect(detailSrc).toContain('<p className="text-xs text-foreground/70">{t.aiChat.detail.activitiesHeading}</p>');
    expect(detailSrc).toContain('<p className="text-sm text-foreground/70">{t.aiChat.detail.noAmenities}</p>');
  });

  it("[normal] review meta (count, per-review rating, content) + no-reviews empty state", () => {
    expect(detailSrc).toContain('<span className="text-foreground/70">');
    expect(detailSrc).toContain('className="flex items-center gap-1 text-xs tabular-nums text-foreground/70"');
    expect(detailSrc).toContain('{review.content && <p className="text-sm text-foreground/70">{review.content}</p>}');
    expect(detailSrc).toContain('<p className="text-sm text-foreground/70">{t.aiChat.card.noReviews}</p>');
  });

  it("[normal] travel section: directions + check-in/out/minimum-age line", () => {
    expect(detailSrc).toContain('<p className="flex items-start gap-2 text-foreground/70">');
    expect(detailSrc).toContain('<p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-foreground/70">');
  });

  it("[normal] the per-night CTA caption", () => {
    expect(detailSrc).toContain('<span className="text-xs text-foreground/70">{t.aiChat.card.perNight}</span>');
  });
});

describe("No layout/structure change — token-only diff", () => {
  it("[structural] no new hardcoded hex introduced", () => {
    expect(detailSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("[structural] the CAM-451 fixes (heading + stat-tile caption) are untouched", () => {
    expect(detailSrc).toContain('text-xs font-semibold tracking-wide text-foreground/70 uppercase');
    expect(detailSrc).toContain('<p className="mt-1 truncate text-xs text-foreground/70">{label}</p>');
  });
});

describe("Zero debug/demo UI (quality bar)", () => {
  it("no console.log / JSON.stringify dump", () => {
    expect(detailSrc).not.toContain("console.log");
    expect(detailSrc).not.toContain("JSON.stringify");
  });
});
