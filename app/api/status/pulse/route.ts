/**
 * POST /api/status/pulse — manually bump the live /status + /map refresh pulse.
 *
 * CAM-287: switched from lib/status-pulse.ts (StatusPulse) to lib/delivery/pulse.ts
 * (DeliveryPulse — bumped in-process by every lib/delivery/tickets.ts mutation, ADR-010
 * "single mutation path, no webhook"). This keeps the endpoint bumping the SAME counter
 * app/api/status/stream/route.ts's SSE loop now polls, so a manual call here still causes
 * connected /status dashboards to refresh. Before this story, this endpoint bumped the
 * legacy StatusPulse (the pre-CAM-281 Linear webhook's counter); that write is no longer
 * useful since the SSE stream stopped reading it — see lib/status-pulse.ts's header for
 * the remaining (read-only) legacy consumers.
 *
 * Guard: STATUS_TOKEN (the same gate as /status). Must always be set; token is required — a
 * missing STATUS_TOKEN returns 401 (no open fallback). The request must carry it via
 * `x-status-token` header or `?token=`. No business data — just a monotonic refresh counter
 * (lib/delivery/pulse.ts).
 * Rate-limit: 30 req/min per IP.
 */
import { NextResponse } from "next/server";
import { bumpDeliveryPulse } from "@/lib/delivery/pulse";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStatusRequestAuthorized } from "@/lib/status-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Shared STATUS_TOKEN gate (lib/status-auth.ts — CAM-275): default-deny — missing
  // STATUS_TOKEN → 401 (no open fallback).
  if (!isStatusRequestAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // SEC-A: rate-limit 30 req/min per IP.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`status:pulse:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  await bumpDeliveryPulse();
  return NextResponse.json({ ok: true });
}
