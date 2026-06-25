/**
 * POST /api/status/approve — approve a gate issue by removing its `awaiting-you` label.
 *
 * This is a thin, server-only wrapper around removeAwaitingYou().  The downstream
 * "Approved" Telegram notification + repository_dispatch are handled by the Linear
 * webhook (app/api/linear-webhook/route.ts) — the SINGLE source.  Do not duplicate
 * that logic here.
 *
 * Auth: STATUS_TOKEN via `?token=` query param OR `x-status-token` header.
 * Rate-limit: 20 req/min per IP (in-process sliding window, best-effort on serverless).
 * Errors: 400 bad id · 401 unauthorized · 429 rate-limited · 500 internal (no stack).
 */
import { NextResponse } from "next/server";
import { removeAwaitingYou } from "@/lib/linear-actions";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reuse the STATUS_TOKEN gate: ?token= query param OR x-status-token header. */
function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return true;
  const url = new URL(req.url);
  const query = url.searchParams.get("token");
  const header = req.headers.get("x-status-token");
  return query === required || header === required;
}

/** Linear issue identifier, e.g. CAM-184 or CAM-10. */
const ID_RE = /^[A-Z]+-\d+$/;

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rate-limit: 20 req/min per IP (protects the Linear API from bulk abuse).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`status:approve:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { id } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== "string" || !ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const approved = await removeAwaitingYou(id);
    return NextResponse.json({ ok: true, approved });
  } catch {
    // Log the error server-side; never surface stack/internals to the client.
    console.error("[approve] removeAwaitingYou failed", { id });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
