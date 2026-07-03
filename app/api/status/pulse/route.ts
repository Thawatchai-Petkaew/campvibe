/**
 * POST /api/status/pulse — manually bump the live /status + /map refresh pulse.
 *
 * Legacy pulse trigger for the Linear-sourced read path only (TICKETS_SOURCE=linear —
 * lib/linear.ts's cachedStatusIssues, keyed on this pulse). CAM-281 (T-5b) retired the
 * Linear event webhook that used to bump this pulse automatically on every Issue change;
 * the deprecated scripts/linear-sync.mjs still calls this endpoint (best-effort) after a
 * write so the Linear-sourced dashboards stay fresh regardless. The default delivery-DB
 * read path (TICKETS_SOURCE unset/"db") has its own pulse — lib/delivery/pulse.ts, bumped
 * in-process by every lib/delivery/tickets.ts mutation — and does not need this endpoint.
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

  await bumpPulse();
  return NextResponse.json({ ok: true });
}
