import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateSpotCapacity, sumSpotCapacity } from '@/lib/spot-aggregation';

/**
 * CAM-355 BR-1/BR-2 (T-B read-through): the effective capacity a camp
 * enforces/displays, mode-driven. Never null for PER-SPOT (a derived sum is
 * always a real number, 0 included — BR-6); may be null for WHOLE-CAMP (no
 * explicit column value set = unbounded, unchanged pre-existing semantics).
 */
export interface EffectiveCapacity {
  maxGuestsPerDay: number | null;
  maxTentsPerDay: number | null;
}

/** The subset of CampSite fields getEffectiveCapacity needs to decide mode + read the column. */
interface CampSiteCapacityMode {
  id: string;
  useSpotView: boolean;
  maxGuestsPerDay: number | null;
  maxTentsPerDay: number | null;
}

/**
 * CAM-355 BR-1/BR-2/BR-3 (T-B read-through, ADR-009 single derivation): the
 * ONE effective-capacity helper shared by every enforcement/display reader —
 * checkDateAvailabilityInTx (booking write gate), getRemainingCapacity
 * (detail badge), and lib/spot-aggregation.ts getCampSiteWithCapacity
 * (display fold-in). getAvailabilityStatusForCamps (catalog badge) uses the
 * same underlying sumSpotCapacity formula directly in a batched, multi-camp
 * shape instead of calling this per-camp (BR-5 — O(1) queries per page).
 *
 * WHOLE-CAMP (`useSpotView = false`): reads the stored column UNCHANGED
 * (BR-8 — no per-spot branch executes; a hard regression boundary).
 * PER-SPOT (`useSpotView = true`): sums non-deleted spots via
 * calculateSpotCapacity (BR-3 soft-delete filter) — a spot-sum of 0 (no live
 * spots, or every per-spot value null/0) is returned as 0, NEVER falls back
 * to the stale stored column (BR-6, the bug this story fixes).
 *
 * `client` may be the default `prisma` singleton or a `Prisma.TransactionClient`
 * — passing the tx client keeps the PER-SPOT sum snapshot-consistent with the
 * booking/hold reads inside the SAME serializable transaction (EC-1, EC-2).
 */
export async function getEffectiveCapacity(
  client: PrismaClient | Prisma.TransactionClient,
  campSite: CampSiteCapacityMode
): Promise<EffectiveCapacity> {
  if (!campSite.useSpotView) {
    return { maxGuestsPerDay: campSite.maxGuestsPerDay, maxTentsPerDay: campSite.maxTentsPerDay };
  }
  const spotCapacity = await calculateSpotCapacity(campSite.id, client);
  return { maxGuestsPerDay: spotCapacity.maxGuestsPerDay, maxTentsPerDay: spotCapacity.maxTentsPerDay };
}

/**
 * CAM-355 BR-4 perf: the PER-SPOT sum is date-independent within one booking/
 * hold transaction — every night in the same stay/hold range must reuse the
 * SAME derived total rather than re-querying the spot table per night.
 * Memoized by tx object identity (WeakMap — scoped to exactly one
 * transaction, garbage-collected with it, never leaks across requests or
 * retries — a P2034 retry opens a brand-new tx, a fresh cache miss, correctly
 * re-reading live state) then by campSiteId. checkDateAvailabilityInTx is the
 * only caller; keeping the hoist self-contained here means every existing
 * per-night caller — the booking write path (app/api/bookings/route.ts) AND
 * the CAM-302 hold write path (app/api/campsites/[id]/holds/route.ts) — gets
 * it for free with NO call-site change.
 */
const spotCapacityByTx = new WeakMap<Prisma.TransactionClient, Map<string, Promise<EffectiveCapacity>>>();

function getSpotCapacityOnceForTx(
  tx: Prisma.TransactionClient,
  campSite: CampSiteCapacityMode
): Promise<EffectiveCapacity> {
  let byCamp = spotCapacityByTx.get(tx);
  if (!byCamp) {
    byCamp = new Map();
    spotCapacityByTx.set(tx, byCamp);
  }
  let pending = byCamp.get(campSite.id);
  if (!pending) {
    pending = getEffectiveCapacity(tx, campSite);
    byCamp.set(campSite.id, pending);
  }
  return pending;
}

/**
 * Returns BlockedDate rows that overlap [startDate, endDate] for the given
 * campSiteId, applying the IDENTICAL predicate used by the booking write path
 * (app/api/bookings/route.ts lines 93–104, CAM-57 / ADR-006).
 *
 * spotId: when provided, also includes spot-level blocks for that spot.
 * When omitted (campsite-level availability), only whole-camp blocks (spotId null) are returned.
 *
 * PRIVACY DECISION (CAM-190, owner-delegated): reason field is intentionally NOT
 * returned to callers — guests see only a blockedByHost boolean flag, not the
 * host's free-text notes.
 */
