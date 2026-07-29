/**
 * cam-668-spot-belongs-to-camp.test.ts — CAM-668 (CAM-665 security review)
 *
 * Finding: POST /api/bookings never checked that `data.spotId` belongs to
 * `data.campSiteId`, nor that the pitch is not soft-deleted. Checks 1 and 3
 * both scope their queries by campSiteId+spotId, so a FOREIGN spotId simply
 * matches nothing and sails through; `campSite.spots.find()` then returns
 * undefined, pricing silently falls back to camp-level, and booking.create
 * still WRITES the foreign spotId — a cross-tenant read via
 * GET /api/bookings (`spot: { name, zone }`).
 *
 * AC → test matrix
 * ─────────────────────────────────────────────────────────────────────────
 * AC-1  a spotId belonging to ANOTHER camp -> 400, no Booking row created.
 * AC-2  an unknown spotId gets the BYTE-IDENTICAL rejection as AC-1 — no
 *       existence oracle for another camp's spots.
 * EC-1  a soft-deleted pitch ON THIS CAMP -> the SAME 400 (never a special
 *       case; `campSite.spots` is fetched `deletedAt: null`).
 * AC-3  a valid, live pitch on the camp -> 201, Booking.spotId written,
 *       priced from THAT pitch (not the camp — proven with the REAL
 *       lib/booking-pricing, not a mock, so a wrong fallback would be
 *       visible in the total).
 * AC-4  no spotId -> UNCHANGED behaviour, hard-coded golden totalPrice.
 * AC-5  the check runs INSIDE the Serializable transaction (ADR-006) — proven
 *       both by source inspection and by this file's Prisma mock exposing
 *       ONLY `$transaction` (a stray `prisma.campSite`/`prisma.spot` read
 *       would throw, which no test here hits).
 *
 * CONCURRENCY BOUNDARY (honesty note, mirrors __tests__/cam-57-atomic-lock.
 * test.ts's own documented limit): a true concurrent Postgres serialization
 * conflict cannot be simulated against a mocked Prisma client. What this file
 * proves instead: the ownership decision is made ONLY from `tx`-scoped data
 * read inside the same transaction the rest of the booking gate uses.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports. Mirrors
// __tests__/cam-652-charge-the-chosen-unit.test.ts's convention: `prisma` is
// mocked down to ONLY `$transaction`. booking-pricing is DELIBERATELY NOT
// mocked — the real unit-price resolution is what proves AC-3 (priced from
// the pitch, not the camp).
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn() },
}));
vi.mock('@/lib/auth-utils', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/serialize', () => ({ serializeDecimals: vi.fn((x) => x) }));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

const { POST } = await import('@/app/api/bookings/route');

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const CAMP_ID = 'dddddddd-0000-4000-8000-000000000668';
const USER_ID = 'ffffffff-0000-4000-8000-000000000668';
const SPOT_ON_CAMP = 'dddddddd-1111-4000-8000-000000000668'; // live, belongs to CAMP_ID
const SPOT_ON_OTHER_CAMP = 'eeeeeeee-1111-4000-8000-000000000668'; // a real spot, but on a different camp
const UNKNOWN_SPOT = 'aaaaaaaa-9999-4000-8000-000000000668'; // does not exist anywhere
const SOFT_DELETED_SPOT = 'dddddddd-2222-4000-8000-000000000668'; // on CAMP_ID, but deletedAt is set

const CHECK_IN = '2027-02-01';
const CHECK_OUT = '2027-02-03'; // 2 nights

function makeSession() {
  return { user: { id: USER_ID, email: 'camper@campvibe.com', name: 'Camper' } };
}

function makePostRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify({
      campSiteId: CAMP_ID,
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      guests: 2,
      ...body,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * `liveSpots` is exactly what `tx.campSite.findUnique`'s `spots` relation
 * resolves to — the real route scopes that query `where: { deletedAt: null }`
 * (CAM-668), so a foreign spot, an unknown id, and a soft-deleted spot on
 * THIS camp are all represented the SAME way here: simply absent from this
 * array. Nothing else in the booking gate blocks (no overlap/capacity/host
 * block) so any rejection observed is attributable to Check 0 alone.
 */
function makeTx(liveSpots: { id: string; name: string; pricePerNight: number; priceUnit?: string }[]) {
  const create = vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'booking-668-1',
    ...data,
  }));
  const tx = {
    booking: {
      findFirst: vi.fn().mockResolvedValue(null), // no spot overlap
      findMany: vi.fn().mockResolvedValue([]), // no capacity issue
      create,
    },
    campSite: {
      findUnique: vi.fn().mockResolvedValue({
        id: CAMP_ID,
        nameTh: 'แคมป์ทดสอบ CAM-668',
        nameEn: 'CAM-668 Test Camp',
        priceLow: 999, // camp-level price — must NEVER be what a valid-spot booking charges
        priceCurrency: 'THB',
        priceUnit: 'PER_SITE',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        extraFeeAmount: null,
        maxGuestsPerDay: null,
        maxTentsPerDay: null,
        spots: liveSpots,
        location: { countryRel: { vatRate: 0, timezone: 'Asia/Bangkok' } },
      }),
    },
    blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
    internalHold: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { tx, create };
}

function wireTransaction(tx: unknown) {
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession() });
});

// ===========================================================================
// AC-1/AC-2/EC-1 — rejection + indistinguishability
// ===========================================================================

