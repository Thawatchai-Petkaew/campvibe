// Server-only Linear write helpers (mutations) used by the Telegram reply loop.
// Reads/writes use LINEAR_API_KEY — must stay server-side. Mirrors the GraphQL
// shape in scripts/linear-sync.mjs (issueUpdate labelIds / commentCreate).
import "server-only";

const LINEAR_API = "https://api.linear.app/graphql";
const TEAM_KEY = process.env.LINEAR_TEAM_KEY || "CAM";

async function gql<T = Record<string, unknown>>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error("LINEAR_API_KEY not set");
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  return json.data as T;
}

interface IssueRef {
  id: string;
  labels: { id: string; name: string }[];
}

async function findIssue(identifier: string): Promise<IssueRef | null> {
  const data = await gql<{ issues: { nodes: { id: string; identifier: string; labels: { nodes: { id: string; name: string }[] } }[] } }>(
    `query($k:String!){ issues(filter:{team:{key:{eq:$k}}}, first:100){ nodes{ id identifier labels{ nodes{ id name } } } } }`,
    { k: TEAM_KEY }
  );
  const node = (data.issues?.nodes ?? []).find((i) => i.identifier.toUpperCase() === identifier.toUpperCase());
  if (!node) return null;
  return { id: node.id, labels: node.labels?.nodes ?? [] };
}

/**
 * Remove the `awaiting-you` label from a gate issue = approve it.
 * Returns true if the label was present and removed (which makes Linear fire its
 * webhook → the existing repository_dispatch → orchestrator continuation).
 */
export async function removeAwaitingYou(identifier: string): Promise<boolean> {
  const issue = await findIssue(identifier);
  if (!issue) return false;
  const next = issue.labels.filter((l) => l.name.toLowerCase() !== "awaiting-you").map((l) => l.id);
  if (next.length === issue.labels.length) return false; // not awaiting → nothing to do
  await gql(`mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }`, {
    id: issue.id,
    input: { labelIds: next },
  });
  return true;
}

/** Post a comment on an issue (used for reject reasons + free-text replies). */
export async function addComment(identifier: string, body: string): Promise<boolean> {
  const issue = await findIssue(identifier);
  if (!issue) return false;
  await gql(`mutation($id:String!,$body:String!){ commentCreate(input:{issueId:$id,body:$body}){ success } }`, {
    id: issue.id,
    body,
  });
  return true;
}

/**
 * Add a label (by name) to an issue. Idempotent — does nothing if the label is
 * already present. Looks up the label id in the team's label list by name.
 * Returns true if the label was added (or already present), false if the issue
 * or label does not exist.
 */
export async function addLabel(identifier: string, labelName: string): Promise<boolean> {
  const issue = await findIssue(identifier);
  if (!issue) return false;

  // Already has the label — idempotent, nothing to do.
  const alreadyPresent = issue.labels.some((l) => l.name.toLowerCase() === labelName.toLowerCase());
  if (alreadyPresent) return true;

  // Fetch team labels to find the target label id.
  const data = await gql<{
    teams: { nodes: { labels: { nodes: { id: string; name: string }[] } }[] };
  }>(
    `query($k:String!){ teams(filter:{key:{eq:$k}}){ nodes{ labels{ nodes{ id name } } } } }`,
    { k: TEAM_KEY }
  );
  const teamLabels = data.teams?.nodes?.[0]?.labels?.nodes ?? [];
  const target = teamLabels.find((l) => l.name.toLowerCase() === labelName.toLowerCase());
  if (!target) return false;

  const next = [...issue.labels.map((l) => l.id), target.id];
  await gql(
    `mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }`,
    { id: issue.id, input: { labelIds: next } }
  );
  return true;
}