export async function getBlockedDatesForRange(
  campSiteId: string,
  startDate: Date,
  endDate: Date,
  spotId?: string
): Promise<{ startDate: Date; endDate: Date }[]> {
  return prisma.blockedDate.findMany({
    where: {
      campSiteId,
      deletedAt: null,
      OR: [
        { spotId: null },
        ...(spotId ? [{ spotId }] : []),
      ],
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
      ],
    },
    select: { startDate: true, endDate: true },
  });
}

/**
 * CAM-302 (ADR-012 §4) — returns ACTIVE, non-expired InternalHold rows that
 * overlap [startDate, endDate] for the given campSiteId. Predicate mirrors
 * getBlockedDatesForRange exactly (same lte/gte overlap shape); the ONLY
 * addition is the lazy-expiry filter (status = ACTIVE AND expiresAt > now) —
 * an expired hold silently drops out of every read here, no cron, no row
 * rewrite (ADR-012 §4 "lazy vs cron expiry", BR-2).
 *
 * spotId is NOT filtered here (unlike getBlockedDatesForRange) — a spot-level
 * hold still counts against the camp-wide capacity bottleneck exactly like a
 * spot-level Booking already does (BR-3); there is no separate per-spot
 * capacity concept in this schema.
 */
export async function getActiveHoldsForRange(
  campSiteId: string,
  startDate: Date,
  endDate: Date
): Promise<{ startDate: Date; endDate: Date; guests: number }[]> {
  return prisma.internalHold.findMany({
    where: {
      campSiteId,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
      ],
    },
    select: { startDate: true, endDate: true, guests: true },
  });
}

/**
 * CAM-401 (security finding, event-loop DoS — CAM-344 class): thrown by
 * getCampSiteDailyAvailability when the caller-supplied [startDate, endDate]
 * spans more nights than MAX_STATUS_RANGE_NIGHTS allows. Callers (the public,
 * unauthenticated availability route; getRemainingCapacity) map this to a
 * safe 400/generic response — never a stack trace or Prisma detail to the
 * client (AC-2).
 */
export class AvailabilityRangeTooWideError extends Error {
  constructor(dayCount: number) {
    super(`Date range spans ${dayCount} days, exceeding the maximum of ${MAX_STATUS_RANGE_NIGHTS}`);
    this.name = 'AvailabilityRangeTooWideError';
  }
}

/**
 * Get daily availability for a camp site
 * Returns guests and tents booked for each date, plus host BlockedDate coverage
 * and held (InternalHold) guests — CAM-302, kept separate from bookedGuests
 * (ADR-012 §4: a host dashboard legitimately wants both numbers).
 *
 * CAM-401 BR-1 (security finding, G3 review of CAM-400): the per-day loop
 * below iterates directly over the CALLER-SUPPLIED [startDate, endDate]
 * range — INCLUSIVE of endDate, this function's own long-standing
 * convention (unlike getAvailabilityStatusForCamps' exclusive-checkout
 * convention below). The public availability route (app/api/campsites/[id]/
 * availability/route.ts) reaches this UNAUTHENTICATED, so an absurd range
 * (e.g. startDate=2026-01-01&endDate=9999-12-31) could otherwise hang the
 * event loop on a single request — the same CAM-344 class of bug, just a
 * different loop. Reuses the SAME MAX_STATUS_RANGE_NIGHTS constant (one
 * constant, not a twin) and mirrors its comparison exactly: > MAX rejects,
 * = MAX passes (EC-1 boundary). Checked BEFORE any Prisma call or loop —
 * generalizing the CAM-344 principle ("protect every caller", BR-1) to
 * every consumer of this function (getRemainingCapacity included).
 *
 * Non-finite/inverted ranges are LEFT UNCHANGED (EC-2, no regression): they
 * already fall through to 0 loop iterations today because an Invalid Date
 * or startDate > endDate makes every `<=`/`<` comparison below evaluate
 * false — this guard only rejects a POSITIVE span wider than the cap.
 */
