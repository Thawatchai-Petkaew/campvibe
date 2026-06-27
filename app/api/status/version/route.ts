// Lightweight pulse-version endpoint: a cheap poll fallback for /status and the
// observable signal used by tests + manual verification. Returns only an integer.
// SEC-A: token is always required; rate-limited 60 req/min per IP.
import { NextResponse } from "next/server";
import { readPulse } from "@/lib/status-pulse";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SEC-A: token is always required — missing STATUS_TOKEN → 401 (no open fallback). */
function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return false; // token must be configured; no unauthenticated access
  return new URL(req.url).searchParams.get("token") === required;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // SEC-A: rate-limit 60 req/min per IP.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`status:version:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  return NextResponse.json({ version: await readPulse() });
}
