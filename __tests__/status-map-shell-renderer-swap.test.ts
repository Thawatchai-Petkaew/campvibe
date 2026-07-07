// @vitest-environment jsdom
/**
 * status-map-shell-renderer-swap.test.ts — CAM-372 (S1c fix) interactive regression
 * test for the ready-nonce fix.
 *
 * Scoped to jsdom via the top-of-file pragma ONLY for this one file — the repo's
 * default vitest environment stays `node` (vitest.config.ts unchanged); every other
 * /status/map test keeps using the node-only source-inspection approach documented
 * across the rest of the status-map and cam-18x/25x test files.
 *
 * Why this file exists (the bug it guards):
 *   On a 3D→2D (or 2D→3D) renderer toggle, CampsiteCanvas is a STATIC import — it
 *   mounts synchronously in the SAME commit that unmounts the outgoing renderer.
 *   The outgoing renderer's cleanup fires onReadyChange(false); the incoming
 *   renderer's mount effect fires onReadyChange(true) — React batches both state
 *   updates into one flush, so the plain `rendererReady` BOOLEAN nets
 *   true → false → true = unchanged. Effects keyed only on that boolean
 *   (`[rendererReady, activeKey]` / `[..., rendererReady]`) then do NOT re-run, so
 *   the freshly-mounted 2D engine never receives setActivity/setScope — agents
 *   come back frozen/idle and epic-scope dimming is lost until the next reconcile
 *   that happens to change activeKey/epics (never, on a quiet board).
 *
 * The fix: a monotonic `readySeq` that increments ONLY on ready(true) (see
 * campsite-scene.tsx's `handleRendererReady`). A same-commit round-trip still
 * bumps it (false→true fires the bump), so effects keyed on `readySeq` always
 * re-fire for the newly-mounted renderer regardless of how the plain boolean
 * netted out.
 *
 * Mock approach: mock only `startEngine` from campsite-engine.ts (keep NODES/ADJ/
 * buildScoutState real) so it always returns the SAME spy-able handle object
 * (`engineHandleMock`) — every 2D mount (initial + every swap back to 2D) reuses
 * that handle, so asserting on `engineHandleMock.setActivity`/`setScope` proves the
 * shell is correctly driving whichever 2D engine instance is currently mounted.
 *
 * Prove-It (documented, not just claimed): both effects' deps were reverted to the
 * exact pre-fix shape (`[rendererReady, activeKey]` and `[..., rendererReady]`, i.e.
 * `readySeq` removed from the dep arrays only — `handleRendererReady` still bumps it
 * harmlessly since nothing reads it) and re-run against this same test file:
 *   - "calls setActivity on mount" still PASSED (a plain mount is a normal, un-batched
 *     transition — not the race; the fix does not change that behavior).
 *   - "re-applies setActivity AND setScope on a 3D→2D swap" FAILED red — 0 calls to
 *     setActivity/setScope after the swap, exactly the predicted symptom.
 * Restoring `readySeq` in both dep arrays turned it green again. This isolated
 * revert (not a bulk stash of the whole diff) is what proves readySeq specifically —
 * not some other change in the same commit — is what the second test depends on.
 *
 * Bonus finding while building this test (fixed in the same commit, unrelated to the
 * readySeq race): Canvas3D was originally `next/dynamic(() => import("./canvas-3d"),
 * { ssr:false })`. next/dynamic's runtime wrapper is ITSELF a forwardRef component
 * whose own useImperativeHandle exposes `{retry, preload}` for its internal retry
 * mechanism — passing `ref={rendererRef}` to it silently resolved to that `{retry}`
 * object instead of Canvas3DInner's RendererHandle, so every setActivity/setScope
 * call would throw "not a function" the moment a user switched to 3D (worse than the
 * readySeq race — a real crash, on every render while 3D was mounted). Fixed by
 * switching to plain `React.lazy` + a local `<Suspense fallback={null}>` (no such
 * wrapper; the ref forwards straight through). See campsite-scene.tsx's Canvas3D
 * declaration for the full note.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import StatusMapShell from "../app/status/map/campsite-scene";
import type { MapModel } from "../app/status/map/map-types";

// ── Mock the 2D engine's startEngine so every mount returns the SAME spy handle ──
const { engineHandleMock } = vi.hoisted(() => {
  return {
    engineHandleMock: {
      triggerWalk: vi.fn(),
      setScope: vi.fn(),
      setHomes: vi.fn(),
      setActivity: vi.fn(),
      stop: vi.fn(),
    },
  };
});

vi.mock("../app/status/map/campsite-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../app/status/map/campsite-engine")>();
  return {
    ...actual,
    // Real NODES/ADJ/buildScoutState stay real; only the rAF engine is replaced
    // with a spy-able no-op handle (same object identity across every mount).
    startEngine: vi.fn(() => engineHandleMock),
  };
});

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
    gates: [],
    // architect is the only active agent — this is the activeByRole map we expect
    // setActivity to be called with, on every (re-)mount of the 2D engine.
    agents: BUILD_ROLES.map((role, i) => ({
      role,
      name: role,
      active: i === 0,
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
        stories: [],
      },
    ],
  };
}

const expectedActiveByRole = Object.fromEntries(
  BUILD_ROLES.map((role, i) => [role, i === 0]),
);

describe("StatusMapShell — CAM-372 (S1c fix): renderer-swap re-applies setActivity/setScope", () => {
  beforeEach(() => {
    localStorage.clear();
    engineHandleMock.setActivity.mockClear();
    engineHandleMock.setScope.mockClear();
    engineHandleMock.stop.mockClear();

    // jsdom does not implement matchMedia — stub it so CampsiteCanvas's mount
    // effect proceeds past the reduced-motion / width checks (matches:false =
    // NOT reduced-motion → the rAF loop "starts" immediately, i.e. startEngine()
    // — our mock — is invoked and onReadyChange(true) fires synchronously).
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));

    // useMapReconcile opens an EventSource on mount; stub it so the constructor
    // doesn't throw (caught either way, but keep parity with the SSR smoke test).
    class FakeEventSource {
      onmessage: (() => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();
    }
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderShell() {
    const model = buildModel();
    return render(
      React.createElement(StatusMapShell, {
        model,
        token: "",
        initialScope: "all",
        initialEpic: "",
        initialGroup: "feature",
        initialEfilter: "all",
        initialRenderer: "2d",
      }),
    );
  }

  // Resolves the S1b `it.todo` left in status-map-shell.test.ts: this is the real,
  // interactive-DOM assertion that renderToStaticMarkup could not provide (no
  // effects, no ref commit under SSR).
  it("calls setActivity on mount with the active agent true (real mount + effect proof)", () => {
    act(() => {
      renderShell();
    });

    expect(screen.getByTestId("stage--status-map")).toBeTruthy();
    expect(engineHandleMock.setActivity).toHaveBeenCalledWith(expectedActiveByRole);
  });

  // The exact bug scenario the adversarial review caught.
  it("re-applies setActivity AND setScope on a 3D→2D swap (the ready-nonce fix)", async () => {
    act(() => {
      renderShell();
    });
    // Sanity: the initial 2D mount already called setActivity once (previous test).
    expect(engineHandleMock.setActivity).toHaveBeenCalledWith(expectedActiveByRole);

    // Toggle 2D → 3D. CampsiteCanvas unmounts synchronously (engine.stop() fires in
    // this same commit) but Canvas3D is dynamic(ssr:false) — its REAL component
    // mounts one tick later once the (already-bundled, still-async) import resolves.
    // Wait for Canvas3D's own testid so the 3D side is GENUINELY settled (ready)
    // before toggling back — otherwise the 3D→2D click below would race the
    // leftover 2D→3D async resolution instead of testing the real same-commit
    // 3D→2D round-trip the bug is about (CampsiteCanvas is a STATIC import, so
    // that direction always mounts synchronously, unlike the 2D→3D direction).
    fireEvent.click(screen.getByTestId("btn--map-renderer-3d"));
    await waitFor(() => {
      expect(screen.getByTestId("scene--status-map-3d")).toBeTruthy();
    });
    expect(engineHandleMock.stop).toHaveBeenCalledTimes(1);

    // Clear call history so the next assertions are unambiguous about the SECOND
    // 2D mount (the swap back), not the first.
    engineHandleMock.setActivity.mockClear();
    engineHandleMock.setScope.mockClear();

    // Toggle 3D → 2D — NOW a genuine same-commit round-trip: Canvas3D (fully
    // mounted, confirmed above) unmounts (cleanup fires onReadyChange(false)) and
    // CampsiteCanvas (static import) mounts synchronously in the SAME commit
    // (onReadyChange(true)) — React batches both state updates into one flush.
    // Pre-fix, the plain rendererReady boolean nets true→false→true = unchanged
    // and the activity/scope effects never re-fire; this assertion is exactly what
    // caught that bug (confirmed red pre-fix, green post-fix — see file header).
    act(() => {
      fireEvent.click(screen.getByTestId("btn--map-renderer-2d"));
    });

    expect(engineHandleMock.setActivity).toHaveBeenCalledWith(expectedActiveByRole);
    // The fused scope+syncUrl effect also re-fires — scope is "all" here (no active
    // epic filter in this fixture), so the freshly-mounted engine gets setScope("all", []).
    expect(engineHandleMock.setScope).toHaveBeenCalledWith("all", []);
  });
});
