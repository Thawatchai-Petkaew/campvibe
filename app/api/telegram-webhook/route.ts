/**
 * Telegram webhook → reply loop for delivery-team gates.
 *
 * Flow:  gate raised (scripts/linear-sync.mjs adds `awaiting-you`) → Telegram message
 *        with Approve / Reject buttons → you tap (or reply) → this route:
 *          • approve:<CAM-id>  → remove `awaiting-you` (= the Linear webhook then fires
 *                                 the existing repository_dispatch → orchestrator continues)
 *          • reject:<CAM-id>   → keep the label + post the reason as a Linear comment
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
    if (action === "approve" && id) {
      const changed = await removeAwaitingYou(id);
      await answerCallback(cb.id, changed ? `อนุมัติ ${id}` : `${id}: ไม่มี gate ค้าง`);
      await sendTelegram(changed ? `✅ <b>${id}</b> อนุมัติแล้ว — เดินงานต่อ` : `⚠️ ${id} ไม่มี awaiting-you ค้าง`);
      return NextResponse.json({ ok: true, action: "approve", id, changed });
    }
    if (action === "reject" && id) {
      await addComment(id, "🚫 Rejected via Telegram — ต้องแก้ก่อนเดินต่อ");
      await answerCallback(cb.id, `ตีกลับ ${id}`);
      await sendTelegram(`🚫 <b>${id}</b> ถูกตีกลับ (คง awaiting-you) — รอแก้`);
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
      await addComment(ref[1], `💬 (Telegram) ${msg.text}`);
      await sendTelegram(`💬 บันทึกลง ${ref[1]} แล้ว`);
      return NextResponse.json({ ok: true, comment: ref[1] });
    }
    // Not tied to a gate → route as an ad-hoc orchestrator request (/camper).
    const r = await fireRepositoryDispatch("camper-adhoc", { text: msg.text });
    await sendTelegram(
      r.dispatched
        ? `🧭 รับคำสั่งแล้ว — ส่งให้ orchestrator เริ่มงาน\n"${msg.text.slice(0, 140)}"`
        : "รับข้อความแล้ว — แต่ยังตั้ง GitHub dispatch ไม่ครบ (GITHUB_REPO/GH_DISPATCH_TOKEN); ทำต่อในเซสชันได้"
    );
    return NextResponse.json({ ok: true, adhoc: r.dispatched });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
