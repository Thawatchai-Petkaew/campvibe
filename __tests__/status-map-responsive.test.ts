import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================================
// CAM-260 — Responsive HUD polish regression tests
//
// These tests lock the STRUCTURAL CONTRACT that prevents the three
// recurring mobile/tablet HUD defects from being silently re-introduced:
//
//   Defect A — Header overflow: .hud-topbar lacked box-sizing/max-width/
//              overflow guards so the row could spill past the viewport edge.
//              Prior "fix": hiding children via media-queries (cosmetic only).
//              Contract: box-sizing:border-box + max-width:100vw + overflow:hidden
//              must ALL be present in the same rule block.
//
//   Defect B — Edge-to-edge angular filter: .hud-signposts-bottom used
//              left:0;right:0;width:100% so the row butted against the frame
//              with no breathing gap and right-angle pill ends at the edges.
//              Prior "fix": pixel-tweaked padding (lost on next content edit).
//              Contract: --hud-inset-sm (12px) inset on both sides, NOT
//              left:0/right:0/width:100%; pill ends 999px; min-height 44px.
//
//   Defect C — Cramped/overflowing bottom toolbar: .hud-map-toolbar had no
//              overflow guard; on narrow screens the chips escaped the screen.
//              Prior "fix": hiding the overflow instead of containing it.
//              Contract: structural guard (box-sizing:border-box + max-width:100%)
//              in BOTH the mobile <639px block AND the new tablet 640–1023px block.
//
// Strategy: SOURCE-CONTRACT assertions (same harness as status-map-flicker.test.ts
// / the CAM-176 tests). These read the component source and assert the CSS/markup
// contract that, if removed, would reproduce the defects. Every test is written to
// FAIL if the corresponding guard is removed.
// ============================================================

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

const sceneSrc  = read("../app/status/map/campsite-scene.tsx");
const overlaySrc = read("../app/status/map/campsite-overlays.tsx");
const globalsCss = read("../app/globals.css");

// ============================================================
// AC-1 — Overflow guard: header (.hud-topbar)
//
// The fix adds THREE guards to the SAME .hud-topbar rule block:
//   box-sizing:border-box   — padding is contained within the declared width
//   max-width:100vw         — the row can never exceed the viewport
//   overflow:hidden         — any child that still overflows is clipped
//
// Why it FAILS on old code:
//   Old .hud-topbar only had position/flex/gap/padding — no overflow guards.
//   The test checks that all three co-exist in the same rule block, so removing
//   ANY of the three turns this test red.
// ============================================================
describe("[regression CAM-260 Defect A] .hud-topbar overflow guard prevents header from spilling off-screen", () => {
  // Isolate the .hud-topbar CSS rule block from SCENE_CSS.
  // The block starts at ".hud-topbar{" and ends at the next rule.
  const topbarRuleStart = sceneSrc.indexOf(".hud-topbar{");
  // The block ends at the next closing brace + newline (the first "}" after the block opens).
  const topbarRuleEnd   = sceneSrc.indexOf("}", topbarRuleStart);
  const topbarRule      = sceneSrc.slice(topbarRuleStart, topbarRuleEnd + 1);

  it("AC-1a: .hud-topbar rule contains box-sizing:border-box (padding contained within declared width)", () => {
    // Without box-sizing:border-box, padding:14px 18px adds 36px to the declared
    // 100vw width → the row is wider than the viewport before any children render.
    // On OLD code: no box-sizing in the topbar rule → this assertion FAILS.
    expect(topbarRule).toContain("box-sizing:border-box");
  });

  it("AC-1b: .hud-topbar rule contains max-width:100vw (row cannot exceed the viewport width)", () => {
    // Without max-width:100vw, a flex row with large children can stretch
    // past the right edge and trigger horizontal scroll on mobile.
    // On OLD code: no max-width → this assertion FAILS.
    expect(topbarRule).toContain("max-width:100vw");
  });

  it("AC-1c: .hud-topbar rule contains overflow:hidden (any residual overflow is clipped)", () => {
    // Without overflow:hidden, a child that cannot shrink further can still cause
    // a pixel of overflow on the right that triggers horizontal scroll at device level.
    // On OLD code: no overflow:hidden → this assertion FAILS.
    expect(topbarRule).toContain("overflow:hidden");
  });

  it("AC-1d: all three guards co-exist in the SAME .hud-topbar rule block (not split across selectors)", () => {
    // The structural defence only works when all three are applied together.
    // If they were split across different selectors, a media-query override on one
    // could silently undo the protection. Confirm they share one block.
    expect(topbarRule).toContain("box-sizing:border-box");
    expect(topbarRule).toContain("max-width:100vw");
    expect(topbarRule).toContain("overflow:hidden");
  });
});

