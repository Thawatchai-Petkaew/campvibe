/**
 * CAM-418 (ADR-013 §D5, S5a) — independent adversarial QA verify (fresh-context)
 * of the two `authed`-tier personal-booking tools (getMyBookings /
 * getMyBookingDetail). The shipped suite
 * (__tests__/cam-418-my-bookings-tools.test.ts) already covers: scoped-query
 * shape assertions (`toEqual({ userId: USER_ID })`), the tool's own
 * defense-in-depth guard when execute() is called DIRECTLY with ctx={}, the
 * zod-boundary rejection of a non-uuid bookingId (schema.safeParse in
 * isolation), and the whole-registry no-userId-in-schema invariant. This file
 * closes the real gaps a fresh-context adversarial pass found — gaps in HOW
 * those things were proven, not re-tests of the same ground:
 *
 *  (a) REAL cross-user isolation, not an argument-shape assertion — a
 *      FAITHFUL fake `prisma.booking.findMany` (seeded with TWO real users'
 *      bookings, applies `where.userId` exactly the way real Prisma does: an
 *      omitted/undefined key means NO filter — the well-known Prisma
 *      "undefined where key = unscoped" gotcha) exercised through the REAL
 *      `dispatchTool` BY NAME (the actual wire path a model tool_call takes),
 *      never by calling `executeGetMyBookings` directly. Proves userA's
 *      result NEVER contains userB's row and vice versa — this would ALSO
 *      catch a where-clause regression the shipped suite's
 *      `toEqual({userId:USER_ID})` argument check cannot: `ctx.userId`
 *      genuinely reaching Prisma as `undefined` (BR-4's early-return guard
 *      exists today; this test proves the DB-boundary consequence
 *      independent of that guard, so a future refactor that weakens the
 *      guard still gets caught here).
 *  (b) getMyBookingDetail — the RISKY id-arg tool — the SAME real-fixture
 *      treatment, but critically with `lib/bookings.ts`'s `getOwnedBooking`
 *      left UNMOCKED (only `prisma.booking.findFirst` is faked at the DB
 *      boundary). The shipped suite mocks `getOwnedBooking` itself, which
 *      proves the tool CALLS it with the right arguments but never exercises
 *      `getOwnedBooking`'s OWN `where:{id,userId}` scoping logic. This test
 *      runs that real code path: userA's ctx + userB's real bookingId ->
 *      not_found; userB's ctx + userB's own bookingId -> ok:true with the
 *      real detail; a bookingId that exists for NEITHER user -> the SAME
 *      not_found (no existence leak). Through `dispatchTool` by name.
 *  (c) malformed bookingId through `dispatchTool` (not the schema tested in
 *      isolation) -> invalid_args, `findFirst` never invoked — proves the
 *      REGISTRY's own zod gate blocks it before any query runs, not just
 *      that the schema itself would reject the shape.
 *  (d) ctx without userId through `dispatchTool` for EITHER real tool ->
 *      unauthorized_tool at the REGISTRY tier gate — proves the PRIMARY
 *      defense (BR-4) fires before either tool's own execute() (and
 *      therefore before its secondary defense-in-depth check) ever runs; the
 *      shipped suite only exercises the secondary guard, by calling
 *      execute() directly.
 *  (e) Decimal never reaches the model-facing JSON as anything but a plain
 *      number — the full `dispatchTool` result round-tripped through
 *      `JSON.stringify`/`JSON.parse`, the EXACT serialization
 *      lib/ai/openrouter-client.ts performs on every real tool result
 *      (`content: JSON.stringify(result)`) — for BOTH tools.
 *  (f) EC-1 zero-bookings through `dispatchTool` with a real fixture userId
 *      that owns nothing.
 *  (g) AC-4/BR-3 (no userId in schema) reconfirmed at THIS file's own real,
 *      fully-populated registry import (light, non-duplicative check).
 *
 * Prove-It (ownership scope, done manually before finalizing this file —
 * never committed, confirmed via `git diff --stat` clean after each revert):
 * `lib/bookings.ts`'s `getOwnedBooking` where clause (`where: { id, userId }`)
 * was temporarily changed to `where: { id }` (userId dropped) -> exactly 1
 * test went RED, (b)'s "userA requesting booking B -> not_found" case,
 * failing with userA's ctx receiving userB's real booking-B detail instead
 * of `not_found`. Reverting the one-line change restored all-GREEN (13/13).
 * Same drill on `lib/ai/tools/my-bookings.ts` — `getMyBookings`'s
 * `where: { userId: ctx.userId }` changed to `where: {}`: exactly 4 tests
 * went RED — both (a) cross-user cases (userA and userB each received BOTH
 * users' bookings), (f)'s EC-1 empty-fixture case (USER_EMPTY received both
 * other users' bookings instead of []), and (e)'s getMyBookings Decimal
 * round-trip case (USER_A's first result row became USER_B's, so the
 * asserted amount 1250.5 didn't match the received 900). Reverting restored
 * all-GREEN (13/13). Neither production file carries any trace of either
 * edit — QA does not fix/ship production code (qa.md §5); this comment is
 * the real, observed record (not a claim).
 *
 * All Prisma access is mocked at the `@/lib/prisma` boundary only (the real
 * `getOwnedBooking`, both tools' real `execute()`, and the real
 * `dispatchTool`/registry all run unmocked) — zero real DB, zero paid model
 * calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { ZodObject } from 'zod';

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

// Real registry + real dispatch + the real tools (side-effect import registers
// getMyBookings/getMyBookingDetail, exactly as app/api/ai/chat's route does).
const { dispatchTool, getRegisteredTools } = await import('@/lib/ai/tool-registry');
await import('@/lib/ai/tools/index');

const USER_A = 'user-aaaa-0001-0000-000000000001';
const USER_B = 'user-bbbb-0002-0000-000000000002';
const USER_EMPTY = 'user-cccc-0003-0000-000000000003'; // fixture: a real userId that owns nothing (f)

const BOOKING_A = '123e4567-e89b-12d3-a456-426614174000';
const BOOKING_B = '223e4567-e89b-12d3-a456-426614174001';
const NEVER_BOOKED_ID = '999e4567-e89b-12d3-a456-426614174999'; // exists for NO one

interface FakeRow {
  id: string;
  userId: string;
  status: string;
  checkInDate: Date;
  checkOutDate: Date;
  snapshotCampName: string | null;
  totalPrice: InstanceType<typeof Prisma.Decimal>;
  guests: number;
  currency: string;
  createdAt: Date;
  campSite: { nameTh: string; nameEn: string };
  spot: { name: string; zone: string };
}

/** The "database" — TWO real users, each owning exactly one real booking. */
const FAKE_DB: FakeRow[] = [
  {
    id: BOOKING_A,
    userId: USER_A,
    status: 'CONFIRMED',
    checkInDate: new Date('2026-08-01'),
    checkOutDate: new Date('2026-08-03'),
    snapshotCampName: 'สวนสน แคมป์ปิ้ง',
    totalPrice: new Prisma.Decimal('1250.50'),
    guests: 2,
    currency: 'THB',
    createdAt: new Date('2026-07-10'),
    campSite: { nameTh: 'สวนสน', nameEn: 'Pine Camp' },
    spot: { name: 'A1', zone: 'A' },
  },
  {
    id: BOOKING_B,
    userId: USER_B,
    status: 'PENDING',
    checkInDate: new Date('2026-09-01'),
    checkOutDate: new Date('2026-09-02'),
    snapshotCampName: 'ริมธาร แคมป์',
    totalPrice: new Prisma.Decimal('900'),
    guests: 1,
    currency: 'THB',
    createdAt: new Date('2026-07-11'),
    campSite: { nameTh: 'ริมธาร', nameEn: 'Riverside' },
    spot: { name: 'B2', zone: 'B' },
  },
];

