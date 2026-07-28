/**
 * lib/booking-prefill.ts — CAM-634 (epic CAM-630, in-chat guided booking)
 *
 * ONE shared contract for carrying booking dates + party size from the
 * in-chat booking flow into the camp detail page via the URL query string.
 * Exactly ONE writer (`buildBookingPrefillQuery`) and ONE reader
 * (`parseBookingPrefill`) share `bookingPrefillSchema` — no second hand-copy
 * of this shape anywhere else. This repo has a documented scar from exactly
 * that failure mode at the MasterData-group layer: the same
 * group<->param<->field map was hand-copied ~20 times before it was
 * consolidated into a single registry (`lib/taxonomy-registry.ts:3-19`).
 * This file exists so the booking-prefill contract never repeats it.
 *
 * URL shape (for the future callers — not built in this story):
 *   /campgrounds/<slug>?checkIn=2026-08-01&checkOut=2026-08-02&guests=2&from=chat
 *
 * BR-1 — `checkIn` is INCLUSIVE (the first night), `checkOut` is EXCLUSIVE
 * (the checkout day) — byte-identical semantics to `Booking.checkOutDate`
 * and `lib/validations/booking.ts` (never treat checkOut as the last night).
 *
 * BR-2 — for the READER (`parseBookingPrefill`), `today` is an INJECTED
 * parameter (`ctx.today`), never read from the system clock — the same idiom
 * `resolveDatesCore` uses (`lib/ai/tools/resolve-dates.ts:341`) so the reader
 * stays pure/deterministic and unit-testable without faking the system clock.
 * The WRITER's own dev-time past-check (BR-7) is the one exception: it reads
 * the REAL clock, because it is a live "did our own code just build a dead
 * link" assertion, not a pure function under test.
 *
 * IMPORTANT for any future caller that computes a "today" ISO string near
 * this contract (either to build `ctx.today` for the reader, or anywhere
 * else close to this module): always derive it via the repo's Bangkok-local
 * idiom (`bangkokTodayISO()`, `lib/ai/date-phrases.ts:94` —
 * `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok'})`), never a naive
 * UTC date (`new Date().toISOString().slice(0,10)`). Asia/Bangkok is UTC+7,
 * so a naive UTC value can only LAG the true Bangkok date — the failure mode
 * is lenient (a checkIn that is already past in Bangkok wall-clock time can
 * still slip through as "not past" for up to 7 hours), never blocking, which
 * makes it easy to ship unnoticed. Write it down here so nobody has to
 * rediscover it.
 *
 * BR-6 — `parseBookingPrefill` (the READER, untrusted URL input) NEVER
 * throws for any input shape. Dates are all-or-nothing: either the whole
 * prefill is valid, or the whole thing is rejected with exactly one named
 * reason — never a half-applied range.
 *
 * BR-7 — `buildBookingPrefillQuery` (the WRITER, our own code only) is
 * fail-CLOSED, the opposite of BR-6: `.refine()` in `bookingPrefillSchema`
 * does not narrow the inferred TS type, so a hand-built `{checkIn:
 * "2026-02-31", guests: -5}` satisfies `BookingPrefill` at compile time and
 * would otherwise serialize into a shareable dead link, silently rejected
 * only much later by the reader (the camper taps through to empty pickers
 * with no error anywhere). The writer re-validates every field the reader
 * rejects on and THROWS on the first violation — it fails LOUD at the call
 * site, in our own code, during development, instead of producing a
 * confident wrong answer in production.
 */
import { z } from 'zod';
import { MAX_BOOKING_NIGHTS } from '@/lib/validations/booking';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rejects a syntactically-ISO string that isn't a REAL calendar date (e.g.
 * `2026-02-31`, which `new Date()` would otherwise silently roll into
 * 2026-03-03). Done via a round-trip through `Date.UTC` components, not
 * string-parsing shortcuts — this module validates UNTRUSTED input, unlike
 * `resolve-dates.ts`'s helpers which assume an already-valid ISO string.
 */
