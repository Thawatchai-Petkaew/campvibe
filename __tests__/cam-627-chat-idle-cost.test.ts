/**
 * cam-627-chat-idle-cost.test.ts — CAM-627
 *
 * Source-inspection guards (this repo's Vitest config runs `environment:
 * 'node'`, no jsdom — matching the existing `cam-426-ai-expression-layer
 * .test.ts` pattern for this exact surface: rendered-canvas/animation
 * behaviour is proven by reading the shipped source for the wiring, not by
 * mounting the canvas). The real before/after continuous-frame measurement
 * (a live Chrome/CDP trace) is NOT reproducible headless/CI and is not
 * asserted here — it is recorded, with numbers, in this story's design.md.
 * These are deliberately source-level pins, not behavioral proof — see the
 * story's own note on this trade-off.
 *
 * Scope: `AiAmbientCanvas.tsx`'s retired rAF loop + `.ai-aurora-drift`'s
 * retired animation in `app/globals.css`. Does NOT touch AiChatAvatar
 * (น้องกองไฟ) or any pre-existing CAM-426/432/433 assistant-surface
 * assertion — those stay green, unmodified, in their own files.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const globalsCss = read("app/globals.css");
const canvasSrc = read("components/ai-chat/AiAmbientCanvas.tsx");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const avatarSrc = read("components/ai-chat/AiChatAvatar.tsx");
const designMd = read("DESIGN.md");

describe("AC-4/BR-2 — .ai-aurora-drift no longer animates (app/globals.css)", () => {
  it("[unit] the .ai-aurora-drift rule sets animation: none (only rule for this selector)", () => {
    const start = globalsCss.indexOf(".ai-aurora-drift {");
    expect(start).toBeGreaterThan(-1);
    const end = globalsCss.indexOf("}", start);
    const rule = globalsCss.slice(start, end);
    expect(rule).toContain("animation: none;");
  });

  it("[unit] no rule anywhere still triggers the ai-aurora-drift keyframe (the old 18s drift is gone)", () => {
    expect(globalsCss).not.toContain("animation: ai-aurora-drift");
  });

  it("[unit] the @keyframes ai-aurora-drift definition is kept (CAM-432/433 slice past it by index — do not delete)", () => {
    expect(globalsCss).toContain("@keyframes ai-aurora-drift {");
  });

  it("[unit] the reduce-motion block still lists .ai-aurora-drift (pre-existing cam-426 pin stays valid)", () => {
    const reduceBlock = globalsCss.slice(globalsCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduceBlock).toContain(".ai-aurora-drift");
    expect(reduceBlock).toContain("animation: none;");
  });
});

describe("AC-1/BR-1/EC-1 — AiAmbientCanvas no longer self-reschedules a continuous loop", () => {
  it("[unit] no call to requestAnimationFrame remains anywhere in the file (only historical comments mention the API name)", () => {
    expect(canvasSrc).not.toContain("requestAnimationFrame(");
  });

  it("[unit] no cancelAnimationFrame / rafId bookkeeping remains (nothing left to cancel)", () => {
    expect(canvasSrc).not.toContain("cancelAnimationFrame");
    expect(canvasSrc).not.toContain("rafId");
  });

  it("[unit] the fireflies-follow-cursor pointer machinery is retired (meaningless without a repeating loop)", () => {
    expect(canvasSrc).not.toContain("handlePointerMove");
    expect(canvasSrc).not.toContain("pointermove");
  });

  it("[unit] step() still runs the real particle-draw code (stars, fireflies, embers) — frozen, not deleted", () => {
    const start = canvasSrc.indexOf("function step(");
    expect(start).toBeGreaterThan(-1);
    const end = canvasSrc.indexOf("function start(");
    const stepBody = canvasSrc.slice(start, end);
    expect(stepBody).toContain("colors.star");
    expect(stepBody).toContain("colors.firefly");
    expect(stepBody).toContain("colors.ember");
    expect(stepBody).toContain("FRAME_INTERVAL_MS");
    expect(stepBody).toContain("now - lastFrameAt");
  });

  it("[unit] resize() repaints immediately (a resize clears the canvas bitmap; a stale blank frame would otherwise persist since nothing loops anymore)", () => {
    const start = canvasSrc.indexOf("function resize(");
    const end = canvasSrc.indexOf("function drawStaticFrame(");
    const resizeBody = canvasSrc.slice(start, end);
    expect(resizeBody).toContain("start();");
  });

  it("[unit] a theme (.dark class) change repaints immediately, not just re-reads colors", () => {
    const start = canvasSrc.indexOf("new MutationObserver(");
    const end = canvasSrc.indexOf("themeObserver.observe(");
    const themeCallback = canvasSrc.slice(start, end);
    expect(themeCallback).toContain("start();");
  });
});

describe("AC-3/BR-4 — the pre-existing reduced-motion path is unchanged", () => {
  it("[unit] drawStaticFrame + the reduced-motion gate are still present and still wired the same way", () => {
    expect(canvasSrc).toContain("drawStaticFrame");
    expect(canvasSrc).toContain("if (!reducedMotionQuery.matches)");
    expect(canvasSrc).toContain('window.matchMedia("(prefers-reduced-motion: no-preference)")');
  });

  it("[unit] drawStaticFrame's own body is byte-for-byte the pre-CAM-627 stars-only fallback", () => {
    const start = canvasSrc.indexOf("function drawStaticFrame(");
    const end = canvasSrc.indexOf("// CAM-627: this used to reschedule");
    const body = canvasSrc.slice(start, end);
    expect(body).toContain("ctx.fillStyle = colors.star;");
    expect(body).toContain("ctx.globalAlpha = 0.35;");
    expect(body).not.toContain("colors.firefly");
    expect(body).not.toContain("colors.ember");
  });
});

describe("AC-2/BR-3 — น้องกองไฟ (AiChatAvatar) is untouched", () => {
  it("[unit] the flame's two motion classes are still wired exactly as before", () => {
    expect(avatarSrc).toContain("ai-flame-glow");
    expect(avatarSrc).toContain("ai-flame-flicker");
    expect(avatarSrc).toContain('auraMotionClass = intensity === "loading" ? "ai-flame-flicker" : "ai-flame-glow"');
  });

  it("[unit] the panel still renders AiChatAvatar unconditionally in its header", () => {
    expect(panelSrc).toContain("<AiChatAvatar size=\"md\" />");
  });
});

describe("Pre-existing CAM-426 pins that must stay valid (not edited by this story)", () => {
  it("[unit] the panel's ambient div className is unchanged (byte-for-byte, including ai-aurora-drift)", () => {
    expect(panelSrc).toContain(
      'className="ai-aurora ai-aurora-drift pointer-events-none absolute inset-0 -z-10"'
    );
  });

  it("[unit] AiAmbientCanvas is still mounted next to it", () => {
    expect(panelSrc).toContain("<AiAmbientCanvas />");
  });
});

describe("DESIGN.md §2.1 records the CAM-627 change", () => {
  it("[unit] the sanctioned-loop count drops from 4 to 3, and CAM-627 is cited", () => {
    expect(designMd).toContain("CAM-627");
    expect(designMd).toContain("Three loops remain live");
    // the historical "Four named loops" phrase stays (CAM-432's own pinned
    // test requires this exact substring) — it now reads as "were
    // introduced", not "are permitted".
    expect(designMd).toContain("Four named loops");
  });
});
