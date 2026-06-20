// Server-only: fire a GitHub repository_dispatch (drives the headless workflows).
// No-throw: returns { dispatched:false } if GITHUB_REPO / GH_DISPATCH_TOKEN aren't set.
import "server-only";

export async function fireRepositoryDispatch(
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ dispatched: boolean; status?: number }> {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!repo || !token) return { dispatched: false };
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: eventType, client_payload: payload }),
    });
    return { dispatched: res.ok, status: res.status };
  } catch (e) {
    console.error("fireRepositoryDispatch failed:", e);
    return { dispatched: false };
  }
}