/**
 * Faithful to real Prisma semantics: an omitted/`undefined` where key applies
 * NO filter on that field (the exact behavior that makes a dropped `userId`
 * key a silent unscoped query in production Prisma, not merely a test-double
 * quirk) — this is what makes the Prove-It drill above land as a real RED.
 */
function findManyImpl({
  where,
  orderBy,
  take,
}: {
  where?: { userId?: string };
  orderBy?: { createdAt?: 'asc' | 'desc' };
  take?: number;
}) {
  let rows = FAKE_DB.filter((r) => where?.userId === undefined || r.userId === where.userId);
  const dir = orderBy?.createdAt === 'asc' ? 1 : -1;
  rows = [...rows].sort((a, b) => dir * (a.createdAt.getTime() - b.createdAt.getTime()));
  if (typeof take === 'number') rows = rows.slice(0, take);
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    checkInDate: r.checkInDate,
    checkOutDate: r.checkOutDate,
    snapshotCampName: r.snapshotCampName,
    totalPrice: r.totalPrice,
  }));
}

/** Same faithfulness rule as findManyImpl — see comment above. */
function findFirstImpl({ where }: { where?: { id?: string; userId?: string } }) {
  const row = FAKE_DB.find(
    (r) => (where?.id === undefined || r.id === where.id) && (where?.userId === undefined || r.userId === where.userId)
  );
  if (!row) return null;
  // Mirrors getOwnedBooking's real `select` — userId is never part of the returned shape.
  return {
    id: row.id,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    guests: row.guests,
    totalPrice: row.totalPrice,
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt,
    campSite: row.campSite,
    spot: row.spot,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockImplementation(findManyImpl);
  mockFindFirst.mockImplementation(findFirstImpl);
});

