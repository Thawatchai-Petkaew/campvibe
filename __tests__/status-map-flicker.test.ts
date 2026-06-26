import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Also load the engine source for secondary behavioral assertions.
const engineSrc = readFileSync(
  resolve(__dirname, "../app/status/map/campsite-engine.ts"),
  "utf8",
);

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

// ============================================================
// Regression test: CAM-201 definitive flicker fix — v0.10.1 partial fix gaps
//
// v0.10.1 moved position out of the React style prop INTO the rootRef callback,
// correctly making the engine the sole position owner. However it left two gaps
// that can still cause a one-frame snap on live staging:
//
// GAP A (PRIMARY): The rootRef callback was UNGUARDED — it re-ran on every
//   re-render where memo allowed (i.e. whenever agent.active/done/activeCount/
//   queued/task changed, which is frequent on live SSE feed). On each such
//   re-render, el.style.left/top were reset to the static HOME position, snapping
//   a walking agent home for one paint frame.
//
// GAP B (SECONDARY): working/idle class was interpolated into AgentScout's
//   className prop (`scout ${stateClass}`). A React re-render clobbers the full
//   className, which removes any engine-added class not in the static prop
//   (e.g. "entering") and can restart CSS animations.
//
// Fix:
//   GAP A — guard the rootRef seed with `el.dataset.posSeeded`; runs exactly once.
//   GAP B — move working/idle class from React's className to the engine's
//            setActivity() (imperative DOM toggle), matching how walking-mode is
//            already handled. AgentScoutInner className becomes the static "scout".
//
// NOTE: The Vitest environment is node-only (no jsdom / no @testing-library/react).
// Source-inspection is the strongest feasible guard. These tests pin the exact
// source contracts that, if violated, reproduce the flicker.
// ============================================================

// ── Shared source slices for CAM-201 tests ───────────────────────────────────

// Isolate just the agents.map rootRef callback for precise assertion.
const rootRefStart = sceneSrc.indexOf("rootRef={(el) => {");
const rootRefEnd   = sceneSrc.indexOf("bodyRef={(el) => { bodyRefs");
const rootRefSrc   = sceneSrc.slice(rootRefStart, rootRefEnd);

// Isolate the engine's setActivity function body.
const setActivityStart = sceneSrc.indexOf("setActivity(activeByRole");
// Engine source is in a separate file; search there.
const engSetActStart = engineSrc.indexOf("setActivity(activeByRole");
const engSetActEnd   = engineSrc.indexOf("stop()", engSetActStart);
const engSetActSrc   = engineSrc.slice(engSetActStart, engSetActEnd);

// Isolate the engine init block (scoutRefs build) to check class seeding.
const engInitStart = sceneSrc.indexOf("const scoutRefs: ScoutRef[]");
const engInitEnd   = sceneSrc.indexOf("let engine: EngineHandle | null = null;");
const engInitSrc   = sceneSrc.slice(engInitStart, engInitEnd);

describe("[regression CAM-201 GAP A] rootRef position seed is guarded by dataset.posSeeded — runs exactly once per element", () => {

  // ── (A1) dataset.posSeeded guard present ─────────────────────────────────
  //
  // Without this guard, the inline rootRef callback re-applies el.style.left/top
  // to the static home position on every re-render that memo allows through.
  // Walking agents snap home for one paint frame = flicker.
  //
  // On UNGUARDED code (v0.10.1): the `if (el)` check has no posSeeded condition
  // → this assertion FAILS.
  it("rootRef callback guards position seed with !el.dataset.posSeeded (runs exactly once)", () => {
    expect(rootRefSrc).toContain("!el.dataset.posSeeded");
  });

  // ── (A2) dataset.posSeeded is set to '1' after the seed ──────────────────
  //
  // The guard only works if the flag is actually written after the seed runs.
  // Without this write, every call still passes the guard and re-seeds.
  it("rootRef callback writes el.dataset.posSeeded = \"1\" after seeding", () => {
    expect(rootRefSrc).toContain('el.dataset.posSeeded = "1"');
  });

  // ── (A3) el.style.left seed is INSIDE the posSeeded guard ────────────────
  //
  // The seed must be inside the guarded block, not outside it.
  // Verify that el.style.left appears AFTER !el.dataset.posSeeded in the rootRef.
  it("el.style.left seed appears after the posSeeded guard in the rootRef callback", () => {
    const guardIdx = rootRefSrc.indexOf("!el.dataset.posSeeded");
    const leftIdx  = rootRefSrc.indexOf("el.style.left", guardIdx);
    // leftIdx must exist after guardIdx
    expect(guardIdx).toBeGreaterThan(-1);
    expect(leftIdx).toBeGreaterThan(guardIdx);
  });

  // ── (A4) comment explains the dataset guard ───────────────────────────────
  //
  // The guard rationale must be documented so future developers understand why it
  // exists and do not inadvertently remove it.
  it("rootRef callback has a comment explaining the posSeeded once-per-element guard", () => {
    expect(rootRefSrc).toContain("runs exactly");
    expect(rootRefSrc).toContain("dataset.posSeeded");
  });
});

