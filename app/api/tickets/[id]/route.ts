/**
 * GET   /api/tickets/[id] — ticket detail + comments + events
 * PATCH /api/tickets/[id] — dispatch a state-machine verb: body `{ action, actor, ...params }`
 *
 * `[id]` is the ticket identifier, e.g. CAM-278.
 * Auth/rate-limit: see app/api/tickets/route.ts (same STATUS_TOKEN gate).
 * Errors: 400 invalid input/transition (see lib/delivery/errors.ts TicketTransitionError.code)
 *         · 401 unauthorized · 404 not found · 429 rate-limited · 500 internal (no stack).
 */
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStatusRequestAuthorized } from "@/lib/status-auth";
import { TICKET_ID_RE, patchTicketBodySchema } from "@/lib/delivery/validations";
import {
  getTicketByIdentifier,
  listComments,
  listEvents,
  start,
  raiseGate,
  approve,
  reject,
  complete,
  release,
  cancel,
  reopen,
  handoff,
  archiveTicket,
  unarchiveTicket,
  setBlocked,
  updateFields,
} from "@/lib/delivery/tickets";
import { ticketErrorResponse } from "@/lib/delivery/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isStatusRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`tickets:detail:${ip}`, { limit: 60, windowMs: 60_000 });
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

  try {
    const ticket = await getTicketByIdentifier(id);
    if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const [comments, events] = await Promise.all([listComments(ticket.id), listEvents(ticket.id)]);
    return NextResponse.json({ ticket, comments, events });
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isStatusRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`tickets:patch:${ip}`, { limit: 20, windowMs: 60_000 });
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

  const parsed = patchTicketBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const p = parsed.data;
    let ticket;
    switch (p.action) {
      case "start":
        ticket = await start(id, p.actor, p.role);
        break;
      case "raiseGate":
        ticket = await raiseGate(id, p.actor, p.note);
        break;
      case "approve":
        ticket = await approve(id, p.actor, p.nextRole);
        break;
      case "reject":
        ticket = await reject(id, p.actor, p.note);
        break;
      case "complete":
        ticket = await complete(id, p.actor);
        break;
      case "release":
        ticket = await release(id, p.actor);
        break;
      case "cancel":
        ticket = await cancel(id, p.actor, p.note);
        break;
      case "reopen":
        ticket = await reopen(id, p.actor, p.note);
        break;
      case "handoff":
        ticket = await handoff(id, p.actor, p.role, p.note, p.agentModel);
        break;
      case "archive":
        ticket = await archiveTicket(id, p.actor);
        break;
      case "unarchive":
        ticket = await unarchiveTicket(id, p.actor);
        break;
      case "setBlocked":
        ticket = await setBlocked(id, p.actor, p.blocked, p.note);
        break;
      case "updateFields": {
        const { action: _action, actor, ...fields } = p;
        void _action;
        ticket = await updateFields(id, actor, fields);
        break;
      }
      default: {
        const exhaustive: never = p;
        return NextResponse.json({ error: "invalid_action", detail: exhaustive }, { status: 400 });
      }
    }
    return NextResponse.json({ ticket });
  } catch (err) {
    return ticketErrorResponse(err);
  }
}
