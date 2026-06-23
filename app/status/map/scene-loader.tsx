"use client";
import dynamic from "next/dynamic";
import type { MapModel } from "./campsite-scene";

const CampsiteScene = dynamic(() => import("./campsite-scene"), {
  ssr: false,
  loading: () => (
    <div className="map-wrap">
      <div className="map-placeholder">
        <p className="map-placeholder-text">กำลังโหลดแผนที่แคมป์</p>
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
}

export default function SceneLoader({
  model,
  token,
  initialScope,
  initialEpic,
  initialGroup,
  initialEfilter,
}: Props) {
  return (
    <CampsiteScene
      model={model}
      token={token}
      initialScope={initialScope}
      initialEpic={initialEpic}
      initialGroup={initialGroup}
      initialEfilter={initialEfilter}
    />
  );
}
