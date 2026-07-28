/**
 * GET  /api/tickets — list tickets (filters: `state`, `epicId`, `archived`)
 * POST /api/tickets — create a ticket
 *
 * Auth: STATUS_TOKEN via `?token=` query param OR `x-status-token` header
 * (lib/status-auth.ts) — the same gate as every existing /api/status/* mutation route.
 * This delivery-ops surface has no NextAuth session to bind identity to; `actor` is a
 * free-text field in the body instead (G2-locked, see lib/delivery/tickets.ts top comment).
 *
 * Rate-limit: 60 req/min per IP for GET, 20 req/min per IP for POST (mirrors /api/status/*).
 * Errors: 400 invalid input · 401 unauthorized · 429 rate-limited · 500 internal (no stack).
 */
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStatusRequestAuthorized } from "@/lib/status-auth";
import { createTicketBodySchema, listTicketsQuerySchema } from "@/lib/delivery/validations";
import { createTicket, listTickets } from "@/lib/delivery/tickets";
import { ticketErrorResponse } from "@/lib/delivery/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isStatusRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`tickets:list:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const url = new URL(req.url);
  const parsed = listTicketsQuerySchema.safeParse({
    state: url.searchParams.get("state") ?? undefined,
    epicId: url.searchParams.get("epicId") ?? undefined,
    archived: url.searchParams.get("archived") ?? undefined,
    // CAM-595: mode=gate|audit — a targeted server-side read for the two surfaces that must
    // never truncate silently (see lib/delivery/validations.ts's mode-param comment).
    mode: url.searchParams.get("mode") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  try {
    const tickets = await listTickets(parsed.data);
    // CAM-595: project the real truncation signal so a bounded read can never look like a
    // complete one. `tickets.total`/`tickets.truncated` are extra own properties the service
    // layer attaches (see TicketListResult) — when a caller's test double mocks listTickets
    // to resolve a plain array (no such properties), both read as `undefined` here and
    // JSON.stringify drops them, so the response degrades to the original `{ tickets }`
    // shape rather than lying with `truncated: false`.
    return NextResponse.json({ tickets, total: tickets.total, truncated: tickets.truncated });
  } catch (err) {
    return ticketErrorResponse(err);
  }
}

export async function POST(req: Request) {
  if (!isStatusRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`tickets:create:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createTicketBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const { actor, ...input } = parsed.data;
    const ticket = await createTicket(actor, input);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    return ticketErrorResponse(err);
  }
}
