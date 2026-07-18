/**
 * lib/cron-auth.ts — CAM-422 (ADR-013 S8). The shared-secret gate for
 * `app/api/cron/*` routes (currently just `ai-chat-retention`).
 *
 * Repo precedent: no `app/api/cron/*` route existed before this story
 * (grepped — none found), so this mirrors `lib/status-auth.ts`'s
 * default-deny shape (never fall open when the secret is unset) but drops
 * its local-dev convenience bypass — a cron route is never opened by a
 * human in a browser, only ever called by Vercel's scheduler (or a curl
 * with the real secret for a manual test), so there is no dev-friction to
 * trade away (security.md OWASP-5 — never fall open).
 *
 * Header convention: Vercel Cron automatically sends
 * `Authorization: Bearer $CRON_SECRET` on every invocation once the
 * `CRON_SECRET` env var is set on the project (Vercel docs — Securing Cron
 * Jobs), so this checks that exact header, constant-time compared
 * (`crypto.timingSafeEqual`) to avoid a byte-at-a-time timing side-channel
 * on the secret.
 *
 * Never logs the secret value itself (security.md — no secret in logs).
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Length must match before timingSafeEqual (it throws on mismatched
  // lengths); a differing length is itself sufficient reason to reject.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * isCronRequestAuthorized — for `app/api/cron/*` route handlers.
 *
 * Rules, in order:
 *   1. `CRON_SECRET` unset → false (default-deny; never fall open).
 *   2. No `Authorization` header → false.
 *   3. Header must strictly equal `Bearer <CRON_SECRET>` (constant-time).
 */
export function isCronRequestAuthorized(req: Request): boolean {
  const required = process.env.CRON_SECRET;
  if (!required) return false;

  const header = req.headers.get("authorization");
  if (!header) return false;

  return safeEqual(header, `Bearer ${required}`);
}