function isRealCalendarDate(iso: string): boolean {
  if (!ISO_DATE_RE.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Whole nights between two already-validated `YYYY-MM-DD` strings (checkOut EXCLUSIVE, BR-1). */
function nightsBetween(checkIn: string, checkOut: string): number {
  const [iy, im, id] = checkIn.split('-').map(Number);
  const [oy, om, od] = checkOut.split('-').map(Number);
  const start = Date.UTC(iy, im - 1, id);
  const end = Date.UTC(oy, om - 1, od);
  return Math.round((end - start) / 86_400_000);
}

const isoDateSchema = z.string().refine(isRealCalendarDate, {
  message: 'not a real ISO calendar date (YYYY-MM-DD)',
});

/** THE shared contract (BR-1). Context-dependent bounds (today/nights-cap/maxGuests) live in `parseBookingPrefill`, not here — they need runtime context this static schema can't carry. */
export const bookingPrefillSchema = z.object({
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  guests: z.number().int(),
  from: z.literal('chat').optional(),
});
export type BookingPrefill = z.infer<typeof bookingPrefillSchema>;

/** BR-3 — exactly one named reason per rejected parse; never a generic/opaque error. */
export type BookingPrefillRejectReason =
  | 'malformed'
  | 'past'
  | 'inverted'
  | 'too_long'
  | 'guests_out_of_range';

export type BookingPrefillParseResult =
  | { ok: true; value: BookingPrefill }
  | { ok: false; reason: BookingPrefillRejectReason };

/**
 * Real Bangkok-local "today" (D3-style `Intl.DateTimeFormat('en-CA',
 * {timeZone:'Asia/Bangkok'})` idiom), for `buildBookingPrefillQuery`'s own
 * dev-time past-check ONLY (BR-7). Kept as a third local copy rather than
 * importing the equivalent `bangkokTodayISO` from `lib/ai/date-phrases.ts`
 * (private/non-exported there, and a two-file `date-phrases.ts` +
 * `resolve-dates.ts` already each keep a local copy for the same "not
 * exported for reuse" reason) — exporting it is outside this story's file
 * surface; a later story that needs shared access should export it there
 * instead of adding a 4th copy.
 */
function realBangkokTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

/**
 * THE writer. Serializes an already-valid prefill into a query string (no
 * leading `?` — the caller composes `${path}?${buildBookingPrefillQuery(p)}`).
 *
 * BR-7 — fail-CLOSED: throws on the first invalid field/rule instead of
 * silently producing a dead link. Checks every reject reason the reader
 * (`parseBookingPrefill`) can name EXCEPT the upper half of
 * `guests_out_of_range` (`guests > maxGuests`) — the writer has no camp-
 * specific `maxGuests` context, so that half stays the reader's job only.
 */
export function buildBookingPrefillQuery(p: BookingPrefill): string {
  // Re-parse: `.refine()` doesn't narrow the inferred TS type, so a hand-
  // built object can satisfy `BookingPrefill` at compile time while still
  // carrying an unreal calendar date or a non-integer guest count. Throws a
  // ZodError here — at the call site, in our own code — instead of quietly
  // building a dead link (malformed).
  bookingPrefillSchema.parse(p);

  if (p.checkIn < realBangkokTodayISO()) {
    throw new Error(
      `buildBookingPrefillQuery: checkIn (${p.checkIn}) is in the past (Asia/Bangkok "today") — past`
    );
  }
  if (p.checkOut <= p.checkIn) {
    throw new Error(
      `buildBookingPrefillQuery: checkOut (${p.checkOut}) must be strictly after checkIn (${p.checkIn}) — inverted`
    );
  }
  if (nightsBetween(p.checkIn, p.checkOut) > MAX_BOOKING_NIGHTS) {
    throw new Error(
      `buildBookingPrefillQuery: booking window exceeds MAX_BOOKING_NIGHTS (${MAX_BOOKING_NIGHTS}) nights — too_long`
    );
  }
  if (p.guests < 1) {
    throw new Error(`buildBookingPrefillQuery: guests (${p.guests}) must be at least 1 — guests_out_of_range`);
  }

  const params = new URLSearchParams();
  params.set('checkIn', p.checkIn);
  params.set('checkOut', p.checkOut);
  params.set('guests', String(p.guests));
  if (p.from) params.set('from', p.from);
  return params.toString();
}

function scalarOf(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Strict integer text only (`^-?\d+$`) — a decimal/garbage/overflowing guest
 * count is `malformed`, never silently rounded or truncated.
 */
function parseGuestsRaw(v: string | undefined): number | undefined {
  if (v === undefined || !/^-?\d+$/.test(v)) return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : undefined;
}

/**
 * THE reader. Re-validates raw query values against `bookingPrefillSchema`
 * (structural shape: present, not duplicated, real ISO calendar date,
 * integer guests), then applies the context-dependent business rules in a
 * fixed order so exactly one reason is ever returned (BR-3). Never throws
 * for any input shape (BR-6) — `raw` is typed as Next.js's
 * `searchParams` shape (`Record<string, string | string[] | undefined>`),
 * but a caller can still hand it something unexpected at runtime; every
 * unexpected shape falls through to `{ok:false, reason:'malformed'}`.
 */
export function parseBookingPrefill(
  raw: Record<string, string | string[] | undefined>,
  ctx: { today: string; maxGuests: number | null }
): BookingPrefillParseResult {
  try {
    const source = raw ?? {};
    // A duplicated query param (`?guests=1&guests=2`) arrives as an array —
    // scalarOf() maps it to `undefined`, which then fails the required-field
    // check below, same as a genuinely missing param (both are `malformed`).
    const from = scalarOf(source.from) === 'chat' ? 'chat' : undefined;
    const candidate = {
      checkIn: scalarOf(source.checkIn),
      checkOut: scalarOf(source.checkOut),
      guests: parseGuestsRaw(scalarOf(source.guests)),
      from,
    };

    const parsed = bookingPrefillSchema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, reason: 'malformed' };
    }
    const value = parsed.data;

    // BR-2: checkIn may be today, never earlier. ISO YYYY-MM-DD strings
    // compare lexicographically identical to chronological order.
    if (value.checkIn < ctx.today) {
      return { ok: false, reason: 'past' };
    }
    // BR-1: checkOut is EXCLUSIVE — must be strictly after checkIn.
    if (value.checkOut <= value.checkIn) {
      return { ok: false, reason: 'inverted' };
    }
    // Shares the same cap as the booking form (lib/validations/booking.ts) —
    // one exported constant, not two independently-chosen 30s.
    if (nightsBetween(value.checkIn, value.checkOut) > MAX_BOOKING_NIGHTS) {
      return { ok: false, reason: 'too_long' };
    }
    // At least 1 guest, and never over the camp's stated capacity when known.
    if (value.guests < 1 || (ctx.maxGuests !== null && value.guests > ctx.maxGuests)) {
      return { ok: false, reason: 'guests_out_of_range' };
    }

    return { ok: true, value };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}
