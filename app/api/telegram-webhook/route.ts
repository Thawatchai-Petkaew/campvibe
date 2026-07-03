/**
 * Telegram webhook → reply loop for delivery-team gates.
 *
 * Flow:  gate raised (lib/delivery/tickets.ts's raiseGate()) → Telegram message with
 *        Approve / Reject buttons → you tap (or reply) → this route:
 *          • approve:<CAM-id>  → calls the delivery service's approve() verb directly,
 *                                 which sends the "approved" notification + fires the
 *                                 repository_dispatch itself in the same call (ADR-010
 *                                 "single mutation path, no webhook") — this route must NOT
 *                                 also send a notification, only ack the tap.
 *          • reject:<CAM-id>   → calls the delivery service's reject() verb, which sends
 *                                 its own "rejected" notification — this route must NOT
 *                                 also send one (double-send).
 *          • free-text reply   → if it replies to a gate message, post it as a comment via
 *                                 the delivery service (free-form ad-hoc routing lands in
 *                                 Phase 3 / /camper)
 *
 * Single mutation path (CAM-281 T-5b retired the legacy Linear branch — ADR-010 "single
 * mutation path, no webhook"). The secret check, answerCallback, and camper-adhoc dispatch
 * for free-text not tied to a gate are unchanged.
 *
 * Required env (Vercel): TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID · TELEGRAM_WEBHOOK_SECRET
 * Register once: setWebhook with secret_token = TELEGRAM_WEBHOOK_SECRET → /api/telegram-webhook
 */
import { NextResponse } from "next/server";
import { answerCallback, sendTelegram } from "@/lib/notify";
import { approve as approveTicket, reject as rejectTicket, addComment as addDeliveryComment } from "@/lib/delivery/tickets";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import { fireRepositoryDispatch } from "@/lib/github-dispatch";

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

  // 1) Inline-button taps — Approve / Reject
  const cb = update.callback_query;
  if (cb?.data) {
    const [action, id] = cb.data.split(":");
    // Defence-in-depth: the id must look like a ticket identifier before it reaches the
    // delivery service.
    if (id && !/^[A-Z]+-\d+$/.test(id)) {
      await answerCallback(cb.id);
      return NextResponse.json({ ok: true, ignored: "bad id" });
    }
    if (action === "approve" && id) {
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
    if (action === "reject" && id) {
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
    await answerCallback(cb.id);
    return NextResponse.json({ ok: true, ignored: cb.data });
  }

  // 2) Free-text reply
  const msg = update.message;
  if (msg?.text) {
    const ref = msg.reply_to_message?.text?.match(/\b(CAM-\d+)\b/);
    if (ref) {
      await addDeliveryComment(ref[1], DB_ACTOR, `(Telegram) ${msg.text}`);
      await sendTelegram(`Saved comment on ${ref[1]}`);
      return NextResponse.json({ ok: true, comment: ref[1] });
    }
    // Not tied to a gate → route as an ad-hoc orchestrator request (/camper).
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
