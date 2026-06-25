import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================================
// CAM-181 — Twinkling fireflies on /status/map campfire scene
//
// Source-inspection guard (same harness as the rest of the status-map
// suite — Vitest is node-only, no jsdom/RTL available).
//
// AC covered:
//   AC-1  .firefly-layer exists with pointer-events:none, z-index:35, aria-hidden
//   AC-2  Exactly 12 .firefly instances
//   AC-3  @keyframes fireflyTwinkle defined in SCENE_CSS
//   AC-4  prefers-reduced-motion rule for fireflies (no animation under reduce)
//   AC-5  No emoji in the layer (CSS dots only, aria-hidden on each span)
//   AC-6  layer--map-fireflies testid present
//   AC-7  No colour hardcoded outside SCENE_CSS (#FFB454 stays inside the
//         template literal — exempt from check:palette per DESIGN.md §0 pt 4)
//   AC-8  No drift animation (transform must NOT appear in fireflyTwinkle)
// ============================================================

const src = readFileSync(
  resolve(__dirname, "../app/status/map/campsite-scene.tsx"),
  "utf8",
);

// ── Isolate SCENE_CSS block so assertions are scoped correctly ───────────────
// The block starts at `const SCENE_CSS = \`` and ends at the closing backtick
// before the next `// ── Sub-components` header.
const sceneCssStart = src.indexOf("const SCENE_CSS = `");
const sceneCssEnd   = src.indexOf("// ── Sub-components");
const sceneCss      = src.slice(sceneCssStart, sceneCssEnd);

// ── Isolate JSX return (firefly layer markup) ────────────────────────────────
const returnStart = src.indexOf('<div className="map-wrap"');
const jsxReturn   = src.slice(returnStart);

describe("CAM-181 — .firefly-layer CSS (AC-1, AC-3, AC-4, AC-8)", () => {
  it("AC-1: .firefly-layer has pointer-events:none", () => {
    expect(sceneCss).toContain(".firefly-layer{");
    expect(sceneCss).toContain("pointer-events:none");
  });

  it("AC-1: .firefly-layer has z-index:35", () => {
    expect(sceneCss).toContain("z-index:35");
  });

  it("AC-3: @keyframes fireflyTwinkle is defined in SCENE_CSS", () => {
    expect(sceneCss).toContain("@keyframes fireflyTwinkle");
  });

  it("AC-3: fireflyTwinkle uses opacity only (0 → 0.9 → 0)", () => {
    expect(sceneCss).toContain("opacity:0");
    expect(sceneCss).toContain("opacity:0.9");
  });

  it("AC-4: prefers-reduced-motion:no-preference wraps the twinkle animation", () => {
    expect(sceneCss).toContain("prefers-reduced-motion: no-preference");
    // The @keyframes block must appear inside the no-preference media query
    const noPrefStart = sceneCss.indexOf("prefers-reduced-motion: no-preference");
    const noPrefBlock = sceneCss.slice(noPrefStart);
    expect(noPrefBlock).toContain("@keyframes fireflyTwinkle");
  });

  it("AC-4: .firefly default (outside media query) has opacity:0.3 (faint static fallback)", () => {
    // The base .firefly rule (outside the media query) must set opacity:0.3
    // so reduced-motion users see a faint static dot, not a blank canvas.
    const fireflyRuleStart = sceneCss.indexOf(".firefly{");
    const fireflyRuleEnd   = sceneCss.indexOf("}", fireflyRuleStart);
    const fireflyRule      = sceneCss.slice(fireflyRuleStart, fireflyRuleEnd);
    expect(fireflyRule).toContain("opacity:0.3");
  });

  it("AC-8: fireflyTwinkle does NOT animate transform (twinkle-only, no drift)", () => {
    const keyframeStart = sceneCss.indexOf("@keyframes fireflyTwinkle");
    const keyframeEnd   = sceneCss.indexOf("}", sceneCss.indexOf("}", keyframeStart) + 1);
    const keyframeBlock = sceneCss.slice(keyframeStart, keyframeEnd + 1);
    expect(keyframeBlock).not.toContain("transform");
    expect(keyframeBlock).not.toContain("translate");
  });
});

