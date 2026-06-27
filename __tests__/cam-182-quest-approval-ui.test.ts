/**
 * CAM-182 — Quest UI: Approval Notification + Approval Card redesign.
 *
 * Layer: unit (static source analysis, fs.readFileSync — no DOM renderer).
 *
 * AC coverage:
 *   AC-notify-1   .you-alert uses BellRing lucide icon (no &#9873; glyph, no .adot)
 *   AC-notify-2   .you-alert font-size is 13px
 *   AC-notify-3   .you-alert padding is 7px 14px
 *   AC-notify-4   .you-alert box-shadow includes the 1.5px amber ring
 *   AC-notify-5   .adot CSS rules removed (dead CSS gone)
 *   AC-notify-6   pdot3 keyframe removed (dead animation gone)
 *   AC-notify-7   alertPulse remains + gated under prefers-reduced-motion:no-preference
 *   AC-card-1     ApprovalCard uses ClipboardCheck (no AlertTriangle in JSX)
 *   AC-card-2     AlertTriangle removed from campsite-overlays import
 *   AC-card-3     apprCardGlow keyframe present in HUD_CSS
 *   AC-card-4     apprCardGlow wrapped in prefers-reduced-motion:no-preference
 *   AC-card-5     amber crown ::before stripe on .hud-appr-head
 *   AC-card-6     .hud-appr-card has animation:apprCardGlow
 *   AC-card-7     heading font-size bumped to 11.5px
 *   AC-card-8     item title font-size bumped to 12.5px
 *   AC-card-9     badge font-size bumped to 10.5px
 *   AC-card-10    .hud-appr-btn has min-height:44px (tap-floor fix)
 *   AC-card-11    border bumped to 1.5px rgba(255,190,80,.32)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const sceneSrc = read("app/status/map/campsite-scene.tsx");
const overlaySrc = read("app/status/map/campsite-overlays.tsx");

// ── Part 1: Notification bubble (.you-alert) ─────────────────────────────────

describe("CAM-182 AC-notify-1: .you-alert uses BellRing lucide icon", () => {
  it("imports BellRing from lucide-react in campsite-scene", () => {
    expect(sceneSrc).toMatch(/import.*\bBellRing\b.*from ["']lucide-react["']/);
  });

  it("renders <BellRing in the you-alert JSX", () => {
    expect(sceneSrc).toContain("<BellRing");
  });

  it("does NOT contain the &#9873; Unicode glyph", () => {
    expect(sceneSrc).not.toContain("&#9873;");
  });

  it("does NOT render .adot DOM div as icon (removed)", () => {
    // The span.adot is gone from the you-alert markup
    expect(sceneSrc).not.toContain('className="adot"');
  });
});

describe("CAM-182 AC-notify-2: .you-alert font-size (updated by CAM-184 to 12px)", () => {
  it(".you-alert CSS has font-size — 13px from CAM-182, reduced to 12px by CAM-184", () => {
    // CAM-182 set font-size:13px; CAM-184 reduced it to 12px.
    // Assert the current value that guards against accidental revert:
    const match = sceneSrc.match(/\.you-alert\{[\s\S]*?font-size:12px/);
    expect(match).not.toBeNull();
  });
});

describe("CAM-182 AC-notify-3: .you-alert padding (updated by CAM-184 to 5px 11px)", () => {
  it(".you-alert CSS has padding — 7px 14px from CAM-182, reduced to 5px 11px by CAM-184", () => {
    // CAM-182 set padding:7px 14px; CAM-184 reduced it to 5px 11px.
    expect(sceneSrc).toContain("padding:5px 11px");
  });
});

describe("CAM-182 AC-notify-4: .you-alert box-shadow includes amber ring", () => {
  it(".you-alert box-shadow has 0 0 0 1.5px rgba(255,180,84,.55) ring", () => {
    expect(sceneSrc).toContain("0 0 0 1.5px rgba(255,180,84,.55)");
  });

  it(".you-alert box-shadow has deeper amber outer glow", () => {
    expect(sceneSrc).toContain("0 10px 28px -4px rgba(255,150,52,.7)");
  });
});

describe("CAM-182 AC-notify-5: .adot CSS rules removed (no dead CSS)", () => {
  it(".you-alert .adot rule is gone from SCENE_CSS", () => {
    // The old rule: .you-alert .adot{width:7px;height:7px...}
    expect(sceneSrc).not.toContain(".you-alert .adot");
  });
});

describe("CAM-182 AC-notify-6: pdot3 keyframe removed (no dead animation)", () => {
  it("pdot3 keyframe is gone from SCENE_CSS", () => {
    expect(sceneSrc).not.toContain("pdot3");
  });
});

describe("CAM-182 AC-notify-7: alertPulse preserved + reduced-motion gated", () => {
  it("alertPulse keyframe still present", () => {
    expect(sceneSrc).toContain("alertPulse");
  });

  it(".you-alert animation still uses alertPulse", () => {
    expect(sceneSrc).toContain("animation:alertPulse");
  });

  it("alertPulse appears after a prefers-reduced-motion:no-preference @media open brace", () => {
    // Find position of the no-preference open and alertPulse — they must overlap
    // (alertPulse is between the @media open and its matching close).
    const noMotionIdx = sceneSrc.indexOf("prefers-reduced-motion: no-preference");
    const alertPulseIdx = sceneSrc.indexOf("alertPulse");
    expect(noMotionIdx).toBeGreaterThan(-1);
    expect(alertPulseIdx).toBeGreaterThan(noMotionIdx);
  });
});

// ── Part 2: Approval Card (ApprovalCard / .hud-appr-*) ───────────────────────

describe("CAM-182 AC-card-1: ApprovalCard uses ClipboardCheck (no AlertTriangle)", () => {
  it("ApprovalCard JSX renders <ClipboardCheck", () => {
    expect(overlaySrc).toContain("<ClipboardCheck");
  });

  it("ApprovalCard JSX does NOT render <AlertTriangle", () => {
    // AlertTriangle must be gone from all JSX in the file
    expect(overlaySrc).not.toMatch(/<AlertTriangle\b/);
  });
});

describe("CAM-182 AC-card-2: AlertTriangle removed from import", () => {
  it("AlertTriangle is NOT in the lucide-react import", () => {
    expect(overlaySrc).not.toContain("AlertTriangle");
  });
});

describe("CAM-182 AC-card-3: apprCardGlow keyframe present in HUD_CSS", () => {
  it("@keyframes apprCardGlow is defined", () => {
    expect(overlaySrc).toContain("apprCardGlow");
    expect(overlaySrc).toContain("@keyframes apprCardGlow");
  });

  it("apprCardGlow keyframe has amber glow at 50% (low intensity ~18px)", () => {
    expect(overlaySrc).toContain("rgba(255,160,52,.22)");
  });
});

describe("CAM-182 AC-card-4: apprCardGlow gated under prefers-reduced-motion:no-preference", () => {
  it("apprCardGlow keyframe is inside a prefers-reduced-motion:no-preference media block", () => {
    // Verify both the keyframe and the animation rule are inside the no-preference guard
    expect(overlaySrc).toContain("prefers-reduced-motion: no-preference");
    // The keyframe must appear inside the block
    const noMotionBlocks = [...overlaySrc.matchAll(
      /@media\s*\(\s*prefers-reduced-motion:\s*no-preference\s*\)\s*\{([\s\S]*?)\}/g
    )];
    const found = noMotionBlocks.some(m => m[1].includes("apprCardGlow"));
    expect(found).toBe(true);
  });

  it(".hud-appr-card animation is inside prefers-reduced-motion:no-preference", () => {
    const noMotionBlocks = [...overlaySrc.matchAll(
      /@media\s*\(\s*prefers-reduced-motion:\s*no-preference\s*\)\s*\{([\s\S]*?)\}/g
    )];
    const found = noMotionBlocks.some(m => m[1].includes("animation:apprCardGlow"));
    expect(found).toBe(true);
  });
});

describe("CAM-182 AC-card-5: amber crown ::before stripe on .hud-appr-head", () => {
  it(".hud-appr-head::before has amber gradient crown", () => {
    expect(overlaySrc).toContain(".hud-appr-head::before");
    expect(overlaySrc).toContain("rgba(255,180,84,.6)");
  });

  it("crown stripe is 2px height", () => {
    expect(overlaySrc).toContain("height:2px");
  });
});

describe("CAM-182 AC-card-6: .hud-appr-card has animation:apprCardGlow reference", () => {
  it(".hud-appr-card CSS refers to animation:apprCardGlow", () => {
    expect(overlaySrc).toContain("animation:apprCardGlow");
  });
});

describe("CAM-182 AC-card-7: heading font-size (updated by CAM-184 to 12px)", () => {
  it(".hud-appr-heading font-size is 12px (CAM-182 set 11.5px; CAM-184 raised it to 12px + weight 800)", () => {
    // CAM-182 set font-size:11.5px; CAM-184 updated to 12px + font-weight:800.
    expect(overlaySrc).toMatch(/\.hud-appr-heading\{[^}]*font-size:12px/);
  });
});

describe("CAM-182 AC-card-8: item title font-size bumped to 12.5px", () => {
  it(".hud-appr-title font-size is 12.5px", () => {
    expect(overlaySrc).toMatch(/\.hud-appr-title\{[^}]*font-size:12\.5px/);
  });
});

describe("CAM-182 AC-card-9: badge removed by CAM-184", () => {
  it(".hud-appr-badge CSS block is absent (removed by CAM-184 design spec)", () => {
    // CAM-182 added .hud-appr-badge at 10.5px; CAM-184 removed it entirely per design.md.
    expect(overlaySrc).not.toMatch(/\.hud-appr-badge\{/);
  });
});

describe("CAM-182 AC-card-10: .hud-appr-btn has min-height:44px", () => {
  it(".hud-appr-btn CSS has min-height:44px", () => {
    expect(overlaySrc).toContain("min-height:44px");
  });
});

describe("CAM-182 AC-card-11: border bumped to 1.5px rgba(255,190,80,.32)", () => {
  it(".hud-appr-card has 1.5px solid rgba(255,190,80,.32) border", () => {
    expect(overlaySrc).toContain("1.5px solid rgba(255,190,80,.32)");
  });
});
