// lib/delivery/status-adapter.ts — reproduces lib/linear.ts's StatusIssue shape byte-for-byte
// from the self-hosted Ticket table (ADR-010 "StatusIssue coverage — confirmed field-by-field").
// Zero changes to lib/status-model.ts / lib/status-derive.ts / campsite-scene.tsx depend on this
// file existing — they only ever see a StatusIssue, regardless of source.
import "server-only";
import { unstable_cache } from "next/cache";
import type { StatusIssue } from "@/lib/linear";
import type { Ticket, TicketState } from "@/prisma/delivery/generated/delivery-client";
import { getDeliveryClient } from "@/lib/delivery/client";
import { readDeliveryPulse } from "@/lib/delivery/pulse";
import { roleSlug } from "@/lib/delivery/roles";

const PRIORITY = ["No priority", "Urgent", "High", "Medium", "Low"] as const;

// ADR-010 "StatusIssue coverage" table: status/statusType mapped from TicketState.
// AWAITING_GATE keeps the same "In Progress"/"started" pair as IN_PROGRESS — the gate
// signal rides on the `awaiting-you` label instead, matching today's Linear behavior where
// the label is layered on top of an unchanged status.
const STATE_TO_STATUS: Record<TicketState, string> = {
  BACKLOG: "Backlog",
  TODO: "Todo",
  IN_PROGRESS: "In Progress",
  AWAITING_GATE: "In Progress",
  DONE: "Done",
  CANCELED: "Canceled",
};

const STATE_TO_STATUS_TYPE: Record<TicketState, string> = {
  BACKLOG: "backlog",
  TODO: "unstarted",
  IN_PROGRESS: "started",
  AWAITING_GATE: "started",
  DONE: "completed",
  CANCELED: "canceled",
};

type TicketWithEpic = Ticket & { epic: { id: string; title: string } | null };

/** Synthesize one Ticket row into the legacy StatusIssue shape. Exported for direct unit tests. */
export function toStatusIssue(t: TicketWithEpic): StatusIssue {
  const slug = roleSlug(t.currentRole);
  // title = "[role] <title>" when a role is set, so the existing roleOf()/canonRole()
  // title-regex parsing in lib/status-derive.ts keeps working unmodified — the STORED
  // Ticket.title itself stays clean (no baked-in tag; currentRole is the atomic column).
  const title = slug ? `[${slug}] ${t.title}` : t.title;

  const labels: string[] = [];
  if (t.state === "AWAITING_GATE") labels.push("awaiting-you");
  if (t.changesRequested) labels.push("changes-requested");
  if (t.releasedAt) labels.push("released");
  if (t.blocked) labels.push("blocked");
  if (t.persona) labels.push(t.persona.toLowerCase());
  for (const r of t.roleHistory) {
    // roleHistory stores raw DeliveryRole enum values (e.g. "BACKEND_ENGINEER");
    // roleSlug() converts each to the canonical kebab-case slug status-derive expects.
    const s = r.toLowerCase().replace(/_/g, "-");
    labels.push(`role:${s}`);
  }
  // regression:<currentRole-slug>:<n> — matches the ^regression:[^:]+:(\d+)$ parser in
  // lib/status-derive.ts's regressionRound(). Uses the CURRENT role's slug (ADR-010).
  if (t.regressionRound > 0 && slug) labels.push(`regression:${slug}:${t.regressionRound}`);
  labels.push(...t.legacyLabels);

  return {
    id: t.identifier,
    title,
    status: STATE_TO_STATUS[t.state],
    statusType: STATE_TO_STATUS_TYPE[t.state],
    priority: PRIORITY[t.priority] ?? "No priority",
    labels,
    // legacyUrl (imported rows) or empty — no internal /status deep link exists yet
    // (ADR-010: "UI route is future work, not this story").
    url: t.legacyUrl ?? "",
    description: t.description ?? "",
    startedAt: t.startedAt ? t.startedAt.toISOString() : null,
    updatedAt: t.updatedAt.toISOString(),
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    assignee: t.assigneeName
      ? { name: t.assigneeName, displayName: t.assigneeName, avatarUrl: null }
      : null,
    project: t.featureName ? { id: t.featureName, name: t.featureName } : null,
    parent: t.epic ? { id: t.epic.id, title: t.epic.title } : null,
  };
}

async function fetchTicketsFromDbRaw(): Promise<StatusIssue[]> {
  const db = getDeliveryClient();
  const tickets = await db.ticket.findMany({
    where: { archivedAt: null },
    include: { epic: { select: { id: true, title: true } } },
    orderBy: { number: "asc" },
    // Bounded read (perf.md — never unbounded); matches lib/delivery/tickets.ts's listTickets cap.
    take: 500,
  });
  return tickets.map(toStatusIssue);
}

/**
 * Single-ticket detail for GET /api/status/issue/[id] (TICKETS_SOURCE=db — CAM-281 T-5).
 * Reuses toStatusIssue() so the gate-detail modal gets byte-for-byte the same StatusIssue
 * shape it already gets from the Linear-sourced path — no new response contract to maintain.
 * Not cached (unlike fetchTicketsFromDb above): this is a single-row lookup triggered by a
 * user opening one modal, not the 60s-shared dashboard list read.
 */
export async function fetchTicketFromDb(identifier: string): Promise<StatusIssue | null> {
  const db = getDeliveryClient();
  const ticket = await db.ticket.findUnique({
    where: { identifier: identifier.toUpperCase() },
    include: { epic: { select: { id: true, title: true } } },
  });
  if (!ticket) return null;
  return toStatusIssue(ticket);
}

/* Cached for 60s, keyed on DeliveryPulse.version — the same pattern lib/linear.ts uses keyed
 * on the Linear-webhook-relayed StatusPulse. Here the pulse is bumped in-process by
 * lib/delivery/tickets.ts (no webhook to relay from — ADR-010), so freshness is bounded only
 * by the in-process mutation + this 60s ceiling, never by a third party's delivery latency. */
const cachedTicketsFromDb = unstable_cache(
  async (_pulse: number) => fetchTicketsFromDbRaw(),
  ["delivery-status-tickets"],
  { revalidate: 60 }
);

/** Dashboard issues sourced from the self-hosted delivery database (TICKETS_SOURCE=db). */
export async function fetchTicketsFromDb(): Promise<StatusIssue[]> {
  const pulse = await readDeliveryPulse();
  return cachedTicketsFromDb(pulse);
}