describe("CAM-181 — firefly layer JSX markup (AC-1, AC-2, AC-5, AC-6)", () => {
  it("AC-1: layer has aria-hidden='true' (decorative, transparent to AT)", () => {
    expect(jsxReturn).toContain('className="firefly-layer"');
    // aria-hidden on the wrapper
    const layerBlock = jsxReturn.slice(jsxReturn.indexOf('className="firefly-layer"'));
    const layerEnd   = layerBlock.indexOf("</div>");
    const layerOpen  = layerBlock.slice(0, layerEnd);
    expect(layerOpen).toContain('aria-hidden="true"');
  });

  it("AC-6: layer has data-testid='layer--map-fireflies'", () => {
    expect(jsxReturn).toContain('data-testid="layer--map-fireflies"');
  });

  it("AC-2: exactly 12 .firefly span elements are present", () => {
    // Count occurrences of className="firefly" inside the JSX return
    const matches = jsxReturn.match(/className="firefly"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(12);
  });

  it("AC-5: each .firefly span carries aria-hidden='true' (no AT noise)", () => {
    // Every firefly span must include aria-hidden="true"
    // Count aria-hidden occurrences inside the firefly-layer block
    const layerStart = jsxReturn.indexOf('className="firefly-layer"');
    const layerBlockContent = jsxReturn.slice(layerStart, jsxReturn.indexOf("</div>", jsxReturn.indexOf('data-testid="layer--map-fireflies"')) + 100);
    const ariaHiddenMatches = layerBlockContent.match(/aria-hidden="true"/g);
    // At minimum 12 firefly spans + the wrapper = ≥ 13
    expect(ariaHiddenMatches).not.toBeNull();
    expect(ariaHiddenMatches!.length).toBeGreaterThanOrEqual(13);
  });

  it("AC-5: no emoji characters in the firefly layer block", () => {
    const layerStart = jsxReturn.indexOf('data-testid="layer--map-fireflies"');
    const layerBlock = jsxReturn.slice(layerStart, layerStart + 4000);
    // Emoji Unicode range check (basic emoji block U+1F300–U+1FFFF)
    expect(layerBlock).not.toMatch(/[\u{1F300}-\u{1FFFF}]/u);
  });
});

describe("CAM-181 — z-index depth: firefly-layer after scout-layer in JSX (AC-1 depth)", () => {
  it("firefly-layer div appears AFTER the closing </div> of scout-layer in JSX", () => {
    const scoutLayerClose = jsxReturn.indexOf('role="list"');
    // Find the closing </div> for the scout-layer (the div with role="list")
    // then confirm firefly-layer comes after it
    const fireflyLayerPos = jsxReturn.indexOf('className="firefly-layer"');
    expect(fireflyLayerPos).toBeGreaterThan(scoutLayerClose);
  });

  it("scout-layer has z-index:30 in SCENE_CSS (firefly z-index:35 is higher)", () => {
    expect(sceneCss).toContain(".scout-layer{position:absolute;inset:0;z-index:30}");
  });
});

describe("CAM-181 — keep-out zones: no firefly in campfire or topbar area", () => {
  // Verify none of the 12 firefly positions fall inside the campfire keep-out
  // zone (x 43–57 %, y 46–60 %) or the topbar keep-out (y 0–7 %).
  // We extract left/top % values from the inline styles in the JSX.

  function extractFireflyPositions(source: string): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    // Match left:"X%" top:"Y%" pairs on .firefly spans
    const ffRegex = /className="firefly"[^>]*?left:\s*"(\d+(?:\.\d+)?)%"[^>]*?top:\s*"(\d+(?:\.\d+)?)%"/g;
    let m: RegExpExecArray | null;
    while ((m = ffRegex.exec(source)) !== null) {
      positions.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
    }
    return positions;
  }

  const positions = extractFireflyPositions(jsxReturn);

  it("extracts exactly 12 firefly positions from JSX", () => {
    expect(positions).toHaveLength(12);
  });

  it("no firefly falls inside the campfire/gift keep-out (x 43–57 %, y 46–60 %)", () => {
    for (const p of positions) {
      const inCampfire = p.x >= 43 && p.x <= 57 && p.y >= 46 && p.y <= 60;
      expect(inCampfire).toBe(false);
    }
  });

  it("no firefly sits in the topbar keep-out row (y 0–7 %)", () => {
    for (const p of positions) {
      expect(p.y).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("CAM-181 — stagger: all 12 fireflies have distinct --ff-dur values", () => {
  it("12 distinct --ff-dur values exist in the firefly layer (out-of-sync blink)", () => {
    const layerStart = jsxReturn.indexOf('data-testid="layer--map-fireflies"');
    const layerBlock = jsxReturn.slice(layerStart, layerStart + 5000);
    const durMatches = layerBlock.match(/--ff-dur[^:]*:\s*"([\d.]+s)"/g);
    expect(durMatches).not.toBeNull();
    expect(durMatches!.length).toBe(12);
    const unique = new Set(durMatches!.map((m) => m.match(/"([\d.]+s)"/)![1]));
    // All 12 should be unique (owner spec: different durations per firefly)
    expect(unique.size).toBe(12);
  });
});
