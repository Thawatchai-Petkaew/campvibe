/**
 * POST /api/status/reject — reject a gate issue.
 *
 * Single mutation path (ADR-010 "single mutation path, no webhook" — CAM-281 T-5b retired
 * the legacy Linear branch): calls lib/delivery/tickets.ts's `reject(note)` verb —
 * AWAITING_GATE -> IN_PROGRESS, changesRequested=true, regressionRound += 1 (ADR-010
 * transition table); the reason is persisted as the TicketEvent.note. The service itself
 * sends the "rejected" Telegram notification (ADR-010 "single mutation path, no webhook") —
 * do not duplicate it here.
 *
 * Auth: STATUS_TOKEN via `?token=` query param OR `x-status-token` header.
 * Rate-limit: 20 req/min per IP (in-process sliding window, best-effort on serverless).
 * Errors: 400 bad id · 401 unauthorized · 429 rate-limited · 500 internal (no stack).
 *
 * Security: `reason` is plain text persisted as a TicketEvent note — capped at 2000 chars
 * to prevent unbounded payloads; never exec'd or put into a prompt.
 */
import { NextResponse } from "next/server";
import { reject as rejectTicket } from "@/lib/delivery/tickets";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStatusRequestAuthorized } from "@/lib/status-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REASON = "ส่งกลับให้แก้ไขจาก /status/map";
const MAX_REASON_LEN = 2000;
const ID_RE = /^[A-Z]+-\d+$/;

/** See app/api/status/approve/route.ts's DB_ACTOR comment — same trust model, same surface. */
const DB_ACTOR = "owner (status-map)";

export async function POST(req: Request) {
  // Shared STATUS_TOKEN gate (lib/status-auth.ts — CAM-275): default-deny — missing
  // STATUS_TOKEN → 401 (no open fallback).
  if (!isStatusRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rate-limit: 20 req/min per IP.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`status:reject:${ip}`, { limit: 20, windowMs: 60_000 });
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

  const { id, reason } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== "string" || !ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  // Sanitize reason: plain text, capped length. Never exec'd or put into a prompt.
  const safeReason =
    typeof reason === "string" && reason.trim().length > 0
      ? reason.trim().slice(0, MAX_REASON_LEN)
      : DEFAULT_REASON;

  try {
    await rejectTicket(id, DB_ACTOR, safeReason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // A not-found / not-awaiting-a-gate ticket is a silent no-op — the map UI has never had
    // to handle a 404/400 for this endpoint.
    if (
      err instanceof TicketNotFoundError ||
      (err instanceof TicketTransitionError && err.code === "invalid_state")
    ) {
      return NextResponse.json({ ok: true });
    }
    console.error(
      JSON.stringify({
        event: "status_reject_failed",
        id,
        reason: err instanceof Error ? err.message : String(err),
      })
    );
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
