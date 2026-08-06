import { hostNewBookingEmail, hostBookingCancelledEmail } from '@/lib/email/templates';
import { bookingHighlightLink } from '@/lib/notifications/copy';
import type { HostRecipient } from '@/lib/camp-access';

/**
 * lib/notifications/host-email.ts — CAM-685, the EMAIL counterpart to
 * lib/notifications/booking-events.ts's in-app Notification writer
 * (CAM-681/682). Called FROM notifyBookingCreated / notifyBookingCancelled,
 * reusing the SAME listBookingViewRecipients() result those functions
 * already fetched for the in-app write — no second call site, no second
 * query. Supersedes the old CAM-74 backlog plan (no `npm install resend`, no
 * new `lib/email.ts`, no direct hook inside app/api/bookings/*).
 *
 * TWO independent switches, on purpose:
 *
 *   1. RESEND_API_KEY (lib/email/client.ts, untouched by this story) — the
 *      TRANSPORT switch. With no key, sendEmail() logs `email_skipped` and
 *      resolves { ok: true, skipped: true } without a network call.
 *   2. EMAIL_HOST_NOTIFICATIONS (this module) — the ROUTE switch, specific
 *      to this event family. Default OFF. The day CAM-62 turns
 *      RESEND_API_KEY on for camper confirmation emails, a route with only
 *      switch #1 would start firing host emails at the same instant,
 *      silently, with nobody having approved that. Read at CALL TIME (not
 *      captured at module load) so `vi.stubEnv` works in tests and a runtime
 *      env change takes effect without a redeploy-triggered module reload.
 *
 * decideHostEmail is PURE (no I/O) and ALWAYS returns a decision — including
 * *why* it said no — so a test can assert the reason (proving "off" is a
 * real, inspectable decision) rather than merely the absence of a network
 * call. sendHostEmail is the thin I/O wrapper around it: build -> if
 * !decision.send, log `host_email_suppressed` and return -> else sendEmail.
 * Same build -> null/off -> act -> never-throw shape as
 * lib/delivery/tickets.ts's notifySafe and this module's own
 * booking-events.ts siblings (notifyBookingCreated / notifyBookingCancelled)
 * — a notify failure here must never turn a successfully committed booking
 * or cancellation into a 500.
 *
 * PDPA / quota note: unlike the in-app Notification row (revocable — GET
 * /api/notifications re-checks BOOKING_VIEW on every read; see
 * lib/notifications/copy.ts's module doc), an email cannot be revoked once
 * sent, and Resend's free tier is 3,000/month + 100/day. Recipients are
 * therefore the CAMP OPERATOR ONLY (HostRecipient.isOwner === true) — never
 * a team member — narrower than the in-app fan-out on purpose.
 *
 * lib/email/client.ts is imported LAZILY (dynamic `import()` inside
 * sendHostEmail, only on the `decision.send === true` branch) rather than at
 * module load. client.ts carries `import "server-only"`, a Next.js-internal
 * package with no real npm entry — resolvable only inside a Next.js build,
 * not under vitest (node), so any test that touches it must `vi.mock`
 * "server-only" first. booking-events.ts (this module's only caller) is
 * imported by CAM-681/682's existing test suites, which predate this story
 * and do not carry that mock. Since EMAIL_HOST_NOTIFICATIONS defaults off,
 * those tests never reach the `send:true` branch — the lazy import means
 * they never touch lib/email/client.ts's module graph at all, so nothing
 * about their existing (unmodified) setup needs to change.
 */

export type HostEmailEventKind = 'bookingCreated' | 'bookingCancelled';

/** Per-event kill switch, mirrors lib/notifications/copy.ts's
 *  NOTIFICATION_EVENTS pattern. Mutable so tests can flip a single event off
 *  without touching the route-level EMAIL_HOST_NOTIFICATIONS env switch. */
export const HOST_EMAIL_EVENTS: Record<HostEmailEventKind, boolean> = {
  bookingCreated: true,
  bookingCancelled: true,
};

const FALLBACK_CAMP_NAME = 'แคมป์ของคุณ';

