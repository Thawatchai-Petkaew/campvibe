/**
 * POST /api/tickets/[id]/comments — add a free-form comment to a ticket.
 * Auth/rate-limit: see app/api/tickets/route.ts (same STATUS_TOKEN gate).
 * Errors: 400 invalid input · 401 unauthorized · 404 not found · 429 rate-limited · 500 internal.
 */
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStatusRequestAuthorized } from "@/lib/status-auth";
import { TICKET_ID_RE, addCommentBodySchema } from "@/lib/delivery/validations";
import { addComment } from "@/lib/delivery/tickets";
import { ticketErrorResponse } from "@/lib/delivery/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isStatusRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`tickets:comment:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { id } = await params;
  if (!TICKET_ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = addCommentBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const comment = await addComment(id, parsed.data.actor, parsed.data.body);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return ticketErrorResponse(err);
  }
}