// ---------------------------------------------------------------------------
// (a) getMyBookings — real two-user fixture, dispatched by name
// ---------------------------------------------------------------------------

describe('(a) getMyBookings — real two-user fixture, faithful fake DB, dispatched by name (AC-1)', () => {
  it('[security] userA sees ONLY booking A — booking B never appears', async () => {
    const result = await dispatchTool('getMyBookings', {}, { userId: USER_A });

    expect(result.ok).toBe(true);
    const data = (result as { ok: true; data: unknown }).data as { bookings: Array<{ id: string }> };
    expect(data.bookings.map((b) => b.id)).toEqual([BOOKING_A]);
    expect(data.bookings.map((b) => b.id)).not.toContain(BOOKING_B);
  });

  it('[security] userB sees ONLY booking B — booking A never appears', async () => {
    const result = await dispatchTool('getMyBookings', {}, { userId: USER_B });

    expect(result.ok).toBe(true);
    const data = (result as { ok: true; data: unknown }).data as { bookings: Array<{ id: string }> };
    expect(data.bookings.map((b) => b.id)).toEqual([BOOKING_B]);
    expect(data.bookings.map((b) => b.id)).not.toContain(BOOKING_A);
  });
});

describe('(f) EC-1 — a real fixture userId that owns zero bookings', () => {
  it('[null/empty] returns { bookings: [] } through dispatchTool, not an error', async () => {
    const result = await dispatchTool('getMyBookings', {}, { userId: USER_EMPTY });

    expect(result).toEqual({ ok: true, data: { bookings: [] } });
  });
});

// ---------------------------------------------------------------------------
// (b) getMyBookingDetail — the risky id-arg tool, getOwnedBooking UNMOCKED
// ---------------------------------------------------------------------------

describe('(b) getMyBookingDetail — real getOwnedBooking (unmocked) enforces ownership (AC-2/AC-3)', () => {
  it('[security] userA requesting booking B (owned by userB) -> not_found, never leaks booking B data', async () => {
    const result = await dispatchTool('getMyBookingDetail', { bookingId: BOOKING_B }, { userId: USER_A });

    expect(result).toEqual({ ok: true, data: { ok: false, code: 'not_found' } });
  });

  it('[normal] userB requesting their OWN booking B -> ok:true with the real owned detail', async () => {
    const result = await dispatchTool('getMyBookingDetail', { bookingId: BOOKING_B }, { userId: USER_B });

    expect(result.ok).toBe(true);
    const data = (result as { ok: true; data: unknown }).data as {
      ok: boolean;
      booking?: { id: string; status: string; campSite: { nameTh: string } };
    };
    expect(data.ok).toBe(true);
    expect(data.booking?.id).toBe(BOOKING_B);
    expect(data.booking?.status).toBe('PENDING');
    expect(data.booking?.campSite.nameTh).toBe('ริมธาร');
  });

  it('[error/validation] a bookingId that exists for NO one -> the SAME not_found (no existence leak, EC-3)', async () => {
    const result = await dispatchTool('getMyBookingDetail', { bookingId: NEVER_BOOKED_ID }, { userId: USER_A });

    expect(result).toEqual({ ok: true, data: { ok: false, code: 'not_found' } });
  });
});