export interface HostEmailEventInput {
  kind: HostEmailEventKind;
  bookingId: string;
  /** Booking.snapshotCampName (TH), frozen at booking time — ADR-005. */
  campName: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
  /**
   * The user who performed the triggering action. Both booking-events.ts
   * call sites only ever invoke this module with the booking's camper as
   * the actor (notifyBookingCreated: the creator; notifyBookingCancelled:
   * called only when isCamper && !canHostUpdate — see that function's own
   * doc comment). Compared against the operator recipient below to suppress
   * a host being emailed about their own action (e.g. a host who booked
   * their own camp) — see the 'actor_is_host' reason.
   */
  actorUserId: string;
  /**
   * listBookingViewRecipients(campSiteId)'s full result — already fetched
   * by the caller for the in-app write; this module never re-queries.
   * decideHostEmail picks the operator (isOwner) itself; a team member is
   * never an email recipient regardless of BOOKING_VIEW.
   */
  recipients: HostRecipient[];
}

export type HostEmailDecision =
  | { send: true; to: string; subject: string; html: string }
  | { send: false; reason: 'flag_off' | 'event_off' | 'actor_is_host' | 'no_recipient' | 'no_email' };

/** Read at call time, not captured at module load — see module doc §2. */
function isHostEmailFlagOn(): boolean {
  return process.env.EMAIL_HOST_NOTIFICATIONS === 'true';
}

/**
 * Pure decision — no I/O, no side effects, no throw. Always returns a
 * decision (see module doc) — this is the seam that makes "off" provable.
 */
export function decideHostEmail(input: HostEmailEventInput): HostEmailDecision {
  if (!isHostEmailFlagOn()) return { send: false, reason: 'flag_off' };
  if (!HOST_EMAIL_EVENTS[input.kind]) return { send: false, reason: 'event_off' };

  const operator = input.recipients.find((r) => r.isOwner);
  if (!operator) return { send: false, reason: 'no_recipient' };
  if (operator.userId === input.actorUserId) return { send: false, reason: 'actor_is_host' };
  // Near-dead: User.email is `String @unique`, non-nullable — kept as a
  // defensive fallback only, not elaborated further (see module doc).
  if (!operator.email) return { send: false, reason: 'no_email' };

  const campName = input.campName ?? FALLBACK_CAMP_NAME;
  const bookingUrl = bookingHighlightLink(input.bookingId);

  const template =
    input.kind === 'bookingCreated'
      ? hostNewBookingEmail({
          campName,
          checkIn: input.checkInDate,
          checkOut: input.checkOutDate,
          guests: input.guests,
          bookingUrl,
        })
      : hostBookingCancelledEmail({
          campName,
          checkIn: input.checkInDate,
          checkOut: input.checkOutDate,
          bookingUrl,
        });

  return { send: true, to: operator.email, subject: template.subject, html: template.html };
}

/**
 * Thin I/O wrapper — decide -> if suppressed, log `host_email_suppressed`
 * (bookingId/kind/reason only — never the recipient address) and return ->
 * else call sendEmail(). Never throws; a failed/suppressed host email must
 * never turn a successfully committed booking/cancellation into a 500 for
 * the camper who just acted (mirrors this module's booking-events.ts
 * siblings — see their own doc comments for the full 500-trap reasoning).
 */
export async function sendHostEmail(input: HostEmailEventInput): Promise<void> {
  try {
    const decision = decideHostEmail(input);
    if (!decision.send) {
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'host_email_suppressed',
          bookingId: input.bookingId,
          kind: input.kind,
          reason: decision.reason,
        })
      );
      return;
    }

    // Lazy import — see module doc for why this must not be a static
    // top-level import.
    const { sendEmail } = await import('@/lib/email/client');
    const result = await sendEmail({ to: decision.to, subject: decision.subject, html: decision.html });
    if (!result.ok) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'host_email_send_failed',
          bookingId: input.bookingId,
          kind: input.kind,
        })
      );
    }
  } catch (e) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'host_email_exception',
        bookingId: input.bookingId,
        kind: input.kind,
        reason: e instanceof Error ? e.message : String(e),
      })
    );
  }
}
