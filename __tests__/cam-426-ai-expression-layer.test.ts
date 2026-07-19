/**
 * cam-426-ai-expression-layer.test.ts — CAM-426
 *
 * Source-inspection guards for the น้องกองไฟ AI Expression Layer (design.md
 * §1/§2/§3, DESIGN.md §2.1 sanctioned exception). This repo's Vitest config
 * runs `environment: 'node'` with no jsdom (see cam-272-ai-chat-components
 * .test.ts) — rendered-canvas/animation behaviour is proven by reading the
 * shipped source for the exact perf/a11y/motion wiring the spec requires.
 *
 * Scope: globals.css tokens + utilities, DESIGN.md §2.1 exception prose,
 * AiAmbientCanvas perf/a11y/motion contract, and the glass-surface / bubble
 * token wiring in AiChatPanel / AiChatAvatar / AiChatMessageList. Does NOT
 * cover AiChatCampCard / AiChatDetailCard — out of this story's scope.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const globalsCss = read("app/globals.css");
const designMd = read("DESIGN.md");
const canvasSrc = read("components/ai-chat/AiAmbientCanvas.tsx");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const avatarSrc = read("components/ai-chat/AiChatAvatar.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");

describe("app/globals.css — the closed --ai-* token set (light + dark) + utilities", () => {
  it("[unit] declares all 7 --ai-* custom properties in :root (light)", () => {
    for (const token of ["--ai-surface:", "--ai-tint:", "--ai-glow:", "--ai-gradient:", "--ai-ember:", "--ai-firefly:", "--ai-star:"]) {
      expect(globalsCss).toContain(token);
    }
  });

  it("[unit] declares the same 7 tokens a second time (.dark overrides)", () => {
    const occurrences = (globalsCss.match(/--ai-surface:/g) || []).length;
    expect(occurrences).toBe(2); // :root + .dark
  });

  it("[unit] maps every --ai-* token to a @theme inline utility (bg-ai-*, shadow-ai-glow)", () => {
    expect(globalsCss).toContain("--color-ai-surface: var(--ai-surface);");
    expect(globalsCss).toContain("--color-ai-tint: var(--ai-tint);");
    expect(globalsCss).toContain("--color-ai-ember: var(--ai-ember);");
    expect(globalsCss).toContain("--color-ai-firefly: var(--ai-firefly);");
    expect(globalsCss).toContain("--color-ai-star: var(--ai-star);");
    expect(globalsCss).toContain("--shadow-ai-glow: var(--ai-glow);");
  });

  it("[unit] the .ai-aurora backdrop utility + the 3 named motion loops exist, gated behind prefers-reduced-motion", () => {
    expect(globalsCss).toContain(".ai-aurora {");
    expect(globalsCss).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(globalsCss).toContain(".ai-aurora-drift");
    expect(globalsCss).toContain(".ai-flame-glow");
    expect(globalsCss).toContain(".ai-materialize");
  });

  it("[unit] reduce-motion turns every named loop off (animation: none)", () => {
    const reduceBlock = globalsCss.slice(globalsCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduceBlock).toContain(".ai-aurora-drift");
    expect(reduceBlock).toContain(".ai-flame-glow");
    expect(reduceBlock).toContain(".ai-materialize");
    expect(reduceBlock).toContain("animation: none;");
  });
});

describe("DESIGN.md §2.1 — sanctioned exception is recorded", () => {
  it("[unit] the exception section exists, scoped to components/ai-chat/* only", () => {
    expect(designMd).toContain("### §2.1 Sanctioned exception — น้องกองไฟ AI Expression Layer (CAM-426)");
    expect(designMd).toContain("**Scope: the assistant surface ONLY** — `components/ai-chat/*`");
  });

  it("[unit] names the closed token set and the readability constraint", () => {
    expect(designMd).toContain("`--ai-surface`, `--ai-tint`, `--ai-glow`,\n`--ai-gradient`, `--ai-ember`, `--ai-firefly`, `--ai-star`");
    expect(designMd).toContain("**Readability is the binding constraint:**");
  });
});

describe("AiAmbientCanvas — decorative, perf-capped, motion-gated, token-read (design.md §3)", () => {
  it("[unit/a11y] is aria-hidden + pointer-events-none + role=presentation (carries no information)", () => {
    expect(canvasSrc).toContain('aria-hidden="true"');
    expect(canvasSrc).toContain('role="presentation"');
    expect(canvasSrc).toContain("pointer-events-none");
  });

  it("[unit] gates the render loop on prefers-reduced-motion and re-checks on the change event", () => {
    expect(canvasSrc).toContain("prefers-reduced-motion: no-preference");
    expect(canvasSrc).toContain("window.matchMedia(");
    expect(canvasSrc).toContain('reducedMotionQuery.addEventListener("change"');
  });

  it("[unit] renders a static frame (no rAF) when reduced motion is preferred", () => {
    expect(canvasSrc).toContain("drawStaticFrame");
    expect(canvasSrc).toContain("if (!reducedMotionQuery.matches)");
  });

  it("[unit] pauses on hidden tab via visibilitychange", () => {
    expect(canvasSrc).toContain('document.addEventListener("visibilitychange"');
    expect(canvasSrc).toContain("document.hidden");
  });

  it("[unit] throttles to ~30fps via a delta accumulator (no per-frame particle allocation)", () => {
    expect(canvasSrc).toContain("FRAME_INTERVAL_MS");
    expect(canvasSrc).toContain("now - lastFrameAt");
  });

  it("[unit] caps DPR at 2 and halves particle counts on narrow viewport / low-core devices", () => {
    expect(canvasSrc).toContain("Math.min(window.devicePixelRatio || 1, 2)");
    expect(canvasSrc).toContain("navigator.hardwareConcurrency");
    expect(canvasSrc).toContain("NARROW_BREAKPOINT_PX");
  });

  it("[unit] reads particle colors from CSS custom properties, never a hardcoded literal", () => {
    expect(canvasSrc).toContain("getComputedStyle(document.documentElement)");
    expect(canvasSrc).toContain('"--ai-ember"');
    expect(canvasSrc).toContain('"--ai-firefly"');
    expect(canvasSrc).toContain('"--ai-star"');
    expect(canvasSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(canvasSrc).not.toMatch(/oklch\(/);
  });

  it("[unit] re-reads theme colors on a .dark class change via MutationObserver", () => {
    expect(canvasSrc).toContain("new MutationObserver(");
    expect(canvasSrc).toContain('attributeFilter: ["class"]');
  });

  it("[unit] mounted only via next/dynamic(ssr:false) from the panel — never part of the critical first-load chunk", () => {
    expect(panelSrc).toContain('import dynamic from "next/dynamic"');
    expect(panelSrc).toContain("const AiAmbientCanvas = dynamic(");
    expect(panelSrc).toContain("{ ssr: false, loading: () => null }");
  });
});

describe("AiChatPanel — the glass surface + ambient backdrop (DESIGN.md §2.1)", () => {
  it("[unit] the panel shell uses bg-ai-surface + backdrop-blur-xl + shadow-ai-glow (not bg-popover/shadow-2xl)", () => {
    expect(panelSrc).toContain("bg-ai-surface shadow-ai-glow outline-none backdrop-blur-xl");
    // the old surface classes only survive as a traceability doc-comment, never as a live className
    expect(panelSrc).not.toMatch(/className=.*bg-popover shadow-2xl/);
  });

  it("[unit] the ambient backdrop (.ai-aurora + AiAmbientCanvas) is aria-hidden, pointer-events-none, and behind content", () => {
    expect(panelSrc).toContain('className="ai-aurora ai-aurora-drift pointer-events-none absolute inset-0 -z-10"');
    expect(panelSrc).toContain("<AiAmbientCanvas />");
  });

  it("[unit] readable content (header/list/composer) sits in a relative z-10 wrapper above the ambient (CAM-451: now the push-track viewport, restructured from a single flex column into two absolute-inset panes)", () => {
    // CAM-453: the track's className moved from a bare string literal to a
    // cn(...) call (it also forks a desktop-split row layout on `expanded`);
    // the base classes themselves are unchanged.
    expect(panelSrc).toContain('"relative z-10 h-full min-h-0 overflow-hidden"');
  });

  it("[design-gate] no shadow-xl anywhere in the ai-chat surface (R2 off-tier shadow)", () => {
    for (const src of [panelSrc, avatarSrc, listSrc, canvasSrc]) {
      expect(src).not.toMatch(/\bshadow-xl\b/);
    }
  });
});

describe("AiChatAvatar — the flame recolors to the warm ember token + dim pulse", () => {
  it("[unit] the flame uses text-ai-ember + fill-current + the ai-flame-glow pulse", () => {
    expect(avatarSrc).toContain("text-ai-ember");
    expect(avatarSrc).toContain("fill-current");
    expect(avatarSrc).toContain("ai-flame-glow");
  });

  it("[unit] CAM-432: the chip background retints to fire-toned bg-ai-ember/10 (was teal bg-primary/10) with a visible aura halo behind it", () => {
    expect(avatarSrc).toContain("rounded-full bg-ai-ember/10");
    expect(avatarSrc).toContain("shadow-ai-flame-aura");
    expect(avatarSrc).toContain("ai-flame-flicker");
  });
});

describe("AiChatMessageList — assistant bubbles recolor bg-muted -> bg-ai-tint", () => {
  it("[unit] CAM-439 + CAM-443 SUPERSEDE for the answer + typing rows: only the rate-limited/disabled NOTICE rows use bg-ai-tint (2, not 4) — the answer is plain text on the panel glass and the typing dots carry no frame", () => {
    // CAM-430: rate-limited/disabled now interpolate ENTRANCE_MOTION_CLASS
    // straight into their own className (template-literal `className={\`...\`}`)
    // now that the avatar+bubble split is gone — match either quote style.
    const occurrences = (listSrc.match(/className="[^"]*bg-ai-tint[^"]*"|className=\{`[^`]*bg-ai-tint[^`]*`\}/g) || [])
      .length;
    expect(occurrences).toBe(2);
  });

  it("[unit] no assistant bubble still carries the old bg-muted fill", () => {
    expect(listSrc).not.toMatch(/rounded-2xl bg-muted\b/);
  });

  it("[unit] the user bubble is unchanged (bg-primary/text-primary-foreground) — distinguished by side + fill + avatar, not hue alone", () => {
    expect(listSrc).toContain("bg-primary px-4 py-2.5 text-sm text-primary-foreground");
  });
});
