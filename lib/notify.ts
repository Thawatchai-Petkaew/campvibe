// Server-only Telegram notifier for delivery-team escalations.
// No-throw by design: if not configured or the API errors, it logs and returns
// { ok:false } so it never breaks the calling flow (mirrors the webhook pattern).
import "server-only";

export interface TgButton {
  text: string;
  callback_data?: string;
  url?: string;
}

const api = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

/** Send a Telegram message (HTML). Optional inline keyboard. */
export async function sendTelegram(
  text: string,
  opts: { buttons?: TgButton[][]; chatId?: string } = {}
): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, reason: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set" };
  try {
    const res = await fetch(api(token, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(opts.buttons ? { reply_markup: { inline_keyboard: opts.buttons } } : {}),
      }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: `telegram ${res.status}` };
  } catch (e) {
    console.error("sendTelegram failed:", e);
    return { ok: false, reason: "exception" };
  }
}

/** Acknowledge an inline-button tap so Telegram stops the loading spinner. */
export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(api(token, "answerCallbackQuery"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
    });
  } catch (e) {
    console.error("answerCallback failed:", e);
  }
}
