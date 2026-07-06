/**
 * status-map-shell.test.ts — CAM-372 (S1b) StatusMapShell mount smoke test.
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
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import StatusMapShell from "../app/status/map/campsite-scene";
import type { MapModel } from "../app/status/map/map-types";

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

function renderShell(): string {
  const model = buildModel();
  return renderToStaticMarkup(
    React.createElement(StatusMapShell, {
      model,
      token: "",
      initialScope: "all",
      initialEpic: "",
      initialGroup: "feature",
      initialEfilter: "all",
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

  // Documents (does not silently skip) the known SSR limitation — see file header.
  it.todo(
    "[follow-up, needs jsdom] setActivity is observed on the rendererRef once CampsiteCanvas reports ready " +
    "— requires an interactive DOM (jsdom) + act() to run the mount effect and commit the ref; " +
    "not achievable under renderToStaticMarkup (no effects, no ref commit).",
  );
});