describe('POST /api/bookings — a spotId must belong to campSiteId and be live (CAM-668)', () => {
  it('[integration][error/validation][ac-1] a spotId belonging to ANOTHER camp is rejected 400, no Booking row created', async () => {
    const { tx, create } = makeTx([]); // SPOT_ON_OTHER_CAMP never appears in THIS camp's live spots
    wireTransaction(tx);

    const res = await POST(makePostRequest({ spotId: SPOT_ON_OTHER_CAMP }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid spotId parameter');
    expect(create).not.toHaveBeenCalled();
  });

  it('[integration][error/validation][ac-2] an unknown spotId gets the BYTE-IDENTICAL rejection as the foreign-camp case (no existence oracle)', async () => {
    const foreign = makeTx([]);
    wireTransaction(foreign.tx);
    const foreignRes = await POST(makePostRequest({ spotId: SPOT_ON_OTHER_CAMP }));
    const foreignBody = await foreignRes.json();

    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession() });
    const unknown = makeTx([]);
    wireTransaction(unknown.tx);
    const unknownRes = await POST(makePostRequest({ spotId: UNKNOWN_SPOT }));
    const unknownBody = await unknownRes.json();

    expect(foreignRes.status).toBe(400);
    expect(unknownRes.status).toBe(foreignRes.status);
    expect(unknownBody).toEqual(foreignBody);
  });

  it('[integration][error/validation][ec-1] a soft-deleted pitch ON THIS CAMP is rejected — same 400, never a special case', async () => {
    // CAM-668: campSite.spots is fetched `where: { deletedAt: null }` — a
    // soft-deleted spot on CAMP_ID is represented EXACTLY like a foreign one:
    // simply absent from liveSpots.
    const { tx, create } = makeTx([]);
    wireTransaction(tx);

    const res = await POST(makePostRequest({ spotId: SOFT_DELETED_SPOT }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid spotId parameter');
    expect(create).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// AC-3 — a valid pitch on the camp succeeds and is priced from that pitch
// ===========================================================================

describe('POST /api/bookings — a valid, live spot on the camp succeeds (CAM-668 regression)', () => {
  it('[integration][normal][ac-3] books successfully, writes Booking.spotId, and prices from the SPOT (not the camp)', async () => {
    const { tx, create } = makeTx([{ id: SPOT_ON_CAMP, name: 'A1 ริมน้ำ', pricePerNight: 500, priceUnit: 'PER_SITE' }]);
    wireTransaction(tx);

    const res = await POST(makePostRequest({ spotId: SPOT_ON_CAMP }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledOnce();
    const written = create.mock.calls[0][0].data;
    expect(written.spotId).toBe(SPOT_ON_CAMP);
    expect(written.snapshotSpotName).toBe('A1 ริมน้ำ');
    // 500/night (the SPOT's price) x 2 nights = 1000 — NOT 999 x 2 = 1998 (the
    // camp's priceLow, which would win only if bookedSpot were undefined —
    // the exact CAM-668 bug: pricing silently fell back to camp-level).
    expect(body.totalPrice).toBe(1000);
    expect(written.totalPrice).toBe(1000);
  });
});

// ===========================================================================
// AC-4 — no spotId: UNCHANGED behaviour, hard-coded golden numbers
// ===========================================================================

describe('POST /api/bookings — no spotId: behaviour is byte-identical to before CAM-668 (golden numbers)', () => {
  it('[regression][golden][ac-4] a camp-level booking (no spotId) is priced from the camp, snapshotSpotName is null, spotId is undefined', async () => {
    const { tx, create } = makeTx([]); // irrelevant when no spotId is sent
    wireTransaction(tx);

    const res = await POST(makePostRequest({})); // no spotId key at all
    const body = await res.json();

    expect(res.status).toBe(201);
    // Golden: camp priceLow=999 x 2 nights = 1998 (hard-coded, not recomputed
    // from `999 * 2` at the assertion site).
    expect(body.totalPrice).toBe(1998);
    const written = create.mock.calls[0][0].data;
    expect(written.spotId).toBeUndefined();
    expect(written.snapshotSpotName).toBeNull();
    expect(written.snapshotQuantity).toBe(1);
    expect(written.snapshotPricingUnit).toBe('PER_SITE');
  });
});

// ===========================================================================
// AC-5 — the check runs INSIDE the transaction, never outside it
// ===========================================================================

describe('CAM-668 — the ownership check runs inside the Serializable transaction (ADR-006)', () => {
  it('[unit][prove-it] source inspection: the rejection reads campSite.spots fetched via `tx`, never a bare prisma.campSite/prisma.spot call', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'app/api/bookings/route.ts'), 'utf-8');

    expect(src).toContain("type: 'invalid_spot'");
    expect(src).toContain('const campSite = await tx.campSite.findUnique(');
    // A read outside `tx` would be a TOCTOU window — neither call exists here.
    expect(src).not.toMatch(/prisma\.spot\.findFirst/);
    expect(src).not.toMatch(/prisma\.campSite\.findUnique/);
  });

  it('[integration][concurrency-flavoured] the decision is made ONLY from tx-scoped data — this file mocks `prisma` down to `$transaction` alone, so a stray prisma.campSite/prisma.spot read would throw instead of asserting a status', async () => {
    // Honesty note: a real concurrent Postgres serialization conflict cannot
    // be simulated against a mocked Prisma client (same boundary
    // __tests__/cam-57-atomic-lock.test.ts documents for this exact seam).
    // What IS provable: every test above — including this happy path —
    // completes successfully while `prisma` exposes nothing but
    // `$transaction`; if Check 0 ever read from anywhere other than the `tx`
    // handed to the transaction callback, this would throw
    // "Cannot read properties of undefined" instead of returning 201.
    const { tx } = makeTx([{ id: SPOT_ON_CAMP, name: 'A1', pricePerNight: 500 }]);
    wireTransaction(tx);

    const res = await POST(makePostRequest({ spotId: SPOT_ON_CAMP }));

    expect(res.status).toBe(201);
  });
});
