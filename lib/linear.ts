// Server-only Linear client for the public /status dashboard.
// Uses LINEAR_API_KEY (personal API key) — must stay server-side, never expose to client.
import "server-only";

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
}

const TEAM_KEY = process.env.LINEAR_TEAM_KEY || "CAM";

export async function fetchStatusIssues(): Promise<StatusIssue[]> {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error("LINEAR_API_KEY is not set");

  const query = `query Issues($key: String!) {
    issues(filter: { team: { key: { eq: $key } } }, first: 100) {
      nodes {
        identifier
        title
        priority
        url
        description
        state { name type }
        labels { nodes { name } }
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
      state: { name: string; type: string } | null;
      labels: { nodes: { name: string }[] } | null;
    }): StatusIssue => ({
      id: n.identifier,
      title: n.title,
      status: n.state?.name ?? "",
      statusType: n.state?.type ?? "",
      priority: PRIORITY[n.priority ?? 0] ?? "No priority",
      labels: (n.labels?.nodes ?? []).map((l) => l.name),
      url: n.url,
      description: n.description ?? "",
    })
  );
}
