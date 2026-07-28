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
  // CAM-602: reflect the FULL query string into the (now-strict) schema below, rather than
  // four manually-named `.get()` calls — an unrecognized key fails loudly (400) instead of
  // being silently dropped, per lib/delivery/validations.ts's listTicketsQuerySchema comment.
  // `token` is deliberately excluded first: it is the STATUS_TOKEN auth transport already
  // checked by isStatusRequestAuthorized above (lib/status-auth.ts), not a data field this
  // endpoint's contract owns — folding it into the strict schema would 400 every legitimate
  // token-bearing request.
  const queryParams = new URLSearchParams(url.search);
  queryParams.delete("token");
  const parsed = listTicketsQuerySchema.safeParse(Object.fromEntries(queryParams));
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
    //
    // CAM-602: `tickets.appliedMode` is the response's PROOF that a requested `mode` was
    // actually used to build the query — "gate"/"audit", or `null` for a genuine general
    // (no-mode) read. Same additive/compat mechanism as total/truncated: absent when a test
    // double mocks a plain array, never a false value. A caller that requested mode=gate/
    // audit and gets a response where this doesn't match must refuse to interpret `tickets`
    // as that set — see scripts/lib/ticket-sync-mode-proof.mjs.
    return NextResponse.json({
      tickets,
      total: tickets.total,
      truncated: tickets.truncated,
      appliedMode: tickets.appliedMode,
    });
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