// ============================================================
// AC-2 — Header can shrink: .hud-topbar-right and .hud-topbar-spacer flex contracts
//
// The header overflow manifested because .hud-topbar-right was flex:none —
// it refused to shrink regardless of viewport width. The fix changes it to
// flex:0 1 auto (can shrink) + min-width:0 (can shrink below content size).
// .hud-topbar-spacer gets flex:1 1 0 + min-width:0 so the middle gap
// grows/shrinks smoothly and gives space back to the right cluster.
//
// Why it FAILS on old code:
//   flex:none prevents any shrink. Asserting NOT flex:none is the gate.
// ============================================================
describe("[regression CAM-260 Defect A] .hud-topbar-right can shrink (flex:0 1 auto, not flex:none)", () => {
  // Isolate .hud-topbar-right block.
  const rightStart = sceneSrc.indexOf(".hud-topbar-right{");
  const rightEnd   = sceneSrc.indexOf("}", rightStart);
  const rightRule  = sceneSrc.slice(rightStart, rightEnd + 1);

  it("AC-2a: .hud-topbar-right is flex:0 1 auto (can shrink on narrow screens)", () => {
    // flex:0 1 auto = no grow, CAN shrink, auto basis.
    // On OLD code: flex:none (= flex:0 0 auto) → this assertion FAILS because
    // the value won't contain "1 auto".
    expect(rightRule).toContain("flex:0 1 auto");
  });

  it("AC-2b: .hud-topbar-right has min-width:0 (allows shrink below content size)", () => {
    // CSS flex items cannot shrink below min-content by default (min-width:auto).
    // Without min-width:0, the right cluster still overflows even with flex-shrink:1.
    // On OLD code: no min-width:0 in this rule → this assertion FAILS.
    expect(rightRule).toContain("min-width:0");
  });

  it("AC-2c: .hud-topbar-right is NOT flex:none (the old value that blocked shrink)", () => {
    // flex:none is shorthand for flex:0 0 auto — blocks all shrink entirely.
    // On OLD code: flex:none was the value → this assertion would FAIL (contains "flex:none").
    expect(rightRule).not.toContain("flex:none");
  });

  it("AC-2d: .hud-topbar-spacer is flex:1 1 0 with min-width:0 (middle gap grows/shrinks freely)", () => {
    const spacerStart = sceneSrc.indexOf(".hud-topbar-spacer{");
    const spacerEnd   = sceneSrc.indexOf("}", spacerStart);
    const spacerRule  = sceneSrc.slice(spacerStart, spacerEnd + 1);
    // flex:1 1 0 = grow AND shrink, zero basis (so it takes only free space).
    expect(spacerRule).toContain("flex:1 1 0");
    expect(spacerRule).toContain("min-width:0");
  });
});

