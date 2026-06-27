/**
 * POST /api/status/pulse — manually bump the live /status + /map refresh pulse.
 *
 * This is a SECONDARY pulse trigger. The Linear webhook (app/api/linear-webhook/route.ts) is the
 * primary one — it bumps the pulse on every Issue change. But if that webhook is down or not yet
 * registered for this environment, no transition refreshes the board. scripts/linear-sync.mjs
 * calls this endpoint (best-effort) after every write so the dashboards stay fresh regardless.
 *
 * Guard: STATUS_TOKEN (the same gate as /status). Must always be set; token is required — a
 * missing STATUS_TOKEN returns 401 (no open fallback). The request must carry it via
 * `x-status-token` header or `?token=`. No business data — just a monotonic refresh counter
 * (lib/status-pulse).
 * Rate-limit: 30 req/min per IP.
 */
import { NextResponse } from "next/server";
import { bumpPulse } from "@/lib/status-pulse";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SEC-A: token is always required — missing STATUS_TOKEN → 401 (no open fallback). */
function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return false; // token must be configured; no unauthenticated access
  const header = req.headers.get("x-status-token");
  const query = new URL(req.url).searchParams.get("token");
  return header === required || query === required;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // SEC-A: rate-limit 30 req/min per IP.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`status:pulse:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  await bumpPulse();
  return NextResponse.json({ ok: true });
}
