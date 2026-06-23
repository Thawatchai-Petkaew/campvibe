/**
 * Telegram webhook → reply loop for delivery-team gates.
 *
 * Flow:  gate raised (scripts/linear-sync.mjs adds `awaiting-you`) → Telegram message
 *        with Approve / Reject buttons → you tap (or reply) → this route:
 *          • approve:<CAM-id>  → remove `awaiting-you` (= the Linear webhook then fires
 *                                 the existing repository_dispatch → orchestrator continues;
 *                                 the webhook also sends the "Approved" notification, so we
 *                                 do NOT send a duplicate message here — only ack the tap)
 *          • reject:<CAM-id>   → keep the label + post the reason as a Linear comment
 *                                 + send the "Sent back for changes" notification (the webhook
 *                                 cannot detect a rejection, so this route owns that send)
 *          • free-text reply   → if it replies to a gate message, post it as a comment
 *                                 (free-form ad-hoc routing lands in Phase 3 / /camper)
 *
 * Required env (Vercel): TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID · TELEGRAM_WEBHOOK_SECRET
 * Register once: setWebhook with secret_token = TELEGRAM_WEBHOOK_SECRET → /api/telegram-webhook
 */
import { NextResponse } from "next/server";
import { answerCallback, sendTelegram } from "@/lib/notify";
import { addComment, removeAwaitingYou } from "@/lib/linear-actions";
import { fireRepositoryDispatch } from "@/lib/github-dispatch";
import { buildEventMessage } from "@/lib/notify-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TgUpdate {
  callback_query?: { id: string; data?: string };
  message?: { text?: string; reply_to_message?: { text?: string } };
}

function authorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get("x-telegram-bot-api-secret-token") === secret;
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
    // Defence-in-depth: the id must look like a Linear identifier before it reaches any Linear call.
    if (id && !/^[A-Z]+-\d+$/.test(id)) {
      await answerCallback(cb.id);
      return NextResponse.json({ ok: true, ignored: "bad id" });
    }
    if (action === "approve" && id) {
      const changed = await removeAwaitingYou(id);
      await answerCallback(cb.id, changed ? `Approved ${id}` : `${id}: no gate pending`);
      // The Approve tap is the reliable signal that a gate was approved → send "Approved".
      // The webhook no longer sends this message (it only continues the orchestrator on
      // awaiting-you removal), so there is no duplicate.
      if (changed) {
        const msg = buildEventMessage("approved", { id });
        if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
      }
      return NextResponse.json({ ok: true, action: "approve", id, changed });
    }
    if (action === "reject" && id) {
      // The webhook cannot detect a rejection (label stays); this route owns the notification.
      await addComment(id, "Rejected via Telegram — needs changes before continuing");
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
      await addComment(ref[1], `(Telegram) ${msg.text}`);
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
