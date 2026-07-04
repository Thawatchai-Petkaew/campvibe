// Server-only seam for the public /status dashboard's StatusIssue shape.
// Defined seam (ADR-010): the ONLY place a product file imports lib/delivery/* directly
// (the other is app/api/tickets/*). The self-hosted delivery ticket DB
// (lib/delivery/status-adapter.ts) is the unconditional, live source — the historical
// TICKETS_SOURCE=linear rollback lever (+ the raw Linear GraphQL fetch it guarded) was
// retired one cycle after the CAM-281 T-5b cutover (see chore/retire-linear-sync).
import "server-only";
import { fetchTicketsFromDb } from "@/lib/delivery/status-adapter";

export interface StatusIssue {
  id: string;          // identifier e.g. CAM-5
  title: string;
  status: string;      // state name e.g. "In Progress"
  statusType: string;  // backlog | unstarted | started | completed | canceled
  priority: string;    // mapped name
  labels: string[];
  url: string;
  description: string;
  startedAt: string | null;    // when it entered a "started" state — drives time-in-progress
  updatedAt: string;           // last activity (max across issues = freshness)
  completedAt: string | null;  // when shipped/done
  assignee: { name: string; displayName: string; avatarUrl: string | null } | null;
  project: { id: string; name: string } | null;  // Linear Project = "feature"
  parent: { id: string; title: string } | null;  // parent issue = "epic" (title is the stable link key)
  // CAM-342 (additive, backward-compatible): model-tier trial instrumentation. Populated
  // from Ticket.agentModel by lib/delivery/status-adapter.ts's toStatusIssue().
  agentModel?: string | null;
}

/**
 * Dashboard issues, sourced unconditionally from the self-hosted delivery ticket DB.
 * `pulse` is accepted (not used here) only for call-site compatibility with existing
 * callers (app/status/page.tsx, app/status/map/page.tsx, app/status/map/data/route.ts)
 * that still key their own legacy StatusPulse read before calling this — the DB path
 * freshness is governed by lib/delivery/status-adapter.ts's own DeliveryPulse-keyed cache.
 */
export function fetchStatusIssues(_pulse = 0): Promise<StatusIssue[]> {
  return fetchTicketsFromDb();
}
