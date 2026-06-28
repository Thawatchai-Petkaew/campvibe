// CAM-248 (LOAD-4): MapProgress — extracted from scene-loader.tsx (CAM-198).
// Shared progress indicator for /status/map: used by SceneLoader's next/dynamic
// loading fallback AND by app/status/map/loading.tsx (route-level loading boundary).
//
// Renders standalone — does NOT depend on page.tsx's dangerouslySetInnerHTML CSS.
// Inline styles replicate the .map-wrap / .map-progress / .map-progress-bar tokens
// from campsite-assets.ts so the route-level loading.tsx has a self-contained UI
// on a dark full-screen background consistent with the night-scene map.
//
// a11y: role="progressbar" + aria-busy on the bar; role="status" + aria-live="polite"
// on the outer wrap. prefers-reduced-motion: the sweep animation is defined only in
// campsite-assets.ts CSS for the scene-loader usage; the standalone CSS here mirrors it
// with the same @media guard.

export function MapProgress() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="กำลังโหลดแผนที่แคมป์"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10,
        background: "#070d1c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Standalone CSS: mirrors campsite-assets.ts map-progress rules for use
          outside the page's dangerouslySetInnerHTML <style> block. */}
      <style>{`
        .map-progress-standalone {
          width: min(280px, 60vw);
          height: 3px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          overflow: hidden;
        }
        .map-progress-standalone-bar {
          display: block;
          height: 100%;
          width: 50%;
          border-radius: 999px;
          background: #FFB454;
          box-shadow: 0 0 8px #FFB454, 0 0 16px rgba(255, 180, 84, 0.4);
        }
        @media (prefers-reduced-motion: no-preference) {
          .map-progress-standalone-bar {
            animation: map-sweep-standalone 1.4s cubic-bezier(0.65, 0, 0.35, 1) infinite;
          }
        }
        @keyframes map-sweep-standalone {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(240%); }
        }
      `}</style>
      <div
        className="map-progress-standalone"
        data-testid="loading--status-map"
        role="progressbar"
        aria-busy="true"
        aria-label="กำลังโหลดแผนที่แคมป์"
      >
        <span className="map-progress-standalone-bar" aria-hidden="true" />
      </div>
    </div>
  );
}