describe('(c) malformed bookingId through the REAL registry zod gate (not the schema tested in isolation)', () => {
  it('[error/validation] a non-uuid bookingId -> invalid_args, findFirst never invoked', async () => {
    const result = await dispatchTool('getMyBookingDetail', { bookingId: 'not-a-uuid' }, { userId: USER_A });

    expect(result).toEqual({ ok: false, code: 'invalid_args', message: expect.any(String) });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// (d) ctx without userId — the REGISTRY tier gate, not the tool's own guard
// ---------------------------------------------------------------------------

describe("(d) ctx without userId — the REGISTRY tier gate refuses BEFORE either tool's own execute() runs (BR-4 primary defense)", () => {
  it('[security] getMyBookings: unauthorized_tool, findMany never invoked', async () => {
    const result = await dispatchTool('getMyBookings', {}, {});

    expect(result).toEqual({ ok: false, code: 'unauthorized_tool', message: expect.any(String) });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('[security] getMyBookingDetail: unauthorized_tool, findFirst never invoked (registry gate fires even before the zod parse)', async () => {
    const result = await dispatchTool('getMyBookingDetail', { bookingId: BOOKING_A }, {});

    expect(result).toEqual({ ok: false, code: 'unauthorized_tool', message: expect.any(String) });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('[security] the SAME refusal fires when no ctx argument is passed at all (default {})', async () => {
    const result = await dispatchTool('getMyBookings', {});

    expect(result).toEqual({ ok: false, code: 'unauthorized_tool', message: expect.any(String) });
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// (e) Decimal never reaches the model-facing JSON as anything but a number
// ---------------------------------------------------------------------------

describe('(e) Decimal never reaches the model-facing JSON as anything but a plain number (BR-5)', () => {
  it('[unit] getMyBookings totalAmount survives the real chat-loop JSON round-trip as a number', async () => {
    const result = await dispatchTool('getMyBookings', {}, { userId: USER_A });
    // The EXACT serialization lib/ai/openrouter-client.ts performs on every tool result.
    const wire = JSON.parse(JSON.stringify(result)) as { data: { bookings: Array<{ totalAmount: number }> } };

    expect(typeof wire.data.bookings[0].totalAmount).toBe('number');
    expect(wire.data.bookings[0].totalAmount).toBe(1250.5);
  });

  it('[unit] getMyBookingDetail totalPrice survives the same round-trip as a number, no Prisma.Decimal residue', async () => {
    const result = await dispatchTool('getMyBookingDetail', { bookingId: BOOKING_A }, { userId: USER_A });
    const wire = JSON.parse(JSON.stringify(result)) as { data: { booking: { totalPrice: number } } };

    expect(typeof wire.data.booking.totalPrice).toBe('number');
    expect(wire.data.booking.totalPrice).toBe(1250.5);
  });
});

// ---------------------------------------------------------------------------
// (g) AC-4/BR-3 reconfirmed at THIS file's own real, fully-populated registry
// ---------------------------------------------------------------------------

describe("(g) AC-4/BR-3 reconfirmed — both tools tier:'authed', neither exposes userId", () => {
  it('[security] getRegisteredTools("authed") contains both real tools, tier + schema clean', () => {
    const tools = getRegisteredTools('authed').filter(
      (t) => t.name === 'getMyBookings' || t.name === 'getMyBookingDetail'
    );

    expect(tools.map((t) => t.name).sort()).toEqual(['getMyBookingDetail', 'getMyBookings']);
    for (const tool of tools) {
      expect(tool.tier).toBe('authed');
      expect(JSON.stringify(tool.jsonSchema)).not.toContain('"userId"');
      if (tool.parameters instanceof ZodObject) {
        expect(Object.keys(tool.parameters.shape as Record<string, unknown>)).not.toContain('userId');
      }
    }
  });
});
