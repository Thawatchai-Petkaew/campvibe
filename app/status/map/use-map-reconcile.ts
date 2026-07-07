"use client";

// CAM-372 (S1a): extracted verbatim from campsite-scene.tsx's S6 SSE-reconcile
// useEffect (behavior-preserving — same endpoints, same guard, same backoff).
//
// S6: liveModel is the authoritative data — starts from the SSR initial value,
// updated by the SSE reconcile. Callers should read from the returned liveModel,
// never from the stale initial model directly (frozen after first render in the
// dynamic component).

import { useEffect, useRef, useState } from "react";
import { payloadChanged } from "@/lib/status-map-model";
import type { MapModel } from "./map-types";

/**
 * Subscribes to /api/status/stream (SSE) with a 15s fallback poll against
 * /status/map/data, and returns the latest reconciled MapModel — starting
 * from `initialModel` (the SSR value) until the first real change arrives.
 */
export function useMapReconcile(token: string, initialModel: MapModel): MapModel {
  const [liveModel, setLiveModel] = useState<MapModel>(initialModel);

  // CAM-176 — no-op reconcile guard: tracks the last serialized payload so we can skip
  // setLiveModel when the server returns identical data. Init to the SSR model's JSON so
  // the very first poll of an unchanged board is already a no-op.
  const lastPayloadRef = useRef<string>(JSON.stringify(initialModel));

  // S6: SSE reconcile — subscribe to /api/status/stream exactly like dashboard-client.tsx
  // (same backoff + 15s fallback interval). On a pulse event, fetch the new MapModel from
  // /status/map/data and merge it into the running engine without remounting.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 15s fallback poll: re-fetch MapModel data without router.refresh (which would remount).
    // CAM-175: reduced from 60s to ≤15s to meet the freshness AC.
    const FALLBACK_MS = 15_000;
    let fallbackId: ReturnType<typeof setInterval> | null = null;

    async function reconcile() {
      try {
        const qs = token ? `?token=${encodeURIComponent(token)}` : "";
        const res = await fetch(`/status/map/data${qs}`);
        if (!res.ok) return; // S7: non-ok response — keep last-known data, don't crash
        const text = await res.text();
        // CAM-176 — no-op guard: skip re-render when payload is byte-identical to the
        // last seen value. The /status/map/data route serializes ABSOLUTE timestamps from
        // Linear (startedAt / completedAt), so an unchanged board produces an identical
        // JSON string across polls — the text compare is a reliable no-change signal.
        // A real change → text differs → setLiveModel → one update (expected, not flicker).
        if (!payloadChanged(lastPayloadRef.current, text)) return;
        lastPayloadRef.current = text;

        // Update React state — overlays re-render, and the setActivity effect (keyed on
        // the agents' active flags) drives wander/rest. No per-pulse triggerWalk loop:
        // it yanked active wanderers home on every pulse (breaking continuous, random
        // wandering) and could redirect a mid-walk agent on a path across the campfire.
        setLiveModel(JSON.parse(text) as MapModel);
      } catch {
        // S7: transient fetch error — keep last-known liveModel, don't crash or blank.
        // Next poll or SSE event will retry.
      }
    }

    fallbackId = setInterval(reconcile, FALLBACK_MS);

    // Real-time push via SSE — same pattern as dashboard-client.tsx.
    let es: EventSource | null = null;
    let guard = 0;

    function openStream() {
      try {
        const qs = token ? `?token=${encodeURIComponent(token)}` : "";
        es = new EventSource(`/api/status/stream${qs}`);
        es.onmessage = () => {
          guard = 0;
          void reconcile();
        };
        es.onerror = () => {
          if (es && es.readyState === EventSource.CLOSED) {
            es.close();
            es = null;
            if (guard++ < 5) setTimeout(openStream, 5000 * guard);
          }
        };
      } catch {
        /* SSE unsupported → the 15s fallback interval still reconciles */
      }
    }

    openStream();

    return () => {
      if (fallbackId !== null) clearInterval(fallbackId);
      es?.close();
    };
  }, [token]); // token is stable after mount; reconnect only if it changes

  return liveModel;
}
