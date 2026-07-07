/**
 * status-map-shell.test.ts — CAM-372 (S1b/S1c) StatusMapShell mount smoke test.
 *
 * Environment constraint (documented repo-wide — see cam-352-*.test.ts,
 * theme-toggle.test.ts, cam-343-host-holds-ui.test.ts, etc.): vitest runs in
 * the `node` environment; jsdom / @testing-library/react / react-test-renderer
 * are NOT installed anywhere in this repo (verified: not in node_modules, not
 * in package.json). Adding one is a new-dependency decision outside this
 * dispatch's authorized surface (STOP RULE: no new dependency without explicit
 * sign-off) — so it is NOT added here; this is flagged, not silently worked
 * around.
 *
 * What this file DOES prove (real, not source-grep):
 *   `react-dom/server` ships as part of `react-dom` (already a dependency —
 *   zero new installs) and its `renderToStaticMarkup` runs a REAL React render
 *   of <StatusMapShell> end-to-end: shell props flow into <CampsiteCanvas>,
 *   which computes sceneAriaLabel/isFocused/homeStyle and renders
 *   AgentScout/YouScout — genuinely exercising the seam's data flow and JSX
 *   composition, not merely asserting a string is present in source text. A
 *   prop-wiring regression (e.g. the wrong field passed to CampsiteCanvas, a
 *   conditional flipped, a testid typo) fails this test where a pure
 *   source-grep would not catch it.
 *
 * What this file CANNOT prove (documented limitation, not hidden):
 *   `renderToStaticMarkup` does not run effects (useEffect never fires during
 *   SSR) and does not commit refs (refs populate only during a real DOM commit
 *   phase). So CampsiteCanvas's mount effect never starts, `onReadyChange(true)`
 *   is never called, `rendererRef.current` stays null, and the
 *   activeKey→setActivity bridge effect in the shell never fires. Asserting
 *   "setActivity was called on the rendererRef after mount" for real requires
 *   an interactive DOM (jsdom) + `act()` — genuinely not achievable without
 *   the new dependency this dispatch does not authorize. Flagged in the PR
 *   report as a fast-follow if the team wants to add jsdom +
 *   @testing-library/react for true interactive mount coverage.
 *
 * matchMedia / EventSource / rAF are stubbed on globalThis anyway (per the
 * dispatch ask) so this file is forward-compatible the day an interactive DOM
 * renderer is introduced — but under plain SSR they are not on any code path
 * this test actually exercises (every window/document read in the component
 * tree is `typeof window !== "undefined"` guarded).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import StatusMapShell from "../app/status/map/campsite-scene";
import type { MapModel } from "../app/status/map/map-types";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

const BUILD_ROLES = [
  "architect",
  "ux-designer",
  "backend-engineer",
  "frontend-engineer",
  "devops-release",
  "qa-engineer",
  "security-reviewer",
];

function buildModel(): MapModel {
  return {
    projectPct: 42,
    gates: [
      { id: "CAM-900", title: "epic-a · [frontend-engineer] เรื่องทดสอบ", url: "https://example.test/CAM-900", epicKey: "epic-a", priority: "High" },
    ],
    agents: BUILD_ROLES.map((role, i) => ({
      role,
      name: role,
      active: i === 0, // architect is the only active agent
      done: 2,
      activeCount: i === 0 ? 1 : 0,
      queued: 1,
      task: i === 0
        ? { id: "CAM-901", title: "epic-a · [architect] งานที่กำลังทำ", startedAt: new Date().toISOString(), epicKey: "epic-a", feature: "Feature A" }
        : null,
    })),
    epicNames: ["epic-a"],
    epicsActive: 1,
    totalEpics: 1,
    backlogItems: [],
    envLanes: { dev: [], staging: [], prod: [] },
    epics: [
      {
        key: "epic-a",
        label: "Epic A",
        feature: "Feature A",
        persona: "Camper",
        bucket: "prog",
        stories: [
          {
            id: "CAM-901",
            title: "epic-a · [architect] งานที่กำลังทำ",
            status: "In Progress",
            statusType: "started",
            labels: ["architect"],
            role: "architect",
            url: "https://example.test/CAM-901",
            startedAt: new Date().toISOString(),
            completedAt: null,
          },
        ],
      },
    ],
  };
}

function renderShell(initialRenderer: "2d" | "3d" = "2d"): string {
  const model = buildModel();
  return renderToStaticMarkup(
    React.createElement(StatusMapShell, {
      model,
      token: "",
      initialScope: "all",
      initialEpic: "",
      initialGroup: "feature",
      initialEfilter: "all",
      initialRenderer,
    }),
  );
}

describe("StatusMapShell — CAM-372 (S1b) mount smoke test", () => {
  beforeEach(() => {
    // Forward-compat stubs (see file header) — not exercised by this SSR-only
    // render today, kept so an interactive-DOM follow-up drops in cleanly.
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    class FakeEventSource {
      onmessage: (() => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
    }
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 0) as unknown as number;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders without throwing for a populated model", () => {
    expect(() => renderShell()).not.toThrow();
  });

  it("renders the scene stage and the You agent (root testids present)", () => {
    const html = renderShell();
    expect(html).toContain('data-testid="scene--status-map-campsite"');
    expect(html).toContain('data-testid="stage--status-map"');
    expect(html).toContain('data-testid="btn--map-agent-you"');
  });

  it("renders a btn--map-agent-<role> for every one of the 7 build roles", () => {
    const html = renderShell();
    for (const role of BUILD_ROLES) {
      expect(html).toContain(`data-testid="btn--map-agent-${role}"`);
    }
  });

  it("renders the left and right HUD panel stacks", () => {
    const html = renderShell();
    expect(html).toContain('class="hud-left-panels"');
    expect(html).toContain('class="hud-right-panels"');
  });

  it("renders the filter chips (persona/feature/epic) driven by the epics prop", () => {
    const html = renderShell();
    expect(html).toContain('data-testid="btn--map-filter-persona"');
    expect(html).toContain('data-testid="btn--map-filter-feature"');
    expect(html).toContain('data-testid="btn--map-filter-epic"');
  });

  it("renders the mobile toolbar", () => {
    const html = renderShell();
    expect(html).toContain('data-testid="toolbar--map-mobile"');
  });

  // Real prop-flow proof: the active agent's task id must reach the rendered
  // badge text through shell → CampsiteCanvas → AgentScoutInner. This is the
  // kind of wiring break (wrong prop name, dropped field) a source-grep test
  // would not reliably catch but a render does.
  it("the active agent's task id renders in the AgentScout badge (real prop-flow proof)", () => {
    const html = renderShell();
    expect(html).toContain("CAM-901");
  });

  // Real conditional-render proof: gates.length > 0 must reach the You-alert
  // button through the SAME props object passed to CampsiteCanvas.
  it("the You alert renders when gates.length > 0 (real conditional-render proof)", () => {
    const html = renderShell();
    expect(html).toContain('data-testid="btn--map-you-alert"');
    expect(html).toContain("รอตรวจสอบ");
  });

  // RESOLVED (CAM-372 S1c fix): the SSR limitation noted above (no effects, no ref
  // commit under renderToStaticMarkup) is now covered by a real interactive-DOM test.
  // jsdom + @testing-library/react were added as devDependencies specifically for
  // this — see __tests__/status-map-shell-renderer-swap.test.ts (scoped to jsdom via
  // its own top-of-file pragma; this file and every other /status/map test stay on
  // the repo's default node environment). That file asserts "setActivity is observed
  // on the rendererRef after mount" for real, PLUS the renderer-swap regression this
  // fix guards (Prove-It verified: fails pre-fix, passes post-fix).

  // ── CAM-372 (S1c): 2D↔3D renderer toggle ────────────────────────────────────

  it("renders the renderer-toggle testids regardless of which renderer is selected", () => {
    // The toggle is shell-level chrome (always rendered), independent of which
    // renderer child (CampsiteCanvas / the ssr:false Canvas3D) is mounted.
    const html2d = renderShell("2d");
    const html3d = renderShell("3d");
    for (const html of [html2d, html3d]) {
      expect(html).toContain('data-testid="btn--map-renderer-2d"');
      expect(html).toContain('data-testid="btn--map-renderer-3d"');
      expect(html).toContain('role="radiogroup"');
    }
  });

  // Real behavioral proof (not a source-grep): the toggle's aria-checked state
  // actually reflects the `renderer` prop/state driving which child is mounted —
  // this would fail if the toggle's checked-state wiring were flipped or dropped.
  it("the toggle's aria-checked reflects the current renderer selection", () => {
    const html2d = renderShell("2d");
    const seg2dIn2d = html2d.slice(html2d.indexOf('data-testid="btn--map-renderer-2d"') - 80, html2d.indexOf('data-testid="btn--map-renderer-2d"'));
    const seg3dIn2d = html2d.slice(html2d.indexOf('data-testid="btn--map-renderer-3d"') - 80, html2d.indexOf('data-testid="btn--map-renderer-3d"'));
    expect(seg2dIn2d).toContain('aria-checked="true"');
    expect(seg3dIn2d).toContain('aria-checked="false"');

    const html3d = renderShell("3d");
    const seg2dIn3d = html3d.slice(html3d.indexOf('data-testid="btn--map-renderer-2d"') - 80, html3d.indexOf('data-testid="btn--map-renderer-2d"'));
    const seg3dIn3d = html3d.slice(html3d.indexOf('data-testid="btn--map-renderer-3d"') - 80, html3d.indexOf('data-testid="btn--map-renderer-3d"'));
    expect(seg2dIn3d).toContain('aria-checked="false"');
    expect(seg3dIn3d).toContain('aria-checked="true"');
  });

  // 2D remains the actual default renderer output when no explicit "3d" is passed
  // (mirrors the real page.tsx default: ?r= absent/anything-but-"3d" → "2d").
  it("renders the 2D sprite stage by default (initialRenderer='2d')", () => {
    const html = renderShell("2d");
    expect(html).toContain('data-testid="stage--status-map"');
  });

  // Canvas3D is dynamic(ssr:false) and selection-gated: under SSR (this test's
  // renderer) a "3d" render therefore shows NEITHER the 2D stage NOR the 3D stub
  // markup (next/dynamic({ssr:false}) renders null server-side by design) — but it
  // must NOT throw, and it must NOT fall back to showing the 2D stage.
  it("a 3d initialRenderer does not render the 2D stage (real branch-selection proof)", () => {
    expect(() => renderShell("3d")).not.toThrow();
    const html = renderShell("3d");
    expect(html).not.toContain('data-testid="stage--status-map"');
  });

  // Source-grep (SSR cannot observe a client-only dynamic import's actual chunk
  // behavior) — proves Canvas3D is selection-gated behind next/dynamic(ssr:false),
  // so `three` (added in S2) never loads on the default 2D path.
  // CAM-372 (S1c fix): Canvas3D moved from next/dynamic(..., {ssr:false}) to plain
  // React.lazy + a local <Suspense> — next/dynamic's runtime wrapper is itself a
  // forwardRef component whose own useImperativeHandle intercepts any ref passed to
  // it (exposing {retry, preload} instead of forwarding to the inner component), so
  // rendererRef.current resolved to Next's internal handle, not Canvas3DInner's
  // RendererHandle, and setActivity/setScope calls threw "not a function" — found
  // via status-map-shell-renderer-swap.test.ts (jsdom), fixed in the same commit as
  // the readySeq race. React.lazy still keeps Canvas3D selection-gated (its module,
  // and the `three` dependency S2 adds inside it, only loads when renderer==="3d").
  it("Canvas3D is imported via React.lazy — selection-gated, not eagerly bundled", () => {
    const sceneSrc = read("../app/status/map/campsite-scene.tsx");
    expect(sceneSrc).toContain('lazy(() => import("./canvas-3d")');
    // No actual next/dynamic IMPORT remains (the string still appears in explanatory
    // comments documenting why it was replaced — that's fine, this checks the import).
    expect(sceneSrc).not.toContain('from "next/dynamic"');
    // CAM-374: the Suspense fallback is <MapProgress/> (not null) — a full-screen
    // canvas module shows a progress indicator while the `three` chunk downloads,
    // per .claude/rules/loading.md, instead of a blank gap.
    expect(sceneSrc).toContain("<Suspense fallback={<MapProgress />}>");
    expect(sceneSrc).toContain('import { MapProgress } from "./map-progress"');
  });

  // Source-grep: initialRenderer threads server page → SceneLoader → the shell.
  it("initialRenderer threads page.tsx → scene-loader.tsx → campsite-scene.tsx", () => {
    const pageSrc = read("../app/status/map/page.tsx");
    const loaderSrc = read("../app/status/map/scene-loader.tsx");
    const sceneSrc = read("../app/status/map/campsite-scene.tsx");

    expect(pageSrc).toContain('sp.r === "3d" ? "3d" : "2d"');
    expect(pageSrc).toContain("initialRenderer={initialRenderer}");

    expect(loaderSrc).toContain("initialRenderer");
    expect(loaderSrc).toContain("initialRenderer={initialRenderer}");

    expect(sceneSrc).toContain('initialRenderer: "2d" | "3d"');
  });

  // Canvas3D contract: RendererHandle no-ops + onReadyChange(true)/(false) on
  // mount/unmount (source-grep — SSR cannot observe the effect actually firing,
  // see the file-header limitation note; this proves the CODE calls it correctly).
  //
  // CAM-373 (S2b): Canvas3D is no longer the S1c stub — it now imports `three`
  // and builds the real static 3D room, still selection-gated behind React.lazy
  // (see the "Canvas3D is imported via React.lazy" test above), so the default
  // 2D path's first-load JS is unaffected. Updated from asserting the ABSENCE of
  // a `three` import + the old `-stub` testid to asserting the new reality.
  it("canvas-3d.tsx imports three, reports ready on mount, and renders the real scene testid", () => {
    const src = read("../app/status/map/canvas-3d.tsx");
    expect(src).toContain("onReadyChange(true)");
    expect(src).toContain("onReadyChange(false)");
    expect(src).toContain('from "three"');
    expect(src).toContain('data-testid="scene--status-map-3d"');
  });
});
