/**
 * Server-only email facade backed by the Resend REST API.
 *
 * Guard: if RESEND_API_KEY is absent (dev/CI/preview) the call is skipped and
 * { ok: true, skipped: true } is returned so callers never throw in those envs.
 *
 * No-throw by design — mirrors lib/notify.ts (Telegram) pattern.
 * No npm dependency: plain fetch to https://api.resend.com/emails.
 */
import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // Guard: no key → skip silently (keeps dev/CI/preview green)
  if (!apiKey) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "email_skipped",
        reason: "RESEND_API_KEY not configured",
        subject: params.subject,
      })
    );
    return { ok: true, skipped: true };
  }

  const from =
    process.env.EMAIL_FROM ?? "CampVibe <noreply@campvibe.app>";

  const body = {
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    ...(params.replyTo ? { reply_to: params.replyTo } : {}),
  };

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Network / DNS failure — log safe info only, no key
    console.error(
      JSON.stringify({
        level: "error",
        event: "email_send_error",
        reason: "fetch_exception",
        subject: params.subject,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return { ok: false };
  }

  if (!res.ok) {
    // Resend API error — log HTTP status (no key, no body that may leak secrets)
    console.error(
      JSON.stringify({
        level: "error",
        event: "email_send_error",
        reason: "resend_api_error",
        status: res.status,
        subject: params.subject,
      })
    );
    return { ok: false };
  }

  let responseId: string | undefined;
  try {
    const json = (await res.json()) as { id?: string };
    responseId = json.id;
  } catch {
    // Response parse failure is non-fatal — the email was sent (2xx)
  }

  console.info(
    JSON.stringify({
      level: "info",
      event: "email_sent",
      id: responseId,
      subject: params.subject,
    })
  );

  return { ok: true, id: responseId };
}