describe("[regression CAM-201 GAP B] working/idle class is engine-owned, not React className", () => {

  // ── (B1) AgentScoutInner className does NOT interpolate working/idle ──────
  //
  // Before: `className={\`scout \${stateClass}\`}` where stateClass = "working"|"idle".
  // A React re-render replaces the entire className string, which can remove
  // engine-added classes ("entering") and restart CSS animations.
  // After: className is the static string "scout".
  //
  // On OLD (v0.10.1) code: the interpolation `${stateClass}` was present → FAIL.
  it("AgentScoutInner className is the static string \"scout\" (no working/idle interpolation)", () => {
    // Must contain className="scout" as a static string (not a template literal with stateClass).
    expect(agentScoutInnerSrc).toContain('className="scout"');
  });

  it("AgentScoutInner className does NOT contain '${stateClass}' interpolation", () => {
    expect(agentScoutInnerSrc).not.toContain("${stateClass}");
  });

  it("AgentScoutInner does NOT declare a 'stateClass' variable (it was the interpolation vehicle)", () => {
    // stateClass was `const stateClass = agent.active ? "working" : "idle"`.
    // Once className is static, this variable is dead code and should be gone.
    expect(agentScoutInnerSrc).not.toContain("const stateClass");
  });

  // ── (B2) Engine's setActivity toggles working/idle on rootEl ─────────────
  //
  // The engine must be the sole authority toggling these classes so they survive
  // across React re-renders.
  //
  // On OLD (v0.10.1) code: setActivity only updated s.active, not the DOM class
  // → these assertions FAIL.
  it("engine setActivity() toggles 'working' class on rootEl", () => {
    expect(engSetActSrc).toContain('classList.toggle("working", next)');
  });

  it("engine setActivity() toggles 'idle' class on rootEl", () => {
    expect(engSetActSrc).toContain('classList.toggle("idle", !next)');
  });

  // ── (B3) Engine init block seeds working/idle to match initial s.active ──
  //
  // Without an initial seed in the engine init, there is a window between first
  // render (no class) and first setActivity() call where the class is missing.
  // The belt-and-suspenders rootRef seed covers first paint; the engine init
  // confirms correct state once rootEl is available to the engine.
  it("engine init block sets working/idle class via classList.toggle to match initial s.active", () => {
    expect(engInitSrc).toContain('classList.toggle("working", state.active)');
    expect(engInitSrc).toContain('classList.toggle("idle", !state.active)');
  });

  // ── (B4) rootRef seeds initial working/idle class (belt-and-suspenders) ───
  //
  // The rootRef block seeds the initial class alongside posSeeded so the agent
  // has the correct visual state on first paint before the engine effect runs.
  it("rootRef seeds initial working/idle class as belt-and-suspenders for pre-engine first paint", () => {
    expect(rootRefSrc).toContain('el.classList.add(agent.active ? "working" : "idle")');
  });

  // ── (B5) Comment in AgentScoutInner explains the class ownership transfer ─
  it("AgentScoutInner has a comment explaining working/idle class is engine-owned", () => {
    expect(agentScoutInnerSrc).toContain("working/idle class is now engine-owned");
  });
});

// ============================================================
// Regression test: CAM-201 — the REAL deployed flicker root cause
//
// Bug (the one the owner actually saw — "flickers on Staging/Prod, not Local;
// while walking; pre-existing"): the walk + relax sprite frames are swapped via
// background-image every frame. Next.js' default Cache-Control for /public is
// `max-age=0, must-revalidate`, so on deployed envs the browser revalidated each
// frame over the network before painting → a blank flash mid-walk. Invisible on
// localhost (round-trip ~0ms). Confirmed by the live header on the deployed asset.
//
// Fix (two layers):
//   1. next.config headers() serves /status-map/sprites/* as immutable long-cache
//      → the browser never revalidates a frame swap.
//   2. The engine preloads + decodes every frame once at start and keeps the
//      decoded images alive → no fetch/decode flash even on the first cycle.
//
// Source-inspection guard (node-only Vitest, same harness as above). Re-introducing
// the bug (dropping the cache rule or the preload) turns these red.
// ============================================================
const nextConfigSrc = readFileSync(resolve(__dirname, "../next.config.ts"), "utf8");

describe("CAM-201 — sprite cache + preload (real deployed flicker fix)", () => {
  it("next.config caches /status-map/sprites/* as immutable (no per-frame revalidation)", () => {
    expect(nextConfigSrc).toContain("/status-map/sprites/:file*");
    expect(nextConfigSrc).toMatch(/max-age=31536000.*immutable/);
  });

  it("next.config sets Cache-Control via headers()", () => {
    expect(nextConfigSrc).toMatch(/async headers\(\)/);
    expect(nextConfigSrc).toContain('key: "Cache-Control"');
  });

  it("engine preloads + decodes all walk + relax frames at start and keeps them alive", () => {
    expect(engineSrc).toContain("preloadedSprites");
    expect(engineSrc).toContain("Object.values(WALK_SPRITES).flat()");
    expect(engineSrc).toMatch(/relax-\$\{i\}\.webp/);
    expect(engineSrc).toContain("new Image()");
    expect(engineSrc).toContain("decode?.()");
  });
});
