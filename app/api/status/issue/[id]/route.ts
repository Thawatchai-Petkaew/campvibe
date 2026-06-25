/**
 * GET /api/status/issue/[id] — return a single issue's detail for the gate detail
 * modal on /status/map.  Data comes from the existing cached fetchStatusIssues()
 * (keyed on pulse) — no extra Linear API call beyond what the dashboard already makes.
 *
 * The `[id]` segment is the Linear identifier, e.g. CAM-184 or CAM-10.
 *
 * Auth: STATUS_TOKEN via `?token=` query param OR `x-status-token` header.
 * Errors: 400 bad id · 401 unauthorized · 404 not found · 500 internal (no stack).
 *
 * Response shape (200):
 *   { id, title, status, statusType, role, description, url, assignee, project, labels }
 */
import { NextResponse } from "next/server";
import { fetchStatusIssues } from "@/lib/linear";
import { roleFromTitle } from "@/lib/notify-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Z]+-\d+$/;

function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return true;
  const url = new URL(req.url);
  const query = url.searchParams.get("token");
  const header = req.headers.get("x-status-token");
  return query === required || header === required;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (typeof id !== "string" || !ID_RE.test(id.toUpperCase())) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    // Reuse the pulse-keyed cache — avoids an extra Linear fetch beyond the dashboard.
    const issues = await fetchStatusIssues(0);
    const issue = issues.find((i) => i.id.toUpperCase() === id.toUpperCase());

    if (!issue) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Extract [role] from the title if present.
    const role = roleFromTitle(issue.title) ?? undefined;

    return NextResponse.json({
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
    });
  } catch {
    console.error("[issue/detail] fetchStatusIssues failed", { id });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
