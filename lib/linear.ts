// Server-only Linear client for the public /status dashboard.
// Uses LINEAR_API_KEY (personal API key) — must stay server-side, never expose to client.
import "server-only";
import { unstable_cache } from "next/cache";

const LINEAR_API = "https://api.linear.app/graphql";
const PRIORITY = ["No priority", "Urgent", "High", "Medium", "Low"] as const;

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
}

const TEAM_KEY = process.env.LINEAR_TEAM_KEY || "CAM";

async function fetchStatusIssuesRaw(): Promise<StatusIssue[]> {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error("LINEAR_API_KEY is not set");

  const query = `query Issues($key: String!) {
    issues(filter: { team: { key: { eq: $key } } }, first: 250) {
      nodes {
        identifier
        title
        priority
        url
        description
        startedAt
        updatedAt
        completedAt
        state { name type }
        labels { nodes { name } }
        assignee { name displayName avatarUrl }
        project { id name }
        parent { id title }
      }
    }
  }`;

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query, variables: { key: TEAM_KEY } }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Linear API error ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "Linear query failed");

  const nodes = json?.data?.issues?.nodes ?? [];
  return nodes.map(
    (n: {
      identifier: string;
      title: string;
      priority: number;
      url: string;
      description: string | null;
      startedAt: string | null;
      updatedAt: string | null;
      completedAt: string | null;
      state: { name: string; type: string } | null;
      labels: { nodes: { name: string }[] } | null;
      assignee: { name: string; displayName: string; avatarUrl: string | null } | null;
      project: { id: string; name: string } | null;
      parent: { id: string; title: string } | null;
    }): StatusIssue => ({
      id: n.identifier,
      title: n.title,
      status: n.state?.name ?? "",
      statusType: n.state?.type ?? "",
      priority: PRIORITY[n.priority ?? 0] ?? "No priority",
      labels: (n.labels?.nodes ?? []).map((l) => l.name),
      url: n.url,
      description: n.description ?? "",
      startedAt: n.startedAt ?? null,
      updatedAt: n.updatedAt ?? new Date(0).toISOString(),
      completedAt: n.completedAt ?? null,
      assignee: n.assignee
        ? { name: n.assignee.name, displayName: n.assignee.displayName, avatarUrl: n.assignee.avatarUrl ?? null }
        : null,
      project: n.project ? { id: n.project.id, name: n.project.name } : null,
      parent: n.parent ? { id: n.parent.id, title: n.parent.title } : null,
    })
  );
}

/* Cached for 60s so every viewer + the 60s auto-refresh share ONE Linear fetch per minute,
 * regardless of how many people watch /status. Caps Linear API usage at ~60 requests/hour
 * (well under Linear's ~1,500 req/hour limit) instead of scaling with viewers × tabs. */
// Cache key includes the pulse version: when the Linear webhook bumps the pulse, the next
// render passes a new pulse → cache miss → fresh fetch (real-time). Within one pulse the result
// stays cached for up to 60s so concurrent viewers + the fallback poll share a single Linear call.
const cachedStatusIssues = unstable_cache(
  async (_pulse: number) => fetchStatusIssuesRaw(),
  ["linear-status-issues"],
  { revalidate: 60 }
);

/** Dashboard issues, freshness keyed on the pulse version (0 = time-based 60s cache only). */
export function fetchStatusIssues(pulse = 0): Promise<StatusIssue[]> {
  return cachedStatusIssues(pulse);
}
