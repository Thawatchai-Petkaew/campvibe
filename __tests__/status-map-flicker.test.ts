import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================================
// Regression test: CAM-176 flicker fix
//
// Bug: AgentScoutInner declared left/top/zIndex in its React style prop.
// On every SSE feed update the AgentScout memo re-rendered (when done /
// activeCount / queued / task changed) and re-applied the STATIC home
// position from homeStyle(), clobbering the engine's live DOM write for
// one paint frame → walking agent warped / flickered.
//
// Fix: left/top/zIndex removed from the React style prop entirely. Position
// is seeded once imperatively in the rootRef callback at the render site
// (pos.left / pos.top / pos.zIndex), and the animation engine owns the DOM
// property on every subsequent frame via place().
//
// This test uses source-inspection (the same harness as the rest of the
// status-map suite) because the Vitest environment is node-only (no jsdom /
// no @testing-library/react available). Source-inspection is the strongest
// feasible guard given this constraint — it pins the exact lines that, if
// re-introduced, would reproduce the flicker.
//
// Why it FAILS on the old code
// ----------------------------
// Before the fix, AgentScoutInner contained:
//
//   style={{
//     left:   pos.left,    // ← static home %
//     top:    pos.top,     // ← static home %
//     zIndex: pos.zIndex,  // ← static home z
//     background: "none",
//     ...
//   }}
//
// That means:
//   (A) the style prop DID contain "left:" — so assertion (1) below would
//       FAIL because the source would match /left\s*:/.
//   (B) the rootRef callback did NOT seed position — so assertion (3) below
//       would FAIL because "el.style.left" did not appear in the callback.
//   (C) the fix-intent comment was not present — so assertions (4) and (5)
//       would FAIL.
//
// After the fix every assertion passes, locking the contract permanently.
// ============================================================

const sceneSrc = readFileSync(
  resolve(__dirname, "../app/status/map/campsite-scene.tsx"),
  "utf8",
);

// Isolate just the AgentScoutInner function body (from the function keyword to
// the closing brace of the return statement) so we do not accidentally match
// engine calls or comment text outside the component.
//
// Strategy: find the substring from "function AgentScoutInner" through the
// closing </button> of the JSX return, which is immediately followed by );
// to close the return statement. We grab text up to the memo() call that
// follows, which is a stable anchor.
const innerStart = sceneSrc.indexOf("function AgentScoutInner(");
const innerEnd   = sceneSrc.indexOf("const AgentScout = memo(AgentScoutInner");
const agentScoutInnerSrc = sceneSrc.slice(innerStart, innerEnd);

// Isolate the agents.map(…) render block so we can assert the rootRef
// callback pattern without matching unrelated code.
const mapBlockStart = sceneSrc.indexOf("agents.map((agent) => {");
const mapBlockEnd   = sceneSrc.indexOf("onActivate={() => setTeamCollapsed(false)}");
const agentMapSrc   = sceneSrc.slice(mapBlockStart, mapBlockEnd);

