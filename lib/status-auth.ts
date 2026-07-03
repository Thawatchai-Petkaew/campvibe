/**
 * lib/status-auth.ts — the single, symmetric STATUS_TOKEN gate shared by every /status
 * surface: the dashboard page, the delivery map page, the map/data reconcile route, the
 * approve/reject/issue-detail mutation APIs, and the pulse/stream/version polling routes.
 *
 * CAM-275 (fix): before this file existed, the gate was asymmetric across surfaces —
 * app/status/page.tsx, app/status/map/page.tsx and app/status/map/data/route.ts defaulted
 * OPEN when STATUS_TOKEN was unset (`if (!required) return true`), while the mutation APIs
 * (approve/reject/issue/[id], pulse/stream/version) already defaulted DENY. With
 * STATUS_TOKEN unset on an environment, the map rendered with approve/reject buttons that
 * always 401'd on click. Owner decision: lock EVERY surface with the SAME rule — never
 * fall open when STATUS_TOKEN is unset, with a local-dev-only convenience exception.
 *
 * Never log the token value itself (see .claude/rules/security.md — no secret in logs).
 */
import "server-only";

/** Local dev only (never "test", "staging", "production") bypasses the gate for convenience. */
function isLocalDev(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * isStatusAuthorized — for server components that read the token directly out of
 * `searchParams` (app/status/page.tsx, app/status/map/page.tsx).
 *
 * Rules, in order:
 *   1. NODE_ENV === "development" → true (local dev stays open; no token friction on a laptop).
 *   2. STATUS_TOKEN unset → false (default-deny; never fall open on staging/prod).
 *   3. otherwise → tokenParam must strictly equal STATUS_TOKEN.
 */
export function isStatusAuthorized(tokenParam: string | null | undefined): boolean {
  if (isLocalDev()) return true;
  const required = process.env.STATUS_TOKEN;
  if (!required) return false;
  return tokenParam === required;
}

/**
 * isStatusRequestAuthorized — for API route handlers. Accepts the token via either the
 * `?token=` query param OR the `x-status-token` header (dual support preserved from the
 * pre-existing approve/reject/issue/pulse/stream/version routes). Same default-deny rules
 * as isStatusAuthorized above.
 */
export function isStatusRequestAuthorized(req: Request): boolean {
  if (isLocalDev()) return true;
  const required = process.env.STATUS_TOKEN;
  if (!required) return false;
  const url = new URL(req.url);
  const query = url.searchParams.get("token");
  const header = req.headers.get("x-status-token");
  return query === required || header === required;
}
