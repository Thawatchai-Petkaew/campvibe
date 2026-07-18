/**
 * GET /api/cron/ai-chat-retention — CAM-422 (ADR-013 S8, D2).
 *
 * Daily Vercel Cron job (see `vercel.json` "crons") that hard-deletes every
 * `ChatConversation` idle ≥180 days AND any conversation whose owning `User`
 * has been soft-deleted (see `purgeExpiredConversations` for why the second
 * clause is needed — the FK cascade alone misses soft-deleted users).
 *
 * Auth:  a shared-secret guard (`lib/cron-auth.ts`), constant-time compared
 *        against the `Authorization: Bearer $CRON_SECRET` header Vercel
 *        Cron sends automatically once `CRON_SECRET` is set on the project.
 *        Never falls open when the secret is unset (security.md OWASP-5).
 * Body:  `{ purgedCount }` on success — a count only, never conversation
 *        content, per observability.md field hygiene (no secret/PII) and
 *        the ADR-013 D2 Confirmation ("first run proves it deleted ≥1 row,
 *        never a silent skip" — `purgeExpiredConversations` logs the count
 *        internally regardless of the caller).
 *
 * This route intentionally reads NO NextAuth session — it is a system job,
 * not a user request; `purgeExpiredConversations` is deliberately the one
 * store function with no `userId` scope.
 *
 * Error-code set: 401 (missing/invalid secret) · 500 (internal, generic).
 */
import { NextRequest, NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cron-auth";
import { purgeExpiredConversations } from "@/lib/ai/conversation-store";

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await purgeExpiredConversations();
  if (!result.ok) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ purgedCount: result.data.purgedCount }, { status: 200 });
}
