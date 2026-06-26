"use client";
import dynamic from "next/dynamic";
import type { MapModel } from "./campsite-scene";

// CAM-198: Loading fallback — indeterminate progress bar on the night scene.
// The glass card (.map-placeholder) is replaced with a slim amber bar.
// SCENE background is always rendered by page.tsx (keep it); this adds only the
// progress indicator. role=progressbar + aria-busy satisfies AC-4 (screen reader).
const CampsiteScene = dynamic(() => import("./campsite-scene"), {
  ssr: false,
  loading: () => (
    <div className="map-wrap" role="status" aria-live="polite" aria-label="กำลังโหลดแผนที่แคมป์">
      <div
        className="map-progress"
        data-testid="loading--status-map"
        role="progressbar"
        aria-busy="true"
        aria-label="กำลังโหลดแผนที่แคมป์"
      >
        <span className="map-progress-bar" aria-hidden="true" />
      </div>
    </div>
  ),
});

interface Props {
  model: MapModel;
  token: string;
  initialScope: "all" | "epic";
  initialEpic: string;
  initialGroup: "feature" | "persona";
  initialEfilter: "all" | "prog" | "done" | "todo";
  /** CAM-164 dev tool: render a % coordinate grid overlay when true (?grid=1). */
  debugGrid?: boolean;
}

export default function SceneLoader({
  model,
  token,
  initialScope,
  initialEpic,
  initialGroup,
  initialEfilter,
  debugGrid = false,
}: Props) {
  return (
    <CampsiteScene
      model={model}
      token={token}
      initialScope={initialScope}
      initialEpic={initialEpic}
      initialGroup={initialGroup}
      initialEfilter={initialEfilter}
      debugGrid={debugGrid}
    />
  );
}
