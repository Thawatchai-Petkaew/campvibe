/**
 * cam-432-fire-aura-flicker.test.ts — CAM-432
 *
 * "น้องกองไฟ fire aura + flicker (launcher + in-chat avatar) + reposition
 * launcher" — owner staging feedback + reference image. Full spec:
 * docs/specs/ai-assistant/chat-experience-overhaul/CAM-432-fire-aura-flicker/story.md
 *
 * Source-inspection coverage (this repo's Vitest config runs
 * `environment: 'node'` with no jsdom — see cam-272-ai-chat-components
 * .test.ts for the established convention); rendered-DOM/animation
 * behaviour is proven by reading the shipped source for the exact
 * token/motion wiring the AC rows require.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const avatarSrc = read("components/ai-chat/AiChatAvatar.tsx");
const launcherSrc = read("components/ai-chat/AiChatLauncher.tsx");
const globalsCss = read("app/globals.css");
const designMd = read("DESIGN.md");

describe("AC-1 — the mark's disc/glow is fire-toned, not teal --primary", () => {
  it("[unit] the avatar chip retints to bg-ai-ember/10 (no live bg-primary/10 className left; old value may survive only in a traceability doc-comment)", () => {
    expect(avatarSrc).toContain("rounded-full bg-ai-ember/10");
    expect(avatarSrc).not.toMatch(/className=\{`[^`]*bg-primary\/10[^`]*`\}/);
  });

  it("[unit] the launcher FAB retints to bg-ai-ember/10 with a matching hover tint (no live teal bg-primary / shadow-ai-glow className left)", () => {
    expect(launcherSrc).toContain("bg-ai-ember/10 hover:bg-ai-ember/20");
    expect(launcherSrc).not.toMatch(/className="[^"]*shadow-ai-glow[^"]*"/);
  });

  it("[unit] the Flame lucide icon is unchanged (still text-ai-ember + fill-current) on both surfaces", () => {
    for (const src of [avatarSrc, launcherSrc]) {
      expect(src).toContain("fill-current text-ai-ember");
    }
  });
});

describe("AC-2 — a VISIBLE fire-toned aura ring/halo token exists (globals.css)", () => {
  it("[unit] --ai-flame-aura is declared in :root (light) and .dark, distinct from --ai-glow", () => {
    const occurrences = (globalsCss.match(/--ai-flame-aura:/g) || []).length;
    expect(occurrences).toBe(2); // :root + .dark
  });

  it("[unit] --ai-flame-aura maps to the shadow-ai-flame-aura Tailwind utility", () => {
    expect(globalsCss).toContain("--shadow-ai-flame-aura: var(--ai-flame-aura);");
  });

  it("[unit] the aura is built from --ai-ember / --ai-firefly only (fire-toned, no teal/sky hue reused)", () => {
    const auraBlock = globalsCss.slice(
      globalsCss.indexOf("--ai-flame-aura:"),
      globalsCss.indexOf("--ai-flame-aura:") + 400
    );
    expect(auraBlock).toMatch(/oklch\(0\.7[28]0/); // ember-family lightness (light 0.720 / dark 0.780)
  });
});

describe("AC-3 — ai-flame-flicker keyframe: visible วูบวาบ loop, static under reduce-motion", () => {
  it("[unit] the keyframe exists (opacity + brightness + scale oscillation)", () => {
    expect(globalsCss).toContain("@keyframes ai-flame-flicker");
    const kf = globalsCss.slice(
      globalsCss.indexOf("@keyframes ai-flame-flicker"),
      globalsCss.indexOf("@keyframes ai-materialize")
    );
    expect(kf).toMatch(/opacity:/);
    expect(kf).toMatch(/filter: brightness/);
    expect(kf).toMatch(/transform: scale/);
  });

  it("[unit] the .ai-flame-flicker utility is gated inside prefers-reduced-motion: no-preference", () => {
    // lastIndexOf: the ambient-loop no-preference block is the SECOND occurrence
    // of this media query in the file (the first gates the skeleton fade-in).
    const motionSafeBlock = globalsCss.slice(
      globalsCss.lastIndexOf("@media (prefers-reduced-motion: no-preference)"),
      globalsCss.indexOf("@keyframes ai-aurora-drift")
    );
    expect(motionSafeBlock).toContain(".ai-flame-flicker {");
    expect(motionSafeBlock).toContain("animation: ai-flame-flicker");
  });

  it("[unit] reduce-motion turns ai-flame-flicker off (static, no animation) alongside the other 3 named loops", () => {
    const reduceBlock = globalsCss.slice(globalsCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduceBlock).toContain(".ai-flame-flicker");
    expect(reduceBlock).toContain(".ai-aurora-drift");
    expect(reduceBlock).toContain(".ai-flame-glow");
    expect(reduceBlock).toContain(".ai-materialize");
    expect(reduceBlock).toContain("animation: none;");
  });
});

describe("AC-4 — both surfaces wire a decorative aura span behind the mark", () => {
  // CAM-435 (R2 owner staging feedback, SUPERSEDES this AC's ai-flame-flicker-by-default):
  // persistent marks (this avatar's default 'calm' intensity, the launcher FAB) now use the
  // gentler ai-flame-glow aura; ai-flame-flicker is reserved for AiChatAvatar's
  // intensity="loading" branch only (asserted in cam-433-loading-flame.test.ts / the
  // resuming indicator). Same shadow-ai-flame-aura token, no new keyframe/token.
  it("[unit] AiChatAvatar: a -z-10 aria-hidden-parent, pointer-events-none span carries shadow-ai-flame-aura + a motion class driven by the intensity prop (ai-flame-glow default, ai-flame-flicker when loading)", () => {
    expect(avatarSrc).toContain(
      'className={`pointer-events-none absolute inset-0 -z-10 rounded-full shadow-ai-flame-aura ${auraMotionClass}`}'
    );
    expect(avatarSrc).toContain('intensity === "loading" ? "ai-flame-flicker" : "ai-flame-glow"');
    // the outer wrapper is already aria-hidden, and must be position:relative so inset-0 resolves correctly
    expect(avatarSrc).toContain('className={`relative flex shrink-0 items-center justify-center rounded-full bg-ai-ember/10 ${wrapper}`}');
  });

  it("[unit] AiChatLauncher: a -z-10 aria-hidden + pointer-events-none span carries shadow-ai-flame-aura + the calm ai-flame-glow pulse (persistent FAB, CAM-435)", () => {
    expect(launcherSrc).toMatch(
      /aria-hidden="true"\s*\n\s*className="pointer-events-none absolute inset-0 -z-10 rounded-full shadow-ai-flame-aura ai-flame-glow"/
    );
  });

  it("[unit] the aura span never intercepts a tap (pointer-events-none) and never confuses AT (aria-hidden or aria-hidden parent)", () => {
    expect(avatarSrc).toContain("pointer-events-none");
    expect(launcherSrc).toContain("pointer-events-none");
  });
});

describe("AC-5 — launcher repositioned up for easier thumb reach", () => {
  it("[unit] the wrapper div moved from bottom-6 to bottom-10 right-6 (no live bottom-6/bottom-24 className)", () => {
    expect(launcherSrc).toContain('<div className="fixed bottom-10 right-6 z-50">');
    expect(launcherSrc).not.toMatch(/className="fixed bottom-6 right-6 z-50"/);
    expect(launcherSrc).not.toMatch(/className="[^"]*bottom-24[^"]*"/);
  });

  it("[unit] the FAB stays a circular control with a tap target >= 44px (h-12 w-12 = 48px, unchanged)", () => {
    expect(launcherSrc).toContain("h-12 w-12 rounded-full");
  });
});

describe("AC-6 — DESIGN.md §2.1 records the ai-flame-flicker exception + the new closed token", () => {
  it("[unit] the closed --ai-* token set line now includes --ai-flame-aura", () => {
    expect(designMd).toContain(
      "`--ai-surface`, `--ai-tint`, `--ai-glow`,\n`--ai-gradient`, `--ai-ember`, `--ai-firefly`, `--ai-star`, `--ai-flame-aura`"
    );
  });

  it("[unit] the Motion-within-the-exception prose names ai-flame-flicker as owner-requested, CAM-432, assistant-mark-only", () => {
    expect(designMd).toContain("ai-flame-flicker");
    expect(designMd).toContain("CAM-432");
    expect(designMd).toContain("Four named loops");
    expect(designMd).toContain("assistant น้องกองไฟ mark only");
  });
});

describe("Standing rules — lucide only, no emoji, token-only (design gate)", () => {
  it("[structural] no emoji literal in the touched files", () => {
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const src of [avatarSrc, launcherSrc]) expect(emojiPattern.test(src)).toBe(false);
  });

  it("[structural] token-only: no stray hex/px literal introduced in the touched .tsx files", () => {
    for (const src of [avatarSrc, launcherSrc]) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(src).not.toMatch(/\[\d+px\]/);
    }
  });

  it("[design-gate] no shadow-xl / shadow-xs / shadow-inner (R2 off-tier shadow) introduced", () => {
    for (const src of [avatarSrc, launcherSrc]) {
      expect(src).not.toMatch(/\b(shadow-xl|shadow-xs|shadow-inner)\b/);
    }
  });
});
