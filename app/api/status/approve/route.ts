/**
 * POST /api/status/approve — approve a gate issue.
 *
 * Single mutation path (ADR-010 "single mutation path, no webhook" — CAM-281 T-5b retired
 * the legacy Linear branch): calls lib/delivery/tickets.ts's `approve()` verb —
 * AWAITING_GATE -> IN_PROGRESS (the ADR-010 "gate-clear, not terminal" verb; `complete()`
 * is the separate terminal-gate verb, not used by this generic approve button). The
 * service itself sends the "approved" Telegram notification AND fires the
 * repository_dispatch in the SAME call — there is no webhook to relay from, so this route
 * must NOT also notify/dispatch (would double-send).
 *
 * Auth: STATUS_TOKEN via `?token=` query param OR `x-status-token` header.
 * Rate-limit: 20 req/min per IP (in-process sliding window, best-effort on serverless).
 * Errors: 400 bad id · 401 unauthorized · 429 rate-limited · 500 internal (no stack).
 */
import { NextResponse } from "next/server";
import { approve as approveTicket } from "@/lib/delivery/tickets";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStatusRequestAuthorized } from "@/lib/status-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ticket identifier, e.g. CAM-184 or CAM-10. */
const ID_RE = /^[A-Z]+-\d+$/;

/**
 * Free-text actor for the delivery-ticket audit ledger (G2-locked — no FK to a User table,
 * see lib/delivery/tickets.ts top comment). This route has no NextAuth session; its only
 * possible caller is the human owner clicking Approve on /status/map (gated by STATUS_TOKEN
 * above), so a static, descriptive actor string is correct — not a guess.
 */
const DB_ACTOR = "owner (status-map)";

export async function POST(req: Request) {
  // Shared STATUS_TOKEN gate (lib/status-auth.ts — CAM-275): ?token= query param OR
  // x-status-token header; default-deny — missing STATUS_TOKEN → 401 (no open fallback).
  if (!isStatusRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rate-limit: 20 req/min per IP (protects the delivery DB from bulk abuse).
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
    await approveTicket(id, DB_ACTOR);
    return NextResponse.json({ ok: true, approved: true });
  } catch (err) {
    // A not-found / not-awaiting-a-gate ticket is a no-op, not a failure — the map UI sees
    // {ok:true,approved:false} instead of an error toast for a ticket that simply isn't
    // awaiting a gate anymore.
    if (
      err instanceof TicketNotFoundError ||
      (err instanceof TicketTransitionError && err.code === "invalid_state")
    ) {
      return NextResponse.json({ ok: true, approved: false });
    }
    console.error(
      JSON.stringify({
        event: "status_approve_failed",
        id,
        reason: err instanceof Error ? err.message : String(err),
      })
    );
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
