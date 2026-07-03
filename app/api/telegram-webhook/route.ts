/**
 * Telegram webhook → reply loop for delivery-team gates.
 *
 * Flow:  gate raised (scripts/linear-sync.mjs / scripts/ticket-sync.mjs adds the gate
 *        signal) → Telegram message with Approve / Reject buttons → you tap (or reply) →
 *        this route:
 *          • approve:<CAM-id>  → legacy: remove `awaiting-you` (= the Linear webhook then
 *                                 fires the existing repository_dispatch → orchestrator
 *                                 continues; the webhook also sends the "Approved"
 *                                 notification, so we do NOT send a duplicate message here
 *                                 — only ack the tap). db mode: calls the delivery
 *                                 service's approve() verb directly, which sends the
 *                                 notification + fires the dispatch itself in the same call
 *                                 (ADR-010 "single mutation path, no webhook") — same
 *                                 "don't duplicate" rule, just the single source moves.
 *          • reject:<CAM-id>   → legacy: keep the label + post the reason as a Linear
 *                                 comment + send the "Sent back for changes" notification
 *                                 (the webhook cannot detect a rejection, so this route
 *                                 owns that send). db mode: calls the delivery service's
 *                                 reject() verb, which sends its own "rejected" notification
 *                                 — this route must NOT also send one (double-send).
 *          • free-text reply   → if it replies to a gate message, post it as a comment
 *                                 (free-form ad-hoc routing lands in Phase 3 / /camper)
 *
 * Dual-mode (ADR-010 `TICKETS_SOURCE` flag — CAM-281 T-5; same flag lib/linear.ts already
 * reads for the list view, see lib/delivery/status-adapter.ts). Everything below the
 * TICKETS_SOURCE checks (secret check, answerCallback, camper-adhoc dispatch for
 * free-text not tied to a gate) is unchanged in both modes.
 *
 * Required env (Vercel): TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID · TELEGRAM_WEBHOOK_SECRET
 * Register once: setWebhook with secret_token = TELEGRAM_WEBHOOK_SECRET → /api/telegram-webhook
 */
import { NextResponse } from "next/server";
import { answerCallback, sendTelegram } from "@/lib/notify";
import { addComment, removeAwaitingYou } from "@/lib/linear-actions";
import {
  approve as approveTicket,
  reject as rejectTicket,
  addComment as addDeliveryComment,
} from "@/lib/delivery/tickets";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import { fireRepositoryDispatch } from "@/lib/github-dispatch";
import { buildEventMessage } from "@/lib/notify-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TgUpdate {
  callback_query?: { id: string; data?: string };
  message?: { text?: string; reply_to_message?: { text?: string } };
}

/** See app/api/status/approve/route.ts's DB_ACTOR comment — same trust model, this surface. */
const DB_ACTOR = "owner (telegram)";

const REJECT_NOTE = "Rejected via Telegram — needs changes before continuing";

function authorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get("x-telegram-bot-api-secret-token") === secret;
}

/** True for the two "expected, not a failure" service errors — not-found / not-awaiting-gate. */
function isExpectedTicketError(err: unknown): boolean {
  return (
    err instanceof TicketNotFoundError ||
    (err instanceof TicketTransitionError && err.code === "invalid_state")
  );
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const dbMode = process.env.TICKETS_SOURCE === "db";

  // 1) Inline-button taps — Approve / Reject
  const cb = update.callback_query;
  if (cb?.data) {
    const [action, id] = cb.data.split(":");
    // Defence-in-depth: the id must look like a ticket identifier before it reaches any
    // Linear/delivery call (same shape whether sourced from Linear or the delivery DB).
    if (id && !/^[A-Z]+-\d+$/.test(id)) {
      await answerCallback(cb.id);
      return NextResponse.json({ ok: true, ignored: "bad id" });
    }
    if (action === "approve" && id) {
      if (dbMode) {
        let changed = true;
        try {
          await approveTicket(id, DB_ACTOR);
        } catch (err) {
          if (!isExpectedTicketError(err)) throw err;
          changed = false;
        }
        await answerCallback(cb.id, changed ? `Approved ${id}` : `${id}: no gate pending`);
        // approveTicket() already sent the "approved" Telegram notification + fired the
        // gate-approved dispatch in the SAME call (ADR-010 "single mutation path, no
        // webhook") — do NOT send anything else here, only ack the tap.
        return NextResponse.json({ ok: true, action: "approve", id, changed });
      }
      const changed = await removeAwaitingYou(id);
      await answerCallback(cb.id, changed ? `Approved ${id}` : `${id}: no gate pending`);
      // Removing `awaiting-you` triggers the Linear webhook, which is now the SINGLE source of the
      // "Approved" notification — it fires for this tap AND for an approval done in the Linear UI.
      // So we do NOT send it here (only ack the tap), avoiding a double-send.
      return NextResponse.json({ ok: true, action: "approve", id, changed });
    }
    if (action === "reject" && id) {
      if (dbMode) {
        try {
          await rejectTicket(id, DB_ACTOR, REJECT_NOTE);
        } catch (err) {
          if (!isExpectedTicketError(err)) throw err;
          // Not-found / not-awaiting-a-gate — nothing to reject; ack without sending a
          // "Sent back" message for a ticket that was never on a gate.
          await answerCallback(cb.id, `${id}: no gate pending`);
          return NextResponse.json({ ok: true, action: "reject", id });
        }
        await answerCallback(cb.id, `Sent back ${id}`);
        // rejectTicket() already sent the "rejected" Telegram notification in the same
        // call (ADR-010 "single mutation path, no webhook") — do not send it again here.
        return NextResponse.json({ ok: true, action: "reject", id });
      }
      // The webhook cannot detect a rejection (label stays); this route owns the notification.
      await addComment(id, REJECT_NOTE);
      await answerCallback(cb.id, `Sent back ${id}`);
      const msg = buildEventMessage("rejected", { id });
      if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
      return NextResponse.json({ ok: true, action: "reject", id });
    }
    await answerCallback(cb.id);
    return NextResponse.json({ ok: true, ignored: cb.data });
  }

  // 2) Free-text reply
  const msg = update.message;
  if (msg?.text) {
    const ref = msg.reply_to_message?.text?.match(/\b(CAM-\d+)\b/);
    if (ref) {
      if (dbMode) {
        await addDeliveryComment(ref[1], DB_ACTOR, `(Telegram) ${msg.text}`);
      } else {
        await addComment(ref[1], `(Telegram) ${msg.text}`);
      }
      await sendTelegram(`Saved comment on ${ref[1]}`);
      return NextResponse.json({ ok: true, comment: ref[1] });
    }
    // Not tied to a gate → route as an ad-hoc orchestrator request (/camper). Unchanged in
    // both modes — the orchestrator dispatch is independent of the ticket source.
    const r = await fireRepositoryDispatch("camper-adhoc", { text: msg.text });
    await sendTelegram(
      r.dispatched
        ? `Request received — sent to orchestrator\n"${msg.text.slice(0, 140)}"`
        : "Message received — GitHub dispatch not configured (GITHUB_REPO/GH_DISPATCH_TOKEN); continue in session"
    );
    return NextResponse.json({ ok: true, adhoc: r.dispatched });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
