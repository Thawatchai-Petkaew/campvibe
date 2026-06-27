/**
 * POST /api/status/reject — reject a gate issue: post the owner's comment, add the
 * `changes-requested` label, then remove `awaiting-you`.
 *
 * Order is intentional:
 *   1. addComment   — persist the reason before any label changes
 *   2. addLabel     — mark the issue as changes-requested
 *   3. removeAwaitingYou — clear the gate; the Linear webhook sees `awaiting-you`
 *      removed AND `changes-requested` present → fires "Sent back" Telegram and
 *      does NOT fire the proceed-dispatch (see app/api/linear-webhook/route.ts).
 *
 * Auth: STATUS_TOKEN via `?token=` query param OR `x-status-token` header.
 * Rate-limit: 20 req/min per IP (in-process sliding window, best-effort on serverless).
 * Errors: 400 bad id · 401 unauthorized · 429 rate-limited · 500 internal (no stack).
 *
 * Security: `reason` is plain text written to a Linear comment — capped at 2000 chars
 * to prevent unbounded payloads; never exec'd or put into a prompt.
 */
import { NextResponse } from "next/server";
import { addComment, addLabel, removeAwaitingYou } from "@/lib/linear-actions";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REASON = "ส่งกลับให้แก้ไขจาก /status/map";
const MAX_REASON_LEN = 2000;
const ID_RE = /^[A-Z]+-\d+$/;

/** SEC-A: token is always required — missing STATUS_TOKEN → 401 (no open fallback). */
function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return false; // token must be configured; no unauthenticated access
  const url = new URL(req.url);
  const query = url.searchParams.get("token");
  const header = req.headers.get("x-status-token");
  return query === required || header === required;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
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
    // 1. Post the owner's reason as a Linear comment (persists even if later steps fail).
    await addComment(id, safeReason);

    // 2. Add the `changes-requested` label so the orchestrator knows it was rejected.
    await addLabel(id, "changes-requested");

    // 3. Remove `awaiting-you` — this fires the Linear webhook which sends "Sent back"
    //    Telegram notification (single source) and does NOT fire proceed-dispatch.
    await removeAwaitingYou(id);

    return NextResponse.json({ ok: true });
  } catch {
    console.error("[reject] failed for issue", { id });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