export async function getCampSiteDailyAvailability(
  campSiteId: string,
  startDate: Date,
  endDate: Date
) {
  const dayCount =
    Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (dayCount > MAX_STATUS_RANGE_NIGHTS) {
    throw new AvailabilityRangeTooWideError(dayCount);
  }

  const bookings = await prisma.booking.findMany({
    where: {
      campSiteId,
      status: { in: ['CONFIRMED', 'PENDING'] }, // Only count confirmed and pending bookings
      AND: [
        { checkInDate: { lte: endDate } },
        { checkOutDate: { gte: startDate } }
      ]
    },
    select: {
      checkInDate: true,
      checkOutDate: true,
      guests: true,
      status: true
    }
  });

  // Group by date
  const availability: Record<string, { bookedGuests: number; bookedTents: number; blockedByHost: boolean; heldGuests: number }> = {};

  // Initialize all dates in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    availability[dateKey] = { bookedGuests: 0, bookedTents: 0, blockedByHost: false, heldGuests: 0 };
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate bookings per day
  bookings.forEach(booking => {
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);

    // Count each day in the booking range
    const date = new Date(checkIn);
    while (date < checkOut) {
      const dateKey = date.toISOString().split('T')[0];
      if (availability[dateKey]) {
        availability[dateKey].bookedGuests += booking.guests;
        // Estimate tents: assume 2 guests per tent on average
        availability[dateKey].bookedTents += Math.ceil(booking.guests / 2);
      }
      date.setDate(date.getDate() + 1);
    }
  });

  // Apply host BlockedDate ranges (one query for the full range — no N+1).
  // Predicate is IDENTICAL to the booking write path (app/api/bookings/route.ts
  // lines 93–104, CAM-57 / ADR-006). Camp-level only (no spotId here).
  const blockedRanges = await getBlockedDatesForRange(campSiteId, startDate, endDate);

  for (const block of blockedRanges) {
    const cur = new Date(block.startDate);
    const blockEnd = new Date(block.endDate);
    while (cur <= blockEnd && cur <= endDate) {
      const dateKey = cur.toISOString().split('T')[0];
      if (availability[dateKey]) {
        availability[dateKey].blockedByHost = true;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  // CAM-302 (ADR-012 §4): fold ACTIVE non-expired holds in — one query for the
  // whole range (no N+1), same shape as the booking/blockedDate loops above.
  // endDate is the EXCLUSIVE checkout day (BR-2) — identical loop shape to the
  // booking loop above (`while (date < checkOut)`), NOT the inclusive BlockedDate
  // loop shape.
  const holds = await getActiveHoldsForRange(campSiteId, startDate, endDate);

  for (const hold of holds) {
    // CAM-401 BR-2 sweep finding: unlike Booking (capped 30 nights at create,
    // lib/validations/booking.ts) and BlockedDate (capped 90 days at create,
    // lib/validations/blocked-dates.ts), InternalHold has NO max-span cap at
    // write time — a hold's own startDate/endDate could still be far wider
    // than the (now-capped) caller range while merely OVERLAPPING it. This
    // loop is clamped to the caller's own window (mirrors the BlockedDate
    // loop's `&& cur <= endDate` bound just above) so its ITERATION COUNT is
    // bounded too; the OUTPUT is unchanged — a date outside the window was
    // already a no-op via the `if (availability[dateKey])` guard below.
    const date = new Date(hold.startDate < startDate ? startDate : hold.startDate);
    const holdEnd = new Date(hold.endDate);
    while (date < holdEnd && date <= endDate) {
      const dateKey = date.toISOString().split('T')[0];
      if (availability[dateKey]) {
        availability[dateKey].heldGuests += hold.guests;
      }
      date.setDate(date.getDate() + 1);
    }
  }

  return availability;
}

/**
 * Result shape for getRemainingCapacity — CAM-267 PREP-1 (+ CAM-302 heldGuests).
 */
export interface RemainingCapacityResult {
  /**
   * The effective capacity (CAM-355 BR-1/getEffectiveCapacity): WHOLE-CAMP
   * reads CampSite.maxGuestsPerDay unchanged (null = no explicit capacity set,
   * unbounded — never rendered as a number); PER-SPOT is the live derived sum
   * of non-deleted spots' maxCampers (never null — 0 when no live spots).
   */
  capacity: number | null;
  /** Booked (non-CANCELLED) guests on the bottleneck night — the night with the highest bookedGuests + heldGuests. */
  bookedGuests: number;
  /**
   * CAM-302 (ADR-012 §4): ACTIVE, non-expired InternalHold guests on that SAME
   * bottleneck night. Kept as its own labeled number, never merged into
   * bookedGuests — a host dashboard legitimately wants "X confirmed + Y on hold"
   * as two numbers, same reasoning that already keeps blockedByHost separate.
   */
  heldGuests: number;
  /**
   * capacity - (bookedGuests + heldGuests), floored at 0 (CAM-267 AC-2, extended
   * by CAM-302 to also subtract holds). null when capacity is null (unbounded,
   * nothing to subtract from) AND the range is not host-blocked. Forced to 0
   * whenever blockedByHost is true — a whole-site BlockedDate makes the site
   * unavailable for the range regardless of the numeric capacity.
   */
  remaining: number | null;
  /** true when ANY night in [startDate, endDate) is covered by a whole-camp BlockedDate (spotId: null). */
  blockedByHost: boolean;
}

/**
 * CAM-267 PREP-1: the single shared implementation for "remaining capacity" over
 * a requested stay [startDate, endDate) — nights only; the checkout day itself is
 * excluded, mirroring the booking write-path's per-night loop (app/api/bookings/
 * route.ts, Check 2: `while (capacityDate < checkOut)`).
 *
 * Built ONLY on top of getCampSiteDailyAvailability (the single source of truth
 * for bookedGuests + blockedByHost per day, CAM-190/ADR-006) — this function does
 * NOT run a second booking/blockedDate query, so it can never disagree with the
 * booking page's own math (checkDateAvailability / checkDateAvailabilityInTx read
 * the exact same per-day map).
 *
 * The bottleneck night (max bookedGuests across the stay) drives `remaining`; ANY
 * blocked night makes `blockedByHost` true and forces `remaining` to 0 (BR:
 * "BlockedDate covering a day ⇒ that day remaining=0 — whole-site block").
 *
 * PRIVACY (CAM-190 owner-delegated decision): BlockedDate.reason is never read or
 * returned here — callers get only the boolean blockedByHost flag.
 */
export async function getRemainingCapacity(
  campSiteId: string,
  startDate: Date,
  endDate: Date
): Promise<RemainingCapacityResult> {
  const campSite = await prisma.campSite.findUnique({
    where: { id: campSiteId },
    select: { useSpotView: true, maxGuestsPerDay: true, maxTentsPerDay: true },
  });

  if (!campSite) {
    return { capacity: null, bookedGuests: 0, heldGuests: 0, remaining: null, blockedByHost: false };
  }

  // CAM-355 BR-1/BR-6 (T-B read-through): PER-SPOT derives a LIVE, always-
  // defined capacity (never the stale column — a zero-spot per-spot camp is
  // capacity 0 = "เต็มแล้ว", not unbounded). WHOLE-CAMP is unchanged (BR-8):
  // reads the stored column exactly as before this story.
  const effective = await getEffectiveCapacity(prisma, {
    id: campSiteId,
    useSpotView: campSite.useSpotView,
    maxGuestsPerDay: campSite.maxGuestsPerDay,
    maxTentsPerDay: campSite.maxTentsPerDay,
  });
  const capacity = effective.maxGuestsPerDay;

  // Nights only: exclude the checkout day (a guest departing that day frees the
  // spot for a same-day arrival). A same-day / inverted range has no night to
  // check — treat as fully open; the API boundary rejects checkOut <= checkIn
  // before a real booking attempt ever reaches this function.
  const lastNight = new Date(endDate);
  lastNight.setDate(lastNight.getDate() - 1);
  if (lastNight < startDate) {
    return { capacity, bookedGuests: 0, heldGuests: 0, remaining: capacity, blockedByHost: false };
  }

  const daily = await getCampSiteDailyAvailability(campSiteId, startDate, lastNight);

  // CAM-302: the bottleneck night is now the night with the highest COMBINED
  // (bookedGuests + heldGuests) — a hold-heavy night can be the true bottleneck
  // even when its bookedGuests alone is lower than another night's. Both counts
  // reported are the ones from that same bottleneck night (kept separately
  // labeled per ADR-012 §4, never merged into one number).
  let bookedGuests = 0;
  let heldGuests = 0;
  let blockedByHost = false;
  let maxCombined = -1;
  for (const day of Object.values(daily)) {
    const combined = day.bookedGuests + day.heldGuests;
    if (combined > maxCombined) {
      maxCombined = combined;
      bookedGuests = day.bookedGuests;
      heldGuests = day.heldGuests;
    }
    if (day.blockedByHost) blockedByHost = true;
  }

  const remaining = blockedByHost
    ? 0
    : capacity !== null
      ? Math.max(0, capacity - (bookedGuests + heldGuests))
      : null;

  return { capacity, bookedGuests, heldGuests, remaining, blockedByHost };
}

/**
 * CAM-344 — three-state per-camp availability status for a page of dated
 * catalog search results.
 *
 * BACKEND CONTRACT CALL (spec left this open — "architect/backend contract
 * details, not fixed here"):
 *   - enum literal: 'FULLY_UNAVAILABLE' | 'PARTIALLY_UNAVAILABLE'. Absence
 *     from the returned map = fully available (no badge), per BR-3/BR-4.
 *   - field name on the card payload: `availabilityStatus` (see
 *     components/CampgroundGrid.tsx CampSiteCardData).
 */
export type CampAvailabilityStatus = 'FULLY_UNAVAILABLE' | 'PARTIALLY_UNAVAILABLE';

/**
 * SECURITY (G3 review finding, event-loop DoS): the widest date span this
 * helper will ever classify in-memory. `getAvailabilityStatusForCamps` runs a
 * synchronous per-night loop per camp; the public, unauthenticated,
 * unrate-limited `GET /api/campsites` endpoint could otherwise be sent an
 * absurd range (e.g. `startDate=2026-01-01&endDate=9999-12-31`) and hang the
 * event loop / OOM the process on a single request. 366 nights covers any
 * real camper search (a full year, inclusive of a leap year) with margin;
 * beyond that the range fails open (no badge computed) rather than iterate.
 */
export const MAX_STATUS_RANGE_NIGHTS = 366;

/**
 * CAM-344 — batched per-camp availability status for a page of dated catalog
 * search results (BR-1/BR-2/BR-3/BR-5, ADR-009 no-forked-data-path).
 *
 * Derives from the EXACT SAME predicates as getCampSiteDailyAvailability /
 * getBlockedDatesForRange / getActiveHoldsForRange: Booking `CONFIRMED`/
 * `PENDING` overlap, whole-camp BlockedDate (`spotId` null, `deletedAt` null)
 * overlap, InternalHold `ACTIVE` + `expiresAt > now` overlap. Nights only —
 * `endDate` is the EXCLUSIVE checkout day; `lastNight = endDate - 1 day` is
 * used as the upper query bound for all three predicates, mirroring exactly
 * how getRemainingCapacity calls getCampSiteDailyAvailability with an
 * already-adjusted exclusive bound (same night-exclusive shape as the
 * booking write path).
 *
 * Batched shape: 5 grouped queries total for the WHOLE page, run in
 * parallel — one CampSite.useSpotView/maxGuestsPerDay side-select over the
 * page ids (capacity is intentionally NOT added to campCardSelect: every
 * date-less consumer of CampSiteCardData — wishlist, similar-camps — would
 * otherwise over-fetch a field it never renders, the exact anti-pattern
 * lib/read-models/camp-card.ts already documents) plus the 3 predicate
 * queries (Booking / BlockedDate / InternalHold) plus ONE more — CAM-355
 * BR-4c: a grouped, non-deleted Spot sum over the SAME page ids, feeding the
 * mode-aware effective-capacity map below (lib/spot-aggregation.ts
 * sumSpotCapacity — the SAME summing formula calculateSpotCapacity uses,
 * ADR-009 no-forked-data-path). Each query is
 * `WHERE campSiteId IN [pageIds]`. Classification runs in memory afterwards.
 * NEVER calls calculateSpotCapacity/getCampSiteDailyAvailability/
 * getRemainingCapacity per camp (BR-5 — O(1) queries per page, not O(N)).
 *
 * Returns a map of campId → status. A camp with ZERO unavailable nights is
 * OMITTED from the map entirely (fully available = no badge, BR-3).
 *
 * DoS guard: a non-finite date (Invalid Date), an inverted/zero-night range,
 * or a span wider than MAX_STATUS_RANGE_NIGHTS returns {} immediately — no
 * query, no loop. This is checked BEFORE any Prisma call, so it protects both
 * attach points (CatalogResults.tsx SSR + app/api/campsites/route.ts cursor
 * GET) from a single shared choke point.
 *
 * Fail-open contract (AC-9/EC-8): this function does NOT catch its own
 * Prisma errors — callers (CatalogResults.tsx, app/api/campsites/route.ts)
 * must wrap the call in try/catch and treat a throw as "no status computed"
 * (empty map), never blocking/blanking/emptying the result list.
 */
export async function getAvailabilityStatusForCamps(
  campIds: string[],
  startDate: Date,
  endDate: Date,
  requestedGuests: number = 1
): Promise<Record<string, CampAvailabilityStatus>> {
  if (campIds.length === 0) return {};

  // Reject non-finite dates (Invalid Date, e.g. from an unparseable query
  // string) BEFORE any arithmetic/query — an Invalid Date compares as
  // neither < nor >= anything, so the lastNight/startDate check below would
  // silently pass a NaN-backed date straight into 4 Prisma calls that throw.
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return {};
  }

  // Nights only: exclude the checkout day (BR-1, EC-6). A same-day/inverted
  // range has no night to classify — nothing to compute, no badge.
  const lastNight = new Date(endDate);
  lastNight.setDate(lastNight.getDate() - 1);
  if (lastNight < startDate) return {};

  // DoS guard: cap the per-night in-memory loop width (see
  // MAX_STATUS_RANGE_NIGHTS doc comment above). Computed from whole days —
  // safe here since startDate/lastNight are always UTC midnight Dates.
  const nightCount =
    Math.round((lastNight.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (nightCount > MAX_STATUS_RANGE_NIGHTS) return {};

  // BR-2: requestedGuests defaults to 1 when absent/invalid.
  const guests = Number.isFinite(requestedGuests) && requestedGuests > 0 ? requestedGuests : 1;

  const [campSites, bookings, blockedRanges, holds, spotRows] = await Promise.all([
    prisma.campSite.findMany({
      where: { id: { in: campIds } },
      select: { id: true, useSpotView: true, maxGuestsPerDay: true },
    }),
    prisma.booking.findMany({
      where: {
        campSiteId: { in: campIds },
        status: { in: ['CONFIRMED', 'PENDING'] },
        AND: [
          { checkInDate: { lte: lastNight } },
          { checkOutDate: { gte: startDate } },
        ],
      },
      select: { campSiteId: true, checkInDate: true, checkOutDate: true, guests: true },
    }),
    prisma.blockedDate.findMany({
      where: {
        campSiteId: { in: campIds },
        spotId: null,
        deletedAt: null,
        AND: [
          { startDate: { lte: lastNight } },
          { endDate: { gte: startDate } },
        ],
      },
      select: { campSiteId: true, startDate: true, endDate: true },
    }),
    prisma.internalHold.findMany({
      where: {
        campSiteId: { in: campIds },
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        AND: [
          { startDate: { lte: lastNight } },
          { endDate: { gte: startDate } },
        ],
      },
      select: { campSiteId: true, startDate: true, endDate: true, guests: true },
    }),
    // CAM-355 BR-4c/BR-5: ONE grouped Spot query for the whole page (never
    // per-camp) — `deletedAt: null` (BR-3 soft-delete filter) is applied HERE
    // at the query boundary, exactly like calculateSpotCapacity's own query.
    prisma.spot.findMany({
      where: { campSiteId: { in: campIds }, deletedAt: null },
      select: { campSiteId: true, maxCampers: true, maxTents: true },
    }),
  ]);

  // CAM-355 BR-1/BR-4/BR-6 (T-B read-through, ADR-009): group the batched spot
  // rows by camp, then feed each per-spot camp's rows through the SAME
  // sumSpotCapacity formula calculateSpotCapacity uses — never a parallel sum.
  // A per-spot camp with zero rows here derives 0 (closed, BR-6), never the
  // stale maxGuestsPerDay column. WHOLE-CAMP camps are unaffected (BR-8): the
  // stored column passes straight through.
  const spotsByCamp = new Map<string, { maxCampers: number | null; maxTents: number | null }[]>();
  for (const spot of spotRows) {
    const existing = spotsByCamp.get(spot.campSiteId);
    if (existing) existing.push(spot);
    else spotsByCamp.set(spot.campSiteId, [spot]);
  }

  const capacityById = new Map<string, number | null>(
    campSites.map((c) => [
      c.id,
      c.useSpotView ? sumSpotCapacity(spotsByCamp.get(c.id) ?? []).maxGuestsPerDay : c.maxGuestsPerDay,
    ])
  );

  interface NightState {
    bookedGuests: number;
    heldGuests: number;
    blockedByHost: boolean;
  }

  const initNights = (): Record<string, NightState> => {
    const nights: Record<string, NightState> = {};
    const cur = new Date(startDate);
    while (cur <= lastNight) {
      nights[cur.toISOString().split('T')[0]] = { bookedGuests: 0, heldGuests: 0, blockedByHost: false };
      cur.setDate(cur.getDate() + 1);
    }
    return nights;
  };

  const nightsByCamp = new Map<string, Record<string, NightState>>();
  for (const id of campIds) {
    nightsByCamp.set(id, initNights());
  }

  // Booking overlap — exclusive checkout, same per-night loop shape as
  // getCampSiteDailyAvailability's booking pass.
  for (const booking of bookings) {
    const nights = nightsByCamp.get(booking.campSiteId);
    if (!nights) continue;
    const cur = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    while (cur < checkOut) {
      const key = cur.toISOString().split('T')[0];
      if (nights[key]) nights[key].bookedGuests += booking.guests;
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Whole-camp BlockedDate — inclusive range, same per-night loop shape as
  // getCampSiteDailyAvailability's blockedDate pass.
  for (const block of blockedRanges) {
    const nights = nightsByCamp.get(block.campSiteId);
    if (!nights) continue;
    const cur = new Date(block.startDate);
    const blockEnd = new Date(block.endDate);
    while (cur <= blockEnd && cur <= lastNight) {
      const key = cur.toISOString().split('T')[0];
      if (nights[key]) nights[key].blockedByHost = true;
      cur.setDate(cur.getDate() + 1);
    }
  }

  // ACTIVE non-expired InternalHold — exclusive checkout (ADR-012 §4, lazy
  // expiry already applied by the query's `expiresAt: { gt: now }` filter).
  for (const hold of holds) {
    const nights = nightsByCamp.get(hold.campSiteId);
    if (!nights) continue;
    // CAM-401 BR-2 sweep finding (same gap as getCampSiteDailyAvailability's
    // hold loop above): InternalHold has no max-span cap at write time —
    // clamp to the already night-count-guarded [startDate, lastNight] window
    // (mirrors the whole-camp BlockedDate loop's own `&& cur <= lastNight`
    // bound just above). Output unchanged; only bounds the iteration count.
    const cur = new Date(hold.startDate < startDate ? startDate : hold.startDate);
    const holdEnd = new Date(hold.endDate);
    while (cur < holdEnd && cur <= lastNight) {
      const key = cur.toISOString().split('T')[0];
      if (nights[key]) nights[key].heldGuests += hold.guests;
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Classify per BR-2 (night unavailable when host-blocked OR numerically
  // full) / BR-3 (0 unavailable → no entry; some → PARTIALLY; all → FULLY).
  const result: Record<string, CampAvailabilityStatus> = {};
  for (const [campId, nights] of nightsByCamp.entries()) {
    const capacity = capacityById.get(campId) ?? null;
    const nightStates = Object.values(nights);
    let unavailableCount = 0;
    for (const night of nightStates) {
      const numericallyFull =
        capacity !== null && night.bookedGuests + night.heldGuests + guests > capacity;
      if (night.blockedByHost || numericallyFull) unavailableCount++;
    }
    if (unavailableCount === 0) continue; // fully available — omitted (no badge)
    result[campId] =
      unavailableCount === nightStates.length ? 'FULLY_UNAVAILABLE' : 'PARTIALLY_UNAVAILABLE';
  }

  return result;
}

/**
 * Transactional check for date availability.
 * Must be called inside a prisma.$transaction callback with the tx client.
 * Reads execute within the serializable transaction boundary so Postgres can
 * detect conflicting concurrent writes and issue a serialization failure (P2034).
 *
 * CAM-345: the non-transactional `checkDateAvailability` this was originally a
 * variant of has been removed (dead, holds-blind — 0 production callers,
 * superseded by `getRemainingCapacity` for GET-availability reads and by this
 * function for the booking write path). This function is now the sole
 * "check a single date" entry point; `getCampSiteDailyAvailability` is
 * unaffected either way.
 *
 * CAM-302 (ADR-012 §4, BR-2/BR-3): also reads ACTIVE, non-expired InternalHold
 * rows overlapping this date INSIDE the same transaction boundary — this is the
 * SAME seam the booking write path already loops per night
 * (app/api/bookings/route.ts `withBookingTransaction`), so a guest booking over
 * a hold that fills capacity auto-rejects with NO change to the booking route
 * (the story's KPI seam, AC-4), and a hold create reusing this same function
 * gets the identical serializable double-hold-prevention lock ADR-006 already
 * gives Booking (AC-5, EC-1, EC-5) — no parallel capacity math anywhere.
 *
 * CAM-355 BR-1/BR-2/BR-4/BR-6 (T-B read-through): PER-SPOT camps
 * (`useSpotView = true`) now derive a LIVE effective capacity (the non-
 * deleted-spot sum, via getEffectiveCapacity/getSpotCapacityOnceForTx above —
 * hoisted ONCE per booking/hold transaction, not once per night, BR-4 perf)
 * instead of the stale `maxGuestsPerDay`/`maxTentsPerDay` column. A zero
 * derived total is a REAL cap (BR-6 — closed for booking).
 *
 * CAM-400 BR-1/BR-2: the WHOLE-CAMP branch below previously kept a `&&`
 * truthy gate "intentionally IDENTICAL to pre-CAM-355 behavior" (a 0/null
 * column both read as "unbounded") — the one branch of this seam that
 * disagreed with getRemainingCapacity + getAvailabilityStatusForCamps
 * (already `!== null`), letting a booking POST succeed 201 against a camp
 * whose calendar/badge both said เต็มแล้ว. The invariant is now uniform
 * across the whole seam: `null` = unlimited, `0` = closed/full, everywhere.
 * A spot-sum read failure (e.g. a DB error inside calculateSpotCapacity) is
 * NOT caught here — it propagates up through the serializable transaction,
 * which rolls back, so the booking/hold write path fails CLOSED (EC-5) —
 * never a swallowed error that would leave enforcement unbounded.
 */
export async function checkDateAvailabilityInTx(
  tx: Prisma.TransactionClient,
  campSiteId: string,
  date: Date,
  requestedGuests: number,
  requestedTents?: number
): Promise<{ available: boolean; reason?: string }> {
  const campSite = await tx.campSite.findUnique({
    where: { id: campSiteId },
    select: { useSpotView: true, maxGuestsPerDay: true, maxTentsPerDay: true },
  });

  if (!campSite) {
    return { available: false, reason: 'Camp site not found' };
  }

  const dateKey = date.toISOString().split('T')[0];

  // Fetch all active bookings that overlap with the target date (inside tx).
  const bookings = await tx.booking.findMany({
    where: {
      campSiteId,
      status: { in: ['CONFIRMED', 'PENDING'] },
      AND: [
        { checkInDate: { lte: date } },
        { checkOutDate: { gt: date } },
      ],
    },
    select: { checkInDate: true, checkOutDate: true, guests: true },
  });

  // Sum guests/tents booked for this exact date (mirrors getCampSiteDailyAvailability logic).
  let bookedGuests = 0;
  let bookedTents = 0;
  for (const b of bookings) {
    const d = new Date(b.checkInDate);
    while (d < new Date(b.checkOutDate)) {
      if (d.toISOString().split('T')[0] === dateKey) {
        bookedGuests += b.guests;
        bookedTents += Math.ceil(b.guests / 2);
      }
      d.setDate(d.getDate() + 1);
    }
  }

  // CAM-302: ACTIVE, non-expired holds overlapping this exact date, read inside
  // the SAME transaction boundary as the bookings above (lazy expiry, BR-2).
  const holds = await tx.internalHold.findMany({
    where: {
      campSiteId,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
      AND: [
        { startDate: { lte: date } },
        { endDate: { gt: date } },
      ],
    },
    select: { guests: true },
  });
  const heldGuests = holds.reduce((sum, h) => sum + h.guests, 0);

  // CAM-355: PER-SPOT branch — always a defined effective capacity (BR-6: 0
  // is a real cap, never "unbounded"). Hoisted once per tx (BR-4 perf).
  if (campSite.useSpotView) {
    const effective = await getSpotCapacityOnceForTx(tx, {
      id: campSiteId,
      useSpotView: true,
      maxGuestsPerDay: campSite.maxGuestsPerDay,
      maxTentsPerDay: campSite.maxTentsPerDay,
    });
    // `?? 0` is a defensive, fail-closed guard only — calculateSpotCapacity
    // always returns a real number (0 at minimum), never null, for PER-SPOT.
    const effectiveGuests = effective.maxGuestsPerDay ?? 0;
    const effectiveTents = effective.maxTentsPerDay ?? 0;

    if (bookedGuests + heldGuests + requestedGuests > effectiveGuests) {
      return {
        available: false,
        reason: `Exceeds maximum guests per day (${effectiveGuests})`,
      };
    }

    if (requestedTents) {
      const estimatedTents = Math.ceil(requestedGuests / 2);
      if (bookedTents + estimatedTents > effectiveTents) {
        return {
          available: false,
          reason: `Exceeds maximum tents per day (${effectiveTents})`,
        };
      }
    }

    return { available: true };
  }

  // WHOLE-CAMP — CAM-400 BR-1/BR-2: the invariant is null = unlimited, 0 =
  // closed/full, in every layer. This branch previously kept a "byte-
  // identical to pre-CAM-355" truthy gate (BR-8) that read a 0 column as
  // "unbounded" — the one layer in the seam that disagreed with
  // getRemainingCapacity + getAvailabilityStatusForCamps (both already
  // `!== null`), letting a POST succeed against a camp the UI called
  // เต็มแล้ว. BR-8's "unchanged by construction" scope is retired for this
  // one gate; the null-check below now matches the PER-SPOT branch above.
  if (
    campSite.maxGuestsPerDay !== null &&
    bookedGuests + heldGuests + requestedGuests > campSite.maxGuestsPerDay
  ) {
    return {
      available: false,
      reason: `Exceeds maximum guests per day (${campSite.maxGuestsPerDay})`,
    };
  }

  if (campSite.maxTentsPerDay !== null && requestedTents) {
    const estimatedTents = Math.ceil(requestedGuests / 2);
    if (bookedTents + estimatedTents > campSite.maxTentsPerDay) {
      return {
        available: false,
        reason: `Exceeds maximum tents per day (${campSite.maxTentsPerDay})`,
      };
    }
  }

  return { available: true };
}
