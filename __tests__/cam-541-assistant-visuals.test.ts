/**
 * cam-541-assistant-visuals.test.ts — CAM-541
 *
 * "Camp fire assistant is legible in light mode and stops overlapping on
 * small screens" — owner feedback after CAM-550/CAM-547 merged. Full spec:
 * docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-541-assistant-visuals/story.md
 *
 * Source-inspection + real token-math coverage (this repo's Vitest config
 * runs `environment: 'node'`, no jsdom — see cam-272-ai-chat-components.test.ts
 * for the established convention). Every contrast ratio below is COMPUTED
 * from the real `app/globals.css` via `scripts/check-contrast.mjs`'s own
 * engine (the guard this story extends) — no hardcoded expected ratio, so a
 * future token drift fails this test rather than silently rotting.
 *
 * Item 2 (mobile overlap) was found ALREADY FIXED by CAM-550 during this
 * story's own verification (real Playwright measurement at a 390x664
 * viewport, both color schemes, default AND 150% root font-size — reported
 * in the PR body, not re-derivable from a node-env unit test). AC-2 below is
 * the structural regression guard that keeps it fixed; the real-browser
 * proof is the owner-verify step, same as CAM-550's own e2e spec
 * (e2e/regression/cam-550-mobile-fullscreen.spec.ts, untouched by this story).
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

const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");
const avatarSrc = read("components/ai-chat/AiChatAvatar.tsx");
const globalsCss = readFileSync(CSS_PATH, "utf8");

/**
 * `scripts/check-contrast.mjs` is plain JS; TS infers `{}` for its maps. One
 * asserted boundary here (same convention as cam-537-contrast-floor.test.ts).
 */
type TokenSet = Record<string, string>;
const tokens = (css: string) => parseTokens(css) as { light: TokenSet; dark: TokenSet };