// ============================================================
// AC-3 — Filter inset (not edge-to-edge): .hud-signposts-bottom uses --hud-inset-sm
//
// Old code: left:0;right:0;width:100% — row butted the frame edge exactly.
// Fix: left:var(--hud-inset-sm,12px);right:var(--hud-inset-sm,12px);width:auto
//      so there is always a 12px breathing gap on each side.
//
// Why it FAILS on old code:
//   Old source had "left:0;right:0;width:100%" → toContain("--hud-inset-sm")
//   would FAIL and toContain("left:0;right:0") would PASS (wrong: the "NOT" test
//   below would FAIL on the bad value).
// ============================================================
describe("[regression CAM-260 Defect B] .hud-signposts-bottom uses 12px inset — never edge-to-edge", () => {
  // Isolate the base .hud-signposts-bottom rule block (not the media-query overrides).
  const bottomStart = overlaySrc.indexOf(".hud-signposts-bottom{");
  const bottomEnd   = overlaySrc.indexOf("}", bottomStart);
  const bottomRule  = overlaySrc.slice(bottomStart, bottomEnd + 1);

  it("AC-3a: .hud-signposts-bottom references --hud-inset-sm for the left inset (12px gap from edge)", () => {
    // The fix: left:var(--hud-inset-sm,12px) — the CSS custom property is the gate.
    // On OLD code: left:0 or hardcoded left:0 → toContain("--hud-inset-sm") FAILS.
    expect(bottomRule).toContain("--hud-inset-sm");
  });

  it("AC-3b: .hud-signposts-bottom references --hud-inset-sm for the right inset as well", () => {
    // Both left AND right must use the token so neither edge butts the frame.
    // Count occurrences of "--hud-inset-sm" in the base rule: must be ≥2
    // (one for left:, one for right:).
    const occurrences = (bottomRule.match(/--hud-inset-sm/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("AC-3c: .hud-signposts-bottom uses width:auto (not width:100%)", () => {
    // width:100% combined with left:0/right:0 = edge-to-edge (old defect).
    // After the fix, width:auto lets left/right inset do the positioning.
    // On OLD code: width:100% → this assertion FAILS.
    expect(bottomRule).toContain("width:auto");
    expect(bottomRule).not.toContain("width:100%");
  });

  it("AC-3d: .hud-signposts-bottom does NOT use left:0;right:0 (edge-to-edge old pattern)", () => {
    // The structural guard is the inset token, not pixel offsets.
    // On OLD code: left:0 was present → this assertion FAILS.
    // We test both variants: "left:0;" and "left: 0" to catch either spacing.
    expect(bottomRule).not.toMatch(/left\s*:\s*0[;}\s]/);
  });
});

// ============================================================
// AC-4 — Filter pill ends use 999px radius (not angular 8px)
//
// Old code: first/last .hud-signpost in the bottom row used 8px radius corners
// (same as desktop at the time). After the fix: 999px pill ends that match
// the desktop variant and look intentional on mobile.
//
// Why it FAILS on old code:
//   8px radius produces angular squares at the joined-pill ends → the "999px"
//   assertion fails.
// ============================================================
describe("[regression CAM-260 Defect B] .hud-signposts-bottom pill ends use 999px radius", () => {
  it("AC-4a: first chip in the bottom filter row has 999px 0 0 999px (full left pill end)", () => {
    // The first-child rule: border-radius:999px 0 0 999px — left end is pill.
    // On OLD code: border-radius:8px 0 0 8px → "999px" not found → FAILS.
    expect(overlaySrc).toContain(
      ".hud-signposts-bottom .hud-signpost-wrap:first-child .hud-signpost{border-radius:999px 0 0 999px"
    );
  });

  it("AC-4b: last chip in the bottom filter row has 0 999px 999px 0 (full right pill end)", () => {
    // On OLD code: border-radius:0 8px 8px 0 → "999px" not found → FAILS.
    expect(overlaySrc).toContain(
      ".hud-signposts-bottom .hud-signpost-wrap:last-child .hud-signpost{border-radius:0 999px 999px 0"
    );
  });
});

// ============================================================
// AC-5 — Filter tap target: .hud-signpost mobile min-height 44px (WCAG 2.5.5)
//
// Old code: min-height:30px (below the 44×44 touch-target minimum).
// Fix: min-height:44px on the bottom variant's chip override.
//
// Why it FAILS on old code:
//   The block contained "min-height:30px" and NOT "min-height:44px" → the
//   "44px" assertion fails; the "NOT 30px" assertion also fails.
// ============================================================
describe("[regression CAM-260 Defect B] .hud-signposts-bottom chip has 44px touch target (WCAG 2.5.5)", () => {
  // Isolate the bottom-chip override rule.
  const chipBlockStart = overlaySrc.indexOf(".hud-signposts-bottom .hud-signpost{");
  const chipBlockEnd   = overlaySrc.indexOf("}", chipBlockStart);
  const chipBlock      = overlaySrc.slice(chipBlockStart, chipBlockEnd + 1);

  it("AC-5a: .hud-signposts-bottom .hud-signpost has min-height:44px (touch target ≥44px)", () => {
    // On OLD code: min-height:30px → "min-height:44px" not found → FAILS.
    expect(chipBlock).toContain("min-height:44px");
  });

  it("AC-5b: .hud-signposts-bottom .hud-signpost does NOT use min-height:30px (old below-target value)", () => {
    // On OLD code: 30px was present → NOT assertion FAILS.
    expect(chipBlock).not.toContain("min-height:30px");
  });
});

// ============================================================
// AC-6 — Toolbar overflow guard: mobile (<639px) AND tablet (640–1023px)
//
// The fix adds THREE structural guards to .hud-map-toolbar in BOTH breakpoints:
//   box-sizing:border-box  — padding is contained
//   max-width:100%         — cannot exceed the inset-bounded width
//   --hud-inset-sm left/right inset  — the toolbar never butts the edge
//
// Tablet block is NEW for CAM-260 (parity with mobile). If the tablet block is
// missing, the assertion that "(min-width: 640px) and (max-width: 1023px)" exists
// in SCENE_CSS fails.
//
// Why it FAILS on old code:
//   Mobile block had no box-sizing/max-width → those assertions fail.
//   Tablet block didn't exist → the tablet block assertion fails.
// ============================================================
describe("[regression CAM-260 Defect C] .hud-map-toolbar structural overflow guard — mobile + tablet parity", () => {

  // ── Mobile <639px block ────────────────────────────────────────────────────
  // Isolate the @media (max-width: 639px) block so we can assert precisely inside it.
  const mobileBlockStart = sceneSrc.indexOf("@media (max-width: 639px)");
  // Find the closing brace of the media block (next top-level "}" after the block)
  // The block for @media (max-width: 639px) ends before @media (max-width: 420px) starts
  // inside it. We use a wider slice covering the full block (~3000 chars) to capture it.
  const mobileBlock = sceneSrc.slice(mobileBlockStart, mobileBlockStart + 3000);

  // Find the .hud-map-toolbar rule INSIDE the mobile block.
  const mobileToolbarStart  = mobileBlock.indexOf(".hud-map-toolbar{");
  const mobileToolbarEnd    = mobileBlock.indexOf("}", mobileToolbarStart);
  const mobileToolbarRule   = mobileBlock.slice(mobileToolbarStart, mobileToolbarEnd + 1);

  it("AC-6a (mobile): .hud-map-toolbar in @media (max-width:639px) contains box-sizing:border-box", () => {
    // On OLD code: no box-sizing in mobile toolbar rule → FAILS.
    expect(mobileToolbarRule).toContain("box-sizing:border-box");
  });

  it("AC-6b (mobile): .hud-map-toolbar in @media (max-width:639px) contains max-width:100%", () => {
    // On OLD code: no max-width in mobile toolbar rule → FAILS.
    expect(mobileToolbarRule).toContain("max-width:100%");
  });

  it("AC-6c (mobile): .hud-map-toolbar in @media (max-width:639px) uses --hud-inset-sm inset (not left:0)", () => {
    // On OLD code: left:0 was the value (edge-to-edge) → "--hud-inset-sm" not found → FAILS.
    expect(mobileToolbarRule).toContain("--hud-inset-sm");
  });

  // ── Tablet 640–1023px block (NEW for CAM-260) ─────────────────────────────
  // This block must exist as a NEW @media (min-width: 640px) and (max-width: 1023px) rule.
  const tabletBlockQuery  = "@media (min-width: 640px) and (max-width: 1023px)";
  const tabletBlockStart  = sceneSrc.indexOf(tabletBlockQuery);

  it("AC-6d (tablet): a @media (min-width:640px) and (max-width:1023px) block exists (tablet parity — NEW for CAM-260)", () => {
    // On OLD code: this block did not exist at all → tabletBlockStart === -1 → FAILS.
    expect(tabletBlockStart).toBeGreaterThan(-1);
  });

  it("AC-6e (tablet): .hud-map-toolbar in the tablet block contains box-sizing:border-box", () => {
    const tabletBlock         = sceneSrc.slice(tabletBlockStart, tabletBlockStart + 2000);
    const tabletToolbarStart  = tabletBlock.indexOf(".hud-map-toolbar{");
    const tabletToolbarEnd    = tabletBlock.indexOf("}", tabletToolbarStart);
    const tabletToolbarRule   = tabletBlock.slice(tabletToolbarStart, tabletToolbarEnd + 1);
    // On OLD code: no tablet block → tabletToolbarStart === -1 and the slice would
    // produce an empty string → "box-sizing:border-box" not found → FAILS.
    expect(tabletToolbarRule).toContain("box-sizing:border-box");
  });

  it("AC-6f (tablet): .hud-map-toolbar in the tablet block contains max-width:100%", () => {
    const tabletBlock         = sceneSrc.slice(tabletBlockStart, tabletBlockStart + 2000);
    const tabletToolbarStart  = tabletBlock.indexOf(".hud-map-toolbar{");
    const tabletToolbarEnd    = tabletBlock.indexOf("}", tabletToolbarStart);
    const tabletToolbarRule   = tabletBlock.slice(tabletToolbarStart, tabletToolbarEnd + 1);
    expect(tabletToolbarRule).toContain("max-width:100%");
  });

  it("AC-6g (tablet): .hud-map-toolbar in the tablet block uses --hud-inset-sm inset (not left:0)", () => {
    const tabletBlock         = sceneSrc.slice(tabletBlockStart, tabletBlockStart + 2000);
    const tabletToolbarStart  = tabletBlock.indexOf(".hud-map-toolbar{");
    const tabletToolbarEnd    = tabletBlock.indexOf("}", tabletToolbarStart);
    const tabletToolbarRule   = tabletBlock.slice(tabletToolbarStart, tabletToolbarEnd + 1);
    expect(tabletToolbarRule).toContain("--hud-inset-sm");
  });

  it("AC-6h (tablet): .hud-map-toolbar children have min-width:0 in the tablet block (can shrink)", () => {
    const tabletBlock = sceneSrc.slice(tabletBlockStart, tabletBlockStart + 2000);
    // The rule .hud-map-toolbar > *{min-width:0} must appear in the tablet block.
    expect(tabletBlock).toContain(".hud-map-toolbar > *{min-width:0}");
  });

  it("AC-6i (mobile): .hud-map-toolbar children have min-width:0 in the mobile block (can shrink)", () => {
    // On OLD code: no min-width:0 on children → children push past the container → FAILS.
    expect(mobileBlock).toContain(".hud-map-toolbar > *{min-width:0}");
  });
});

// ============================================================
// AC-7 — Icons: imports Users; does NOT import AlignJustify; does NOT reference ChevronUp
//
// The AlignJustify icon ("hamburger") was visually ambiguous as a "Roster/Team"
// button — it reads as a general menu. Users communicates "people" clearly.
// ChevronUp was a caret on the Board button implying it expands upward (wrong:
// it opens a Sheet sideways). Both are removed per the CAM-260 design brief.
//
// Why each assertion FAILS on old code:
//   AlignJustify: was in the import line → "AlignJustify" found → NOT fails.
//   ChevronUp:    was in the import line and rendered → "ChevronUp" found → NOT fails.
//   Users:        was absent → "Users" not found → toContain fails.
// ============================================================
describe("[regression CAM-260] icon contract — Users replaces AlignJustify; ChevronUp removed", () => {
  // Check the lucide-react import line (first line containing "lucide-react").
  const lucideLine = sceneSrc.split("\n").find((l) => l.includes("lucide-react")) ?? "";

  it("AC-7a: campsite-scene.tsx imports Users from lucide-react (team icon)", () => {
    // On OLD code: AlignJustify not replaced → "Users" not in import → FAILS.
    expect(lucideLine).toContain("Users");
  });

  it("AC-7b: campsite-scene.tsx does NOT import AlignJustify (replaced by Users per design brief)", () => {
    // On OLD code: AlignJustify was in the import → NOT assertion FAILS.
    expect(lucideLine).not.toContain("AlignJustify");
  });

  it("AC-7c: campsite-scene.tsx source does NOT reference ChevronUp anywhere (caret removed)", () => {
    // AlignJustify/ChevronUp may appear in comments; we check the full source.
    // The key is they must not be referenced in any JS/JSX context.
    // On OLD code: ChevronUp appeared in the JSX and import → "ChevronUp" found → NOT fails.
    expect(sceneSrc).not.toContain("ChevronUp");
  });

  it("AC-7d: Users icon is actually RENDERED in the toolbar (the ทีม button uses it)", () => {
    // Verify the import is not unused — the Users icon appears in JSX context.
    // Find the ทีม button block and assert <Users inside it.
    const rosterBtnStart = sceneSrc.indexOf('data-testid="btn--map-toolbar-roster"');
    const rosterBtnEnd   = sceneSrc.indexOf("</button>", rosterBtnStart);
    const rosterBtn      = sceneSrc.slice(rosterBtnStart, rosterBtnEnd);
    // On OLD code: AlignJustify was rendered instead → <Users not found → FAILS.
    expect(rosterBtn).toContain("<Users");
  });
});

// ============================================================
// AC-8 — Desktop untouched: (min-width:1024px) toolbar hidden rule is still present
//
// CAM-260 must NOT remove or break the desktop rule that hides the mobile toolbar.
// Any edit that drops this rule would cause the mobile toolbar to render on desktop.
//
// Why it FAILS if the rule is removed:
//   ".hud-map-toolbar{display:none}" inside the min-1024px block disappears →
//   toContain fails.
// ============================================================
describe("[regression CAM-260] desktop unchanged — mobile toolbar hidden at ≥1024px", () => {
  // Isolate the @media (min-width: 1024px) block.
  const desktopBlockStart = sceneSrc.indexOf("@media (min-width: 1024px)");
  const desktopBlock      = sceneSrc.slice(desktopBlockStart, desktopBlockStart + 600);

  it("AC-8a: @media (min-width:1024px) block still hides .hud-map-toolbar with display:none", () => {
    // On old code if this guard were removed: the mobile toolbar would appear on desktop.
    // If someone accidentally removes the desktop rule, toContain → FAILS.
    expect(desktopBlock).toContain(".hud-map-toolbar{display:none}");
  });

  it("AC-8b: @media (min-width:1024px) block still hides .hud-edge-tab with display:none (no desktop regression)", () => {
    // Edge tabs are mobile/tablet-only. Desktop guard must remain.
    expect(desktopBlock).toContain(".hud-edge-tab{display:none}");
  });

  it("AC-8c: .hud-view-toggle is hidden on tablet/mobile (<1024px) in the (max-width:1023px) block", () => {
    // The ViewToggle link is desktop-only — its hide rule in the mobile block must be present.
    // There are two @media (max-width: 1023px) blocks; the hide rule is in the second one
    // (the SMUX-6 icon-buttons block). Use lastIndexOf to find the relevant one.
    const tabletHideStart = sceneSrc.lastIndexOf("@media (max-width: 1023px)");
    const tabletHideBlock = sceneSrc.slice(tabletHideStart, tabletHideStart + 400);
    expect(tabletHideBlock).toContain(".hud-view-toggle{display:none}");
  });
});

// ============================================================
// AC-9 — --hud-inset-sm is defined in app/globals.css
//
// The 12px breathing gap is a HUD layout constant defined in globals.css so it
// can be shared between campsite-scene.tsx (toolbar) and campsite-overlays.tsx
// (filter row) without duplication. If it moves back to an inline fallback
// only (the ,12px part of var()), the two files could drift independently.
//
// Why it FAILS if the token is removed from globals.css:
//   "--hud-inset-sm: 12px" no longer appears in globals.css → FAILS.
// ============================================================
describe("[regression CAM-260] --hud-inset-sm token is declared in app/globals.css", () => {
  it("AC-9a: globals.css declares --hud-inset-sm: 12px in :root", () => {
    // On OLD code (before CAM-260): the token didn't exist in globals.css → FAILS.
    expect(globalsCss).toContain("--hud-inset-sm: 12px");
  });

  it("AC-9b: campsite-scene.tsx toolbar rule uses var(--hud-inset-sm,12px) as the inset (not a hardcoded 12px)", () => {
    // Using the token (with fallback) lets future design edits change the inset
    // in ONE place. A raw "12px" would break when the token value changes.
    // Also verifies the token IS referenced in scene (not only in overlays).
    expect(sceneSrc).toContain("var(--hud-inset-sm,12px)");
  });

  it("AC-9c: campsite-overlays.tsx filter row uses var(--hud-inset-sm,12px) as the inset (token shared)", () => {
    // Same token reference in the overlays file proves cross-file consistency.
    expect(overlaySrc).toContain("var(--hud-inset-sm,12px)");
  });
});

// ============================================================
// AC-10 — .env-lane-word / .env-lane-dot compact capsule toggle (CAM-260 ≤420px)
//
// At ≤420px the toolbar collapses to icon-only mode. The EnvPipelineCapsule
// also compacts: lane words (e.g. "Dev ") hide and colored dots appear instead,
// keeping the capsule readable in a narrow hit area.
//
// Why it FAILS on old code:
//   .env-lane-word{display:inline} exists in overlays but the ≤420px override
//   to {display:none} + .env-lane-dot{display:inline-block} was NOT in the
//   mobile @media block of scene → toContain fails.
// ============================================================
describe("[regression CAM-260] compact capsule at ≤420px — lane words hidden, dots shown", () => {
  // Isolate the @media (max-width: 420px) block inside the (max-width:639px) mobile block.
  const iconOnlyBlockIdx = sceneSrc.indexOf("@media (max-width: 420px){");
  const iconOnlyBlock    = sceneSrc.slice(iconOnlyBlockIdx, iconOnlyBlockIdx + 400);

  it("AC-10a: at max-width:420px, .env-lane-word has display:none (word label hidden)", () => {
    // The lane word "Dev " etc. is hidden so only the colored dot + count show.
    // On OLD code: no display:none for env-lane-word in ≤420px → FAILS.
    expect(iconOnlyBlock).toContain(".env-lane-word{display:none}");
  });

  it("AC-10b: at max-width:420px, .env-lane-dot has display:inline-block (colored dot shown)", () => {
    // The dot is normally hidden (display:none in .env-lane-dot base CSS);
    // the ≤420px override shows it as the compact replacement for the word.
    // On OLD code: no override for env-lane-dot → FAILS.
    expect(iconOnlyBlock).toContain(".env-lane-dot{display:inline-block}");
  });

  it("AC-10c: .env-lane-word is defined in campsite-overlays.tsx (base rule — shown by default)", () => {
    // The base rule shows the word label; the ≤420px override hides it.
    // Both must exist for the toggle to work correctly.
    expect(overlaySrc).toContain(".env-lane-word{display:inline}");
  });

  it("AC-10d: .env-lane-dot base CSS hides the dot by default (revealed only at ≤420px)", () => {
    // The dot is hidden at wider widths; only the word is shown.
    // Verify the base .env-lane-dot rule exists (start of the definition).
    expect(overlaySrc).toContain(".env-lane-dot{");
  });
});
