/**
 * cam-444-dark-price-contrast.test.ts — CAM-444
 *
 * R3 owner feedback: the in-chat card PRICE (teal) read too DIM in dark mode.
 * Root cause (confirmed): the price hero used --primary (a low-lightness
 * button-fill token, dark L=0.437) as TEXT on dark --card (L=0.218) —
 * 2.31:1, below WCAG AA 4.5:1. Brightening --primary itself was ruled out
 * (it would break white-on-primary buttons + the user chat bubble
 * site-wide), so this story adds a dedicated --ai-price token instead.
 *
 * This repo's Vitest config runs `environment: 'node'`, no jsdom (see
 * cam-272-ai-chat-components.test.ts). Where the environment allows, prefer
 * a measurable assertion over a pure source grep (qa.md): the contrast
 * tests below re-derive the OKLCH -> linear-sRGB -> relative-luminance math
 * from the actual token values parsed out of app/globals.css, so a revert
 * of --ai-price back toward --primary's dark value fails these on real
 * numbers, not just on a missing string.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const globalsCss = read("app/globals.css");
const designMd = read("DESIGN.md");
const cardSrc = read("components/ai-chat/AiChatCampCard.tsx");

// ── OKLCH -> WCAG relative-luminance contrast (Björn Ottosson's OKLab matrices) ──

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

function relLuminance([R, G, B]: [number, number, number]): number {
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(oklchA: [number, number, number], oklchB: [number, number, number]): number {
  const lA = relLuminance(oklchToLinearRGB(...oklchA));
  const lB = relLuminance(oklchToLinearRGB(...oklchB));
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pulls `oklch(L C H ...)` triples out of a named custom-property declaration inside a given CSS block. */
function parseOklch(cssBlock: string, varName: string): [number, number, number] {
  const re = new RegExp(`${varName}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`);
  const m = cssBlock.match(re);
  expect(m, `${varName} not found as oklch(...) in the given CSS block`).not.toBeNull();
  return [Number(m![1]), Number(m![2]), Number(m![3])];
}

// Anchor on a column-0 `:root {`/`.dark {` — globals.css also nests an
// (empty) `:root` inside an `@media (prefers-color-scheme: dark)` block, and
// a second, unrelated `:root` further down scopes /status/map HUD constants
// (not design tokens); the real token block is the FIRST column-0 match.
const rootBlock = globalsCss.match(/^:root \{([\s\S]*?)\n\}/m)?.[1] ?? "";
const darkBlock = globalsCss.match(/^\.dark \{([\s\S]*?)\n\}/m)?.[1] ?? "";

describe("app/globals.css — --ai-price token defined + wired to a utility", () => {
  it("[unit] declares --ai-price in :root (light) and .dark", () => {
    expect(rootBlock).toMatch(/--ai-price:\s*oklch\(/);
    expect(darkBlock).toMatch(/--ai-price:\s*oklch\(/);
  });

  it("[unit] maps --ai-price to a @theme inline utility (text-ai-price)", () => {
    expect(globalsCss).toContain("--color-ai-price: var(--ai-price);");
  });
});

describe("contrast — dark --ai-price as text on dark --card clears WCAG AA (Prove-It)", () => {
  const darkCard = parseOklch(darkBlock, "--card");
  const darkPrimary = parseOklch(darkBlock, "--primary");
  const darkAiPrice = parseOklch(darkBlock, "--ai-price");

  it("[regression] confirms the ORIGINAL bug: --primary as text on dark --card is BELOW 4.5:1", () => {
    const ratio = contrastRatio(darkPrimary, darkCard);
    expect(ratio).toBeLessThan(4.5);
  });

  it("[unit] the new --ai-price (dark) as text on dark --card clears 4.5:1 AA", () => {
    const ratio = contrastRatio(darkAiPrice, darkCard);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("[unit] --ai-price (dark) is measurably brighter than --primary (dark) — the actual fix, not just a new name", () => {
    const [L1] = darkAiPrice;
    const [L2] = darkPrimary;
    expect(L1).toBeGreaterThan(L2);
  });
});

describe("contrast — light --ai-price is unchanged (still ≥ AA on the white --card)", () => {
  const lightCard = parseOklch(rootBlock, "--card");
  const lightPrimary = parseOklch(rootBlock, "--primary");
  const lightAiPrice = parseOklch(rootBlock, "--ai-price");

  it("[unit] light --ai-price equals light --primary (price colour unchanged in light mode)", () => {
    expect(lightAiPrice).toEqual(lightPrimary);
  });

  it("[unit] light --ai-price as text on the white --card clears 4.5:1 AA", () => {
    const ratio = contrastRatio(lightAiPrice, lightCard);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe("AiChatCampCard.tsx — the price hero uses text-ai-price, not text-primary", () => {
  it("[unit] both price-hero spans (priced + free) use text-ai-price", () => {
    expect(cardSrc).toContain('<span className="text-lg font-semibold text-ai-price">฿{THB_FORMAT.format(card.priceLow)}</span>');
    expect(cardSrc).toContain('<span className="text-lg font-semibold text-ai-price">{t.aiChat.card.free}</span>');
  });

  it("[structural] --primary is not reintroduced on the price hero spans", () => {
    const priceBlockMatch = cardSrc.match(
      /<p className="flex items-baseline gap-1 tabular-nums" data-testid="text--ai-chat-card-price">([\s\S]*?)<\/p>/
    );
    expect(priceBlockMatch, "hero price <p> not found").not.toBeNull();
    expect(priceBlockMatch![1]).not.toContain("text-primary");
  });
});

describe("DESIGN.md §2.1 — --ai-price is documented in the closed allowlist", () => {
  it("[unit] the allowlist parenthetical names --ai-price alongside the other closed tokens", () => {
    expect(designMd).toMatch(/--ai-flame-aura`,\s*`--ai-price`/);
  });

  it("[unit] a MAY-line explains the price token's purpose + AA-both-themes guarantee", () => {
    expect(designMd).toContain("`text-ai-price`");
    expect(designMd.toLowerCase()).toContain("≥ aa both themes".toLowerCase());
  });
});
