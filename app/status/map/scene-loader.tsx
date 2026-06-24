"use client";
import dynamic from "next/dynamic";
import type { MapModel } from "./campsite-scene";

// S7: Loading placeholder — shows the night background (already rendered by SCENE in page.tsx)
// plus a labelled placeholder that is accessible and never blank.
const CampsiteScene = dynamic(() => import("./campsite-scene"), {
  ssr: false,
  loading: () => (
    <div className="map-wrap" role="status" aria-live="polite" aria-label="กำลังโหลดแผนที่แคมป์">
      <div className="map-placeholder" data-testid="loading--status-map">
        <p className="map-placeholder-text">กำลังโหลดแผนที่แคมป์…</p>
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
