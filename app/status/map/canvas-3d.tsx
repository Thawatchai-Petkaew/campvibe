"use client";

// Canvas3D — CAM-372 (S1c) STUB. The real 3D scene ships in S2 (CAM-373); this
// component only proves the renderer-toggle seam end-to-end:
//   - implements RendererHandle (map-types.ts) via useImperativeHandle as no-ops,
//     so the shell's activeKey→setActivity and scope+syncUrl bridges never throw
//     when 3D is selected (they just do nothing — there is nothing to animate yet).
//   - reports ready on mount / not-ready on unmount via onReadyChange, so
//     rendererReady re-gates cleanly on every 2D↔3D swap.
//   - renders a centered placeholder reusing the EXISTING `.map-placeholder` /
//     `.map-placeholder-text` glass-card idiom (app/status/map/campsite-assets.ts
//     CSS — already injected page-wide by page.tsx) instead of introducing any
//     new global token.
//
// Deliberately does NOT import `three` — S2 adds the real dependency. This keeps
// the S1 bundle for the default (2D) path unchanged; `three` only ever loads if a
// user actually switches to 3D (selection-gated dynamic import in campsite-scene.tsx).

import { forwardRef, useEffect, useImperativeHandle } from "react";
import type { RendererHandle } from "./map-types";
import type { CampsiteCanvasProps } from "./campsite-canvas";

const COPY = {
  title: "กำลังพัฒนามุมมอง 3 มิติ",
  subtitle: "เร็ว ๆ นี้ ตอนนี้สลับกลับไปมุมมอง 2 มิติได้ตามปกติ",
} as const;

function Canvas3DInner(
  { onReadyChange }: CampsiteCanvasProps,
  ref: React.ForwardedRef<RendererHandle>,
) {
  // No-op handle — satisfies the RendererHandle contract with nothing to animate yet.
  useImperativeHandle(ref, () => ({
    setActivity: () => {},
    setScope: () => {},
    triggerWalk: () => {},
  }), []);

  // Report ready immediately (nothing to load in a stub) so the shell's effects
  // don't hang waiting; report not-ready on unmount so a 3D→2D swap re-arms cleanly.
  useEffect(() => {
    onReadyChange(true);
    return () => onReadyChange(false);
  }, [onReadyChange]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      data-testid="scene--status-map-3d-stub"
    >
      <div className="map-placeholder" role="status" aria-live="polite">
        <p className="map-placeholder-text">{COPY.title}</p>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>{COPY.subtitle}</p>
      </div>
    </div>
  );
}

const Canvas3D = forwardRef(Canvas3DInner);
Canvas3D.displayName = "Canvas3D";

export default Canvas3D;
