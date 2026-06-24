// GET /status/map/data — returns the same MapModel JSON that /status/map renders.
//
// Token gate: identical parity check to /api/status/stream/route.ts
//   — STATUS_TOKEN env var (absent = open; present = token param must match).
//
// Cache: the existing 60s pulse-keyed unstable_cache inside fetchStatusIssues
//   is reused automatically here — no extra Linear load from the reconcile fetch.
//
// Used by: campsite-scene.tsx SSE reconcile (S6) — on a pulse event it fetches
//   this endpoint and merges the new MapModel into the running engine without
//   remounting the rAF loop or any React subtree.

import { fetchStatusIssues } from "@/lib/linear";
import { readPulse } from "@/lib/status-pulse";
import { buildMapModel } from "@/lib/status-map-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return true; // parity with /status page and stream route
  return new URL(req.url).searchParams.get("token") === required;
}

export async function GET(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let pulse = 0;
    try {
      pulse = await readPulse();
    } catch {
      /* pulse unavailable → fall back to the 60s time cache */
    }

    const issues = await fetchStatusIssues(pulse);
    const model = buildMapModel(issues);

    return new Response(JSON.stringify(model), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