describe("AC-1/BR-1 — assistant secondary text clears 4.5:1 in light mode (was 4.40:1/4.19:1, below floor)", () => {
  const { light, dark } = tokens(globalsCss);

  it("[regression] PROVES the reported defect: opaque --muted-foreground on --ai-surface/--ai-tint measures BELOW 4.5:1 in light mode", () => {
    const surfaceAi = resolveSurface(light, "--ai-surface");
    const surfaceTint = resolveSurface(light, "--ai-tint");
    const mutedOnSurface = contrastRatio(resolveOver(light, "--muted-foreground", surfaceAi), surfaceAi);
    const mutedOnTint = contrastRatio(resolveOver(light, "--muted-foreground", surfaceTint), surfaceTint);
    expect(mutedOnSurface).toBeLessThan(4.5);
    expect(mutedOnTint).toBeLessThan(4.5);
  });

  it("[normal] the shipped fix (text-foreground/70) clears 4.5:1 on --ai-surface in BOTH themes", () => {
    for (const [themeTokens] of [[light], [dark]]) {
      const surface = resolveSurface(themeTokens, "--ai-surface");
      const ratio = contrastRatio(resolveForeground(themeTokens, "--foreground", surface, 0.7), surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("[normal] the shipped fix (text-foreground/70) clears 4.5:1 on --ai-tint in BOTH themes", () => {
    for (const [themeTokens] of [[light], [dark]]) {
      const surface = resolveSurface(themeTokens, "--ai-tint");
      const ratio = contrastRatio(resolveForeground(themeTokens, "--foreground", surface, 0.7), surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("[guard] the new pair is actually registered in ENFORCED_PAIRS (so it blocks CI, not just this file)", () => {
    const hasAiSurfacePair = ENFORCED_PAIRS.some(
      (p: { fg: string; fgAlpha?: number; bg: string }) => p.fg === "--foreground" && p.fgAlpha === 0.7 && p.bg === "--ai-surface"
    );
    const hasAiTintPair = ENFORCED_PAIRS.some(
      (p: { fg: string; fgAlpha?: number; bg: string }) => p.fg === "--foreground" && p.fgAlpha === 0.7 && p.bg === "--ai-tint"
    );
    expect(hasAiSurfacePair).toBe(true);
    expect(hasAiTintPair).toBe(true);
  });

  it("[guard] the full enforced registry (including the 2 new pairs) is 100% green against the real app/globals.css", () => {
    const { enforced } = measureAll(globalsCss);
    const failures = enforced.filter((r: { pass: boolean }) => !r.pass);
    expect(failures).toEqual([]);
  });

  it("[structural] AiChatPanel's header role subtitle uses text-foreground/70, not text-muted-foreground", () => {
    expect(panelSrc).toContain('className="truncate text-xs leading-tight text-foreground/70"');
    expect(panelSrc).not.toMatch(/text-xs leading-tight text-muted-foreground/);
  });

  it("[structural] the welcome examples label + zero-result notice use text-foreground/70, not text-muted-foreground", () => {
    expect(listSrc).toContain('<p className="text-xs text-foreground/70">{t.aiChat.welcomeExamplesLabel}</p>');
    expect(listSrc).toContain('className="text-foreground/70"');
    expect(listSrc).not.toMatch(/className="text-xs text-muted-foreground">\{t\.aiChat\.welcomeExamplesLabel\}/);
    expect(listSrc).not.toMatch(/data-testid="empty--ai-chat-zero-result" className="text-muted-foreground"/);
  });
});

describe("AC-4/BR-3/EC-2 — the assistant mark renders exactly once at the start of a chat", () => {
  it("[unit] the welcome/empty block (entries.length === 0) renders NO AiChatAvatar of its own", () => {
    const welcomeBlock = listSrc.slice(
      listSrc.indexOf('data-testid="empty--ai-chat-welcome"'),
      listSrc.indexOf("{entries.map((entry, index) =>")
    );
    expect(welcomeBlock).not.toContain("<AiChatAvatar");
  });

  it("[unit] AiChatMessageList.tsx renders AiChatAvatar exactly once total — the CAM-425/435 resuming indicator only (a distinct, genuinely-loading surface, not shown alongside the header)", () => {
    const occurrences = (listSrc.match(/<AiChatAvatar/g) ?? []).length;
    expect(occurrences).toBe(1);
    expect(listSrc).toContain('<AiChatAvatar size="lg" intensity="loading" />');
  });

  it("[unit] the panel header (AiChatPanel.tsx) renders AiChatAvatar exactly once — the sole persistent mark", () => {
    const occurrences = (panelSrc.match(/<AiChatAvatar/g) ?? []).length;
    expect(occurrences).toBe(1);
    expect(panelSrc).toContain('<AiChatAvatar size="md" />');
  });

  it("[unit] at chat-start (fresh open, entries.length === 0, not resuming) exactly ONE AiChatAvatar is reachable across the whole panel — the header's", () => {
    // The resuming indicator is gated on `resuming` (CAM-423/425) — mutually
    // exclusive with the entries.length===0 welcome block at the SAME time
    // (see AiChatMessageList.tsx: `{resuming && (...)}` then
    // `{!resuming && entries.length === 0 && (...)}`). At true chat-start the
    // only avatar left standing is the header's.
    const welcomeBlock = listSrc.slice(
      listSrc.indexOf('data-testid="empty--ai-chat-welcome"'),
      listSrc.indexOf("{entries.map((entry, index) =>")
    );
    const avatarsAtChatStart =
      (panelSrc.match(/<AiChatAvatar/g) ?? []).length + (welcomeBlock.match(/<AiChatAvatar/g) ?? []).length;
    expect(avatarsAtChatStart).toBe(1);
  });

  it("[a11y] the header avatar carries no id, and the removed hero avatar was always aria-hidden with no id — nothing depended on it for an accessible name", () => {
    expect(avatarSrc).toContain('aria-hidden="true"');
    expect(avatarSrc).not.toMatch(/\bid=/);
    // the panel's own aria-label already composes the full identity independent of the avatar mark
    expect(panelSrc).toContain("aria-label={`${t.aiChat.name} ${t.aiChat.role}`}");
  });
});

describe("AC-2 — mobile full-screen geometry (CAM-550) stays intact — regression guard, not a re-fix", () => {
  it("[structural] the max-sm full-screen override classes are still present (unchanged by this story)", () => {
    expect(panelSrc).toContain("max-sm:inset-x-0 max-sm:top-0 max-sm:bottom-auto max-sm:h-[100dvh] max-sm:max-h-[100dvh]");
  });

  it("[unit] this story's own real-browser verification is documented (see the file header + PR body) — no re-fix landed in this diff for item 2", () => {
    expect(panelSrc).toContain("CAM-541 (owner feedback, 3 fixes");
    expect(panelSrc).toContain("Mobile overlap: CAM-550 (just merged) already made the panel true");
  });
});

describe("AC-3/BR-2 — the orange aura ring is dimmer, same hue/lightness family (CAM-432 identity preserved)", () => {
  it("[normal] --ai-flame-aura's alpha values are lower than the pre-CAM-541 values in both themes", () => {
    const lightStart = globalsCss.indexOf("--ai-flame-aura:");
    const auraBlockLight = globalsCss.slice(lightStart, globalsCss.indexOf(";", lightStart));
    const darkStart = globalsCss.lastIndexOf("--ai-flame-aura:");
    const auraBlockDark = globalsCss.slice(darkStart, globalsCss.indexOf(";", darkStart));
    // pre-CAM-541 light alphas were 0.28/0.45/0.28; pre-CAM-541 dark were 0.38/0.55/0.32
    const lightAlphas = [...auraBlockLight.matchAll(/\/\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
    const darkAlphas = [...auraBlockDark.matchAll(/\/\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(lightAlphas).toHaveLength(3);
    expect(darkAlphas).toHaveLength(3);
    expect(lightAlphas.every((a) => a < 0.28)).toBe(true);
    expect(darkAlphas.every((a) => a < 0.38)).toBe(true);
    // still a real, visible affordance — never fully transparent
    expect(lightAlphas.every((a) => a > 0)).toBe(true);
    expect(darkAlphas.every((a) => a > 0)).toBe(true);
  });

  it("[structural] hue/lightness family is unchanged (CAM-432's own pin: oklch(0.7[28]0 still matches)", () => {
    expect(globalsCss).toMatch(/oklch\(0\.7[28]0/);
  });

  it("[structural] not measured by scripts/check-contrast.mjs — a decorative aria-hidden shadow, no enforced-pair conflict introduced", () => {
    const hasFlameAuraPair = ENFORCED_PAIRS.some(
      (p: { fg: string; bg: string }) => p.fg.includes("flame-aura") || p.bg.includes("flame-aura")
    );
    expect(hasFlameAuraPair).toBe(false);
  });
});

describe("Zero debug/demo UI (quality bar)", () => {
  it("no console.log / JSON.stringify dump in the touched files", () => {
    for (const src of [panelSrc, listSrc, avatarSrc]) {
      expect(src).not.toContain("console.log");
      expect(src).not.toContain("JSON.stringify");
    }
  });

  it("[structural] no stray hex introduced in the touched .tsx files", () => {
    for (const src of [panelSrc, listSrc, avatarSrc]) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
