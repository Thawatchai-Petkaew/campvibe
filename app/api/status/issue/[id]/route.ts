/**
 * GET /api/status/issue/[id] — return a single issue's detail for the gate detail
 * modal on /status/map.
 *
 * Single read path (CAM-281 T-5b retired the legacy Linear branch): fetchTicketFromDb()
 * reads the one ticket row (+ its epic join) straight from the delivery database and
 * synthesizes it into the same StatusIssue shape via lib/delivery/status-adapter.ts's
 * toStatusIssue() — the shape shapeIssueDetail() below (the final response shape the modal
 * expects) has always been source-agnostic.
 *
 * Note: unlike the list dashboard's list-read helper (lib/linear.ts), this route does NOT
 * keep its own Linear rollback fallback — this detail endpoint's only consumer is the
 * /status/map gate-detail modal, grouped with the mutation routes for this retirement
 * (ADR-010 T-5b). The one documented one-cycle rollback lever lives solely in
 * lib/linear.ts, used by the list views.
 *
 * The `[id]` segment is the ticket identifier, e.g. CAM-184 or CAM-10.
 *
 * Auth: STATUS_TOKEN via `?token=` query param OR `x-status-token` header.
 * Errors: 400 bad id · 401 unauthorized · 404 not found · 500 internal (no stack).
 *
 * Response shape (200):
 *   { id, title, status, statusType, role, description, url, assignee, project, labels, model }
 *   (model = CAM-342 model-tier trial instrumentation, added additively)
 *
 * Note: the underlying delivery service also exposes comments/events for a ticket
 * (GET /api/tickets/[id]), but the modal's IssueDetail contract (app/status/map/
 * campsite-overlays.tsx) does not consume them — omitted here rather than shipping an
 * unused field (CLAUDE.md iron rule #2: no code for the future).
 */
import { NextResponse } from "next/server";
import type { StatusIssue } from "@/lib/linear";
import { fetchTicketFromDb } from "@/lib/delivery/status-adapter";
import { roleFromTitle } from "@/lib/notify-messages";
import { checkRateLimit } from "@/lib/rate-limit";
import { isStatusRequestAuthorized } from "@/lib/status-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Z]+-\d+$/;

/** Shapes a StatusIssue into the modal's response contract. */
function shapeIssueDetail(issue: StatusIssue) {
  const role = roleFromTitle(issue.title) ?? undefined;
  return {
    id: issue.id,
    title: issue.title,
    status: issue.status,
    statusType: issue.statusType,
    role,
    description: issue.description,
    url: issue.url,
    assignee: issue.assignee,
    project: issue.project,
    labels: issue.labels,
    // CAM-342: model-tier trial instrumentation, pass-through (BR-2 -- the modal decides
    // no-value display, "—", not this shaping function).
    model: issue.agentModel ?? null,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Shared STATUS_TOKEN gate (lib/status-auth.ts — CAM-275): default-deny — missing
  // STATUS_TOKEN → 401 (no open fallback).
  if (!isStatusRequestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // SEC-A: rate-limit 60 req/min per IP.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`status:issue:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { id } = await params;
  if (typeof id !== "string" || !ID_RE.test(id.toUpperCase())) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const issue = await fetchTicketFromDb(id);
    if (!issue) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(shapeIssueDetail(issue));
  } catch {
    console.error("[issue/detail] fetchTicketFromDb failed", { id });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
