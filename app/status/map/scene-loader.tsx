"use client";
import dynamic from "next/dynamic";
import type { MapModel } from "./campsite-scene";
import { MapProgress } from "./map-progress";

// CAM-198: Loading fallback — indeterminate progress bar on the night scene.
// The glass card (.map-placeholder) is replaced with a slim amber bar.
// SCENE background is always rendered by page.tsx (keep it); this adds only the
// progress indicator. role=progressbar + aria-busy satisfies AC-4 (screen reader).
//
// CAM-248 (LOAD-4): progress markup extracted to MapProgress (map-progress.tsx)
// and reused here + in app/status/map/loading.tsx (route-level loading boundary).
const CampsiteScene = dynamic(() => import("./campsite-scene"), {
  ssr: false,
  loading: () => <MapProgress />,
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