describe("[regression] feed-update re-render does not warp a walking agent's engine-owned position", () => {

  // ── (1) Flicker contract: left/top/zIndex NOT in the React style prop ────────
  //
  // Arrange: isolate AgentScoutInner's JSX style prop.
  // Act:     search for "left:" / "top:" / "zIndex:" as property keys inside it.
  // Assert:  none must appear — React must not own these properties.
  //
  // On OLD code: the style prop contained `left: pos.left, top: pos.top,
  // zIndex: pos.zIndex` so these patterns would match and the test would FAIL.
  it("AgentScoutInner style prop does NOT contain 'left:' (position is engine-owned)", () => {
    // Extract just the style={{ … }} block inside the <button> return.
    // The style object starts after "style={{" and ends before the matching "}}"
    // followed by aria-label. We search within agentScoutInnerSrc.
    const styleBlockStart = agentScoutInnerSrc.indexOf("style={{");
    const styleBlockEnd   = agentScoutInnerSrc.indexOf("aria-label={ariaLabel}");
    const styleBlock      = agentScoutInnerSrc.slice(styleBlockStart, styleBlockEnd);

    // Must NOT have `left:` or `left :` as a key (engine owns it).
    // We exclude the comment lines that legitimately contain the word "left"
    // by checking only for the JS property syntax `left:`.
    expect(styleBlock).not.toMatch(/^\s*left\s*:/m);
  });

  it("AgentScoutInner style prop does NOT contain 'top:' (position is engine-owned)", () => {
    const styleBlockStart = agentScoutInnerSrc.indexOf("style={{");
    const styleBlockEnd   = agentScoutInnerSrc.indexOf("aria-label={ariaLabel}");
    const styleBlock      = agentScoutInnerSrc.slice(styleBlockStart, styleBlockEnd);

    expect(styleBlock).not.toMatch(/^\s*top\s*:/m);
  });

  it("AgentScoutInner style prop does NOT contain 'zIndex:' (position is engine-owned)", () => {
    const styleBlockStart = agentScoutInnerSrc.indexOf("style={{");
    const styleBlockEnd   = agentScoutInnerSrc.indexOf("aria-label={ariaLabel}");
    const styleBlock      = agentScoutInnerSrc.slice(styleBlockStart, styleBlockEnd);

    expect(styleBlock).not.toMatch(/^\s*zIndex\s*:/m);
  });

  // ── (2) Non-position styles ARE still present ────────────────────────────────
  //
  // Confirm the fix only removed position — other necessary styles remain.
  // On old code this would still pass (those keys were always present), so
  // this is a completeness guard rather than a red→green assertion, but it
  // ensures no one removes the aura/button-reset styles by mistake.
  it("AgentScoutInner style prop still contains '--aura' CSS var (non-position styles intact)", () => {
    expect(agentScoutInnerSrc).toContain('["--aura" as string]');
  });

  it("AgentScoutInner style prop still contains 'background: \"none\"' button reset (non-position styles intact)", () => {
    expect(agentScoutInnerSrc).toContain('background: "none"');
  });

  // ── (3) Imperative seed in rootRef callback ──────────────────────────────────
  //
  // Assert the rootRef callback is where left/top/zIndex are now written —
  // once, on mount — so the engine can own them from that point on.
  //
  // On OLD code: el.style.left did not appear in the rootRef callback because
  // position was passed via the React style prop. This assertion would FAIL.
  it("rootRef callback seeds el.style.left imperatively (one-time first-paint position)", () => {
    expect(agentMapSrc).toContain("el.style.left");
  });

  it("rootRef callback seeds el.style.top imperatively (one-time first-paint position)", () => {
    expect(agentMapSrc).toContain("el.style.top");
  });

  it("rootRef callback seeds el.style.zIndex imperatively (one-time first-paint position)", () => {
    expect(agentMapSrc).toContain("el.style.zIndex");
  });

  // ── (4) Fix-intent comment present ──────────────────────────────────────────
  //
  // The fix comment in AgentScoutInner explicitly states that left/top/zIndex
  // must NOT appear in the style prop because React re-applying them on every
  // feed update would cause the flicker. Asserting this comment is present
  // locks the intent for future maintainers and makes the purpose of the
  // empty style prop unambiguous.
  //
  // On OLD code the comment did not exist — FAIL.
  it("AgentScoutInner has a comment explaining why left/top/zIndex are omitted from the style prop", () => {
    expect(agentScoutInnerSrc).toContain("Position is engine-owned");
    expect(agentScoutInnerSrc).toContain("warp a walking agent back to home for one paint frame (flicker)");
  });

  // ── (5) rootRef callback comment confirms the engine-ownership contract ──────
  //
  // The rootRef site also carries a comment documenting that React never
  // writes position again after mount.
  //
  // On OLD code the comment did not exist — FAIL.
  it("rootRef callback has a comment stating the engine owns position after mount", () => {
    expect(agentMapSrc).toContain("React never writes left/top/zIndex");
    expect(agentMapSrc).toContain("they are not in the component's style prop");
  });
});
