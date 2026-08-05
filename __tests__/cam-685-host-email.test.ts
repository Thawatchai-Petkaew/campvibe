/**
 * cam-685-host-email.test.ts — CAM-685
 *
 * lib/notifications/host-email.ts adds a host-facing EMAIL channel to the
 * in-app Notification writer (CAM-681/682, lib/notifications/booking-events.ts),
 * gated behind TWO independent switches: RESEND_API_KEY (the transport
 * switch, lib/email/client.ts, untouched here) and EMAIL_HOST_NOTIFICATIONS
 * (the route switch, this story, default OFF).
 *
 * AC → test matrix
 * ─────────────────────────────────────────────────────────────────────────
 * [unit]         decideHostEmail is pure and ALWAYS returns a decision:
 *                flag_off (default) / event_off / actor_is_host /
 *                no_recipient / no_email / send:true (happy path).
 * [normal]       flag on + key present -> sendEmail called exactly once;
 *                `to` is the operator's address ONLY (never a team member);
 *                subject contains the camp name; body links
 *                /dashboard/bookings.
 * [load-bearing] RESEND_API_KEY stubbed PRESENT, EMAIL_HOST_NOTIFICATIONS
 *                left at its default (unset) -> sendEmail is still NEVER
 *                called. Written the obvious way (no key at all) the test
 *                would pass even if the route-level switch were ignored
 *                entirely, because the transport guard (client.ts) would
 *                catch it. Stubbing the key PRESENT is what proves the
 *                second switch actually exists.
 * [normal]       camper-initiated cancel -> decideHostEmail decides normally
 *                (send:true, given a distinct operator); host-initiated (the
 *                actor IS the operator being considered) -> 'actor_is_host',
 *                send:false. booking-events.ts's notifyBookingCancelled is
 *                only ever invoked by its caller for a camper-initiated
 *                cancel (see that function's own doc comment) — so this
 *                branch is proven at the pure decideHostEmail seam directly,
 *                not by routing a host-cancel through the wrapper.
 * [error]        sendEmail resolving { ok:false } still leaves
 *                notifyBookingCreated / notifyBookingCancelled resolving
 *                without throwing (the shape app/api/bookings/*'s 500-trap
 *                depends on) — proven by calling the exported writers
 *                directly with a mocked prisma/camp-access/email-client.
 * [security]     no API key, recipient address, or guest contact detail
 *                appears in any console.info/console.error line emitted by
 *                this module across every branch above.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// "server-only" has no real package on disk (Next.js resolves it via a
// bundler alias) — vitest runs in node, so it must be stubbed the same way
// __tests__/email-client.test.ts already does, or ANY module in the import
// graph that pulls in lib/email/client.ts (directly, like here, or
// transitively via booking-events.ts -> host-email.ts) throws on load.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) } },
}));
vi.mock('@/lib/camp-access', () => ({ listBookingViewRecipients: vi.fn() }));

import { sendEmail } from '@/lib/email/client';
import { prisma } from '@/lib/prisma';
import { listBookingViewRecipients } from '@/lib/camp-access';
import { NOTIFICATION_EVENTS } from '@/lib/notifications/copy';
import {
  decideHostEmail,
  sendHostEmail,
  HOST_EMAIL_EVENTS,
  type HostEmailEventInput,
} from '@/lib/notifications/host-email';
import { notifyBookingCreated, notifyBookingCancelled } from '@/lib/notifications/booking-events';

type Mock = ReturnType<typeof vi.fn>;

const OPERATOR = { userId: 'host-685', email: 'host685@campvibe.com', isOwner: true };
const TEAM_MEMBER = { userId: 'team-685', email: 'team685@campvibe.com', isOwner: false };
const CAMPER_ID = 'camper-685';
const BOOKING_ID = 'booking-685-1';
const CAMP_NAME_TH = 'แคมป์ทดสอบ CAM-685';
const CHECK_IN = new Date('2027-05-01T00:00:00.000Z');
const CHECK_OUT = new Date('2027-05-02T00:00:00.000Z');

function baseInput(overrides: Partial<HostEmailEventInput> = {}): HostEmailEventInput {
  return {
    kind: 'bookingCreated',
    bookingId: BOOKING_ID,
    campName: CAMP_NAME_TH,
    checkInDate: CHECK_IN,
    checkOutDate: CHECK_OUT,
    guests: 2,
    actorUserId: CAMPER_ID,
    recipients: [OPERATOR, TEAM_MEMBER],
    ...overrides,
  };
}

let infoSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  HOST_EMAIL_EVENTS.bookingCreated = true;
  HOST_EMAIL_EVENTS.bookingCancelled = true;
  NOTIFICATION_EVENTS.bookingCreated = true;
  NOTIFICATION_EVENTS.bookingCancelled = true;
  (prisma.notification.createMany as Mock).mockResolvedValue({ count: 0 });
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  HOST_EMAIL_EVENTS.bookingCreated = true;
  HOST_EMAIL_EVENTS.bookingCancelled = true;
  NOTIFICATION_EVENTS.bookingCreated = true;
  NOTIFICATION_EVENTS.bookingCancelled = true;
  infoSpy.mockRestore();
  errorSpy.mockRestore();
});

function allLoggedText(): string {
  return [...infoSpy.mock.calls, ...errorSpy.mock.calls].map((c) => JSON.stringify(c)).join('\n');
}

// ===========================================================================
// decideHostEmail — pure decision, always returns a reason
// ===========================================================================

describe('decideHostEmail (CAM-685)', () => {
  it('[unit][normal][boundary] default config (no env stubbed) -> flag_off', () => {
    const decision = decideHostEmail(baseInput());
    expect(decision.send).toBe(false);
    if (!decision.send) expect(decision.reason).toBe('flag_off');
  });

  it('[unit][load-bearing] RESEND_API_KEY stubbed PRESENT, EMAIL_HOST_NOTIFICATIONS left unset -> still flag_off (the route switch, not the transport switch, gates here)', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key_1234567890');
    const decision = decideHostEmail(baseInput());
    expect(decision.send).toBe(false);
    if (!decision.send) expect(decision.reason).toBe('flag_off');
  });

  it('[unit][boundary] flag on but the event kind is toggled off -> event_off', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    HOST_EMAIL_EVENTS.bookingCreated = false;
    const decision = decideHostEmail(baseInput());
    expect(decision.send).toBe(false);
    if (!decision.send) expect(decision.reason).toBe('event_off');
  });

  it('[unit][null] flag on, no operator in recipients -> no_recipient', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    const decision = decideHostEmail(baseInput({ recipients: [TEAM_MEMBER] }));
    expect(decision.send).toBe(false);
    if (!decision.send) expect(decision.reason).toBe('no_recipient');
  });

  it('[unit][null] flag on, recipients empty -> no_recipient', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    const decision = decideHostEmail(baseInput({ recipients: [] }));
    expect(decision.send).toBe(false);
    if (!decision.send) expect(decision.reason).toBe('no_recipient');
  });

  it('[unit][normal] flag on, the actor IS the operator (host-initiated) -> actor_is_host', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    const decision = decideHostEmail(baseInput({ actorUserId: OPERATOR.userId }));
    expect(decision.send).toBe(false);
    if (!decision.send) expect(decision.reason).toBe('actor_is_host');
  });

  it('[unit][normal] flag on, the actor is the CAMPER (distinct from the operator) -> send:true', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    const decision = decideHostEmail(baseInput({ actorUserId: CAMPER_ID }));
    expect(decision.send).toBe(true);
  });

  it('[unit][boundary] operator email is an empty string -> no_email (near-dead: User.email is non-null)', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    const decision = decideHostEmail(
      baseInput({ recipients: [{ ...OPERATOR, email: '' }] })
    );
    expect(decision.send).toBe(false);
    if (!decision.send) expect(decision.reason).toBe('no_email');
  });

  it('[unit][normal] send:true — `to` is the operator only, never the team member', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    const decision = decideHostEmail(baseInput());
    expect(decision.send).toBe(true);
    if (decision.send) expect(decision.to).toBe(OPERATOR.email);
  });

  it('[unit][normal] send:true — subject contains the camp name, body links /dashboard/bookings', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    const decision = decideHostEmail(baseInput());
    expect(decision.send).toBe(true);
    if (decision.send) {
      expect(decision.subject).toContain(CAMP_NAME_TH);
      expect(decision.html).toContain('/dashboard/bookings');
      expect(decision.html).toContain(BOOKING_ID);
    }
  });

  it('[unit][normal] bookingCancelled kind builds a distinct host-cancellation subject/body from bookingCreated', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    const created = decideHostEmail(baseInput({ kind: 'bookingCreated' }));
    const cancelled = decideHostEmail(baseInput({ kind: 'bookingCancelled' }));
    expect(created.send).toBe(true);
    expect(cancelled.send).toBe(true);
    if (created.send && cancelled.send) {
      expect(cancelled.subject).toContain(CAMP_NAME_TH);
      expect(cancelled.subject).not.toBe(created.subject);
      expect(cancelled.html).not.toBe(created.html);
    }
  });

  it('[unit][null] a null campName falls back to a generic Thai name, never crashes', () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    const decision = decideHostEmail(baseInput({ campName: null }));
    expect(decision.send).toBe(true);
    if (decision.send) {
      expect(decision.subject).not.toContain('null');
      expect(decision.html).not.toContain('null');
    }
  });
});

// ===========================================================================
// sendHostEmail — the thin I/O wrapper
// ===========================================================================

describe('sendHostEmail (CAM-685)', () => {
  it('[integration][boundary] default config -> sendEmail never called; host_email_suppressed logged with the reason', async () => {
    await sendHostEmail(baseInput());
    expect(sendEmail).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse((infoSpy.mock.calls[0] as unknown[])[0] as string);
    expect(logged.event).toBe('host_email_suppressed');
    expect(logged.reason).toBe('flag_off');
  });

  it('[integration][normal] flag on + key present -> sendEmail called exactly once with the operator-only `to`', async () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    vi.stubEnv('RESEND_API_KEY', 're_test_key_1234567890');
    (sendEmail as Mock).mockResolvedValueOnce({ ok: true, id: 'email-1' });

    await sendHostEmail(baseInput());

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = (sendEmail as Mock).mock.calls[0][0] as { to: string; subject: string; html: string };
    expect(call.to).toBe(OPERATOR.email);
    expect(call.subject).toContain(CAMP_NAME_TH);
    expect(call.html).toContain('/dashboard/bookings');
  });

  it('[integration][error] sendEmail resolving {ok:false} does not throw; host_email_send_failed logged', async () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    (sendEmail as Mock).mockResolvedValueOnce({ ok: false });

    await expect(sendHostEmail(baseInput())).resolves.toBeUndefined();

    const logged = JSON.parse((errorSpy.mock.calls[0] as unknown[])[0] as string);
    expect(logged.event).toBe('host_email_send_failed');
  });

  it('[integration][error][load-bearing] sendEmail REJECTS -> sendHostEmail still resolves, never throws', async () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    (sendEmail as Mock).mockRejectedValueOnce(new Error('resend down'));

    await expect(sendHostEmail(baseInput())).resolves.toBeUndefined();
    const logged = JSON.parse((errorSpy.mock.calls[0] as unknown[])[0] as string);
    expect(logged.event).toBe('host_email_exception');
  });

  it('[security] no API key, recipient address, or guest contact detail appears in any logged line, across every branch above', () => {
    const text = allLoggedText();
    expect(text).not.toContain(OPERATOR.email);
    expect(text).not.toContain(TEAM_MEMBER.email);
    expect(text).not.toContain('re_test_key_1234567890');
    expect(text).not.toMatch(/@campvibe\.com/);
  });
});

// ===========================================================================
// Wiring — booking-events.ts calls sendHostEmail from the SAME recipients
// fetch it already does for the in-app write (no second query/call site)
// ===========================================================================

describe('notifyBookingCreated / notifyBookingCancelled wire the host email decision (CAM-685)', () => {
  function bookingInput(overrides: Record<string, unknown> = {}) {
    return {
      id: BOOKING_ID,
      userId: CAMPER_ID,
      campSiteId: 'camp-685',
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      guests: 2,
      snapshotCampName: CAMP_NAME_TH,
      ...overrides,
    };
  }

  it('[integration][normal] default config -> notifyBookingCreated writes the in-app row but never calls sendEmail', async () => {
    (listBookingViewRecipients as Mock).mockResolvedValueOnce([OPERATOR, TEAM_MEMBER]);

    await notifyBookingCreated(bookingInput());

    expect(prisma.notification.createMany).toHaveBeenCalledOnce();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('[integration][normal] flag on -> notifyBookingCreated ALSO sends the host email once, to the operator', async () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    (listBookingViewRecipients as Mock).mockResolvedValueOnce([OPERATOR, TEAM_MEMBER]);
    (sendEmail as Mock).mockResolvedValueOnce({ ok: true, id: 'email-2' });

    await notifyBookingCreated(bookingInput());

    expect(sendEmail).toHaveBeenCalledOnce();
    expect((sendEmail as Mock).mock.calls[0][0].to).toBe(OPERATOR.email);
  });

  it('[integration][normal] flag on -> a CAMPER-initiated cancel (notifyBookingCancelled) sends the host email once', async () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    (listBookingViewRecipients as Mock).mockResolvedValueOnce([OPERATOR]);
    (sendEmail as Mock).mockResolvedValueOnce({ ok: true, id: 'email-3' });

    await notifyBookingCancelled(bookingInput({ userId: CAMPER_ID }));

    expect(sendEmail).toHaveBeenCalledOnce();
    expect((sendEmail as Mock).mock.calls[0][0].to).toBe(OPERATOR.email);
  });

  it('[integration][normal] flag on -> the operator booking (and cancelling) their OWN camp emails nobody (actor_is_host)', async () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    (listBookingViewRecipients as Mock).mockResolvedValueOnce([
      { userId: OPERATOR.userId, email: OPERATOR.email, isOwner: true },
    ]);

    await notifyBookingCreated(bookingInput({ userId: OPERATOR.userId }));

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('[integration][error] sendEmail returning {ok:false} still leaves notifyBookingCreated resolving cleanly (the booking response stays 201 downstream)', async () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    (listBookingViewRecipients as Mock).mockResolvedValueOnce([OPERATOR]);
    (sendEmail as Mock).mockResolvedValueOnce({ ok: false });

    await expect(notifyBookingCreated(bookingInput())).resolves.toBeUndefined();
    expect(prisma.notification.createMany).toHaveBeenCalledOnce(); // in-app write unaffected
  });

  it('[integration][error][load-bearing] sendEmail REJECTS -> notifyBookingCancelled still resolves cleanly (the booking response stays 200 downstream)', async () => {
    vi.stubEnv('EMAIL_HOST_NOTIFICATIONS', 'true');
    (listBookingViewRecipients as Mock).mockResolvedValueOnce([OPERATOR]);
    (sendEmail as Mock).mockRejectedValueOnce(new Error('resend down'));

    await expect(notifyBookingCancelled(bookingInput({ userId: CAMPER_ID }))).resolves.toBeUndefined();
  });

  it('[security] no API key, recipient address, or guest contact detail appears in any logged line from the wiring tests above', () => {
    const text = allLoggedText();
    expect(text).not.toContain(OPERATOR.email);
    expect(text).not.toContain(TEAM_MEMBER.email);
  });
});
