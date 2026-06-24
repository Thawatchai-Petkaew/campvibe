/**
 * POST /api/status/pulse — manually bump the live /status + /map refresh pulse.
 *
 * This is a SECONDARY pulse trigger. The Linear webhook (app/api/linear-webhook/route.ts) is the
 * primary one — it bumps the pulse on every Issue change. But if that webhook is down or not yet
 * registered for this environment, no transition refreshes the board. scripts/linear-sync.mjs
 * calls this endpoint (best-effort) after every write so the dashboards stay fresh regardless.
 *
 * Guard: STATUS_TOKEN (the same gate as /status). Absent = open (dev); present = the request must
 * carry it via `x-status-token` header or `?token=`. No business data — just a monotonic refresh
 * counter (lib/status-pulse).
 */
import { NextResponse } from "next/server";
import { bumpPulse } from "@/lib/status-pulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return true; // no token configured → open (matches /status/map/data convention)
  const header = req.headers.get("x-status-token");
  const query = new URL(req.url).searchParams.get("token");
  return header === required || query === required;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await bumpPulse();
  return NextResponse.json({ ok: true });
}
