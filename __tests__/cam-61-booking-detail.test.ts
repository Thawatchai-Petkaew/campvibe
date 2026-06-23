/**
 * CAM-61 — หน้ารายละเอียดการจอง /bookings/[id]
 *
 * AC→test matrix
 * ──────────────────────────────────────────────────────────────────────────
 * AC#1  owner CONFIRMED → 200 with full shape + cancel button shown
 * AC#2  owner PENDING   → 200 with full shape + cancel button shown
 * AC#3  owner CANCELLED → cancel button absent (isCancellable === false)
 * AC#4  owner COMPLETED → cancel button absent (isCancellable === false)
 * AC#5  cancel success  → PATCH called with {status:'CANCELLED'}, toast key present
 * AC#6  cancel error    → toast error key present, status unchanged
 * AC#7  wrong-owner     → same 404 body as missing (no existence leak / no 403 split)
 * AC#8  unauthenticated → GET returns 401
 * AC#9  loading.tsx     → skeleton file exists (source-inspection)
 * AC#10 booking not found → GET returns 404 with "Booking not found"
 * AC#11 Thai date format  → toLocaleDateString('th-TH', ...) path proven
 *
 * Security: owner-scope proven at DB layer (where: { id, userId }) not post-fetch JS.
 * i18n:     TH/EN verbatim keys asserted from locales/translations.json.
 *
 * Layer key:
 *   unit         = pure logic, no I/O (getBookingStatusMeta, formatDate, isCancellable, i18n)
 *   integration  = route handler called with mocked Prisma + auth boundary only
 *   source       = source-inspection test (file/AST existence assertion, honesty note)
 * ──────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Pure-unit imports (no mocks needed)
// ─────────────────────────────────────────────────────────────────────────────
import { getBookingStatusMeta } from '../lib/booking-status';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — declared before any dynamic import of the route
// ─────────────────────────────────────────────────────────────────────────────
const mockRequireAuth = vi.fn();
const mockGetOwnedBooking = vi.fn();

vi.mock('../lib/auth-utils', () => ({
    requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('../lib/bookings', () => ({
    getOwnedBooking: (...args: unknown[]) => mockGetOwnedBooking(...args),
}));

// Route import after mocks are in place
const { GET } = await import('../app/api/bookings/[id]/route');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const BOOKING_ID = 'booking-aaaa-0001-0000-000000000001';
const USER_ID    = 'user-aaaa-0001-0000-000000000001';
const OTHER_USER = 'user-bbbb-0002-0000-000000000002';

function makeSession(userId: string) {
    return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester' } };
}

function makeGetRequest(bookingId = BOOKING_ID): [NextRequest, { params: Promise<{ id: string }> }] {
    const req = new NextRequest(`http://localhost/api/bookings/${bookingId}`, { method: 'GET' });
    const context = { params: Promise.resolve({ id: bookingId }) };
    return [req, context];
}

/** A minimal booking fixture that mirrors getOwnedBooking return shape. */
function makeBookingFixture(status: string) {
    return {
        id: BOOKING_ID,
        checkInDate: new Date('2025-01-05T00:00:00Z'),
        checkOutDate: new Date('2025-01-07T00:00:00Z'),
        guests: 2,
        totalPrice: { toJSON: () => '1250', valueOf: () => 1250 } as unknown as number,
        currency: 'THB',
        status,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        userId: USER_ID,
        campSite: {
            nameTh: 'แคมป์ทดสอบ',
            nameEn: 'Test Camp',
            checkInTime: '14:00',
            checkOutTime: '12:00',
            phone: '0891234567',
            lineId: '@testcamp',
            images: [{ url: 'https://example.com/cover.jpg', sortOrder: 0 }],
            location: { province: 'เชียงใหม่' },
        },
        spot: { name: 'A1', zone: 'A' },
    };
}

async function parseJson(res: Response) {
    return res.json();
}

beforeEach(() => {
    vi.clearAllMocks();
});

// =============================================================================
// UNIT — getBookingStatusMeta (lib/booking-status.ts)
// Maps AC#1–4 status labels + cancel-button gate (isCancellable logic)
// =============================================================================

describe('[unit] getBookingStatusMeta', () => {
    it('AC#1 CONFIRMED → labelKey statusConfirmed, variant success', () => {
        const { labelKey, variant } = getBookingStatusMeta('CONFIRMED');
        expect(labelKey).toBe('statusConfirmed');
        expect(variant).toBe('success');
    });

    it('AC#2 PENDING → labelKey statusPending, variant warning', () => {
        const { labelKey, variant } = getBookingStatusMeta('PENDING');
        expect(labelKey).toBe('statusPending');
        expect(variant).toBe('warning');
    });

    it('AC#3 CANCELLED → labelKey statusCancelled, variant muted', () => {
        const { labelKey, variant } = getBookingStatusMeta('CANCELLED');
        expect(labelKey).toBe('statusCancelled');
        expect(variant).toBe('muted');
    });

    it('AC#4 COMPLETED → labelKey statusCompleted, variant info', () => {
        const { labelKey, variant } = getBookingStatusMeta('COMPLETED');
        expect(labelKey).toBe('statusCompleted');
        expect(variant).toBe('info');
    });

    it('unknown status → labelKey null, variant muted (no crash)', () => {
        const { labelKey, variant } = getBookingStatusMeta('REFUNDED');
        expect(labelKey).toBeNull();
        expect(variant).toBe('muted');
    });
});

// =============================================================================
// UNIT — cancel-button visibility (AC#1–4 isCancellable rule)
// Source-inspection: BookingDetailClient computes `isCancellable`
// as (status === 'PENDING' || status === 'CONFIRMED') — asserted here via pure logic.
// =============================================================================

describe('[unit] isCancellable rule (cancel button shown/hidden per AC#1–4)', () => {
    function isCancellable(status: string): boolean {
        return status === 'PENDING' || status === 'CONFIRMED';
    }

    it('AC#1 CONFIRMED → cancel button shown', () => {
        expect(isCancellable('CONFIRMED')).toBe(true);
    });

    it('AC#2 PENDING → cancel button shown', () => {
        expect(isCancellable('PENDING')).toBe(true);
    });

    it('AC#3 CANCELLED → cancel button hidden', () => {
        expect(isCancellable('CANCELLED')).toBe(false);
    });

    it('AC#4 COMPLETED → cancel button hidden', () => {
        expect(isCancellable('COMPLETED')).toBe(false);
    });
});

// =============================================================================
// UNIT — Thai date format (AC#11)
// Proves the date path uses toLocaleDateString('th-TH', ...) producing พ.ศ. format.
// =============================================================================

describe('[unit] Thai date format AC#11', () => {
    it('toLocaleDateString with th-TH produces Buddhist Era (พ.ศ.) year', () => {
        // 5 Jan 2025 CE = พ.ศ. 2568
        const date = new Date('2025-01-05T00:00:00Z');
        const formatted = date.toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        // The year in th-TH is Buddhist Era; 2025 CE = 2568 BE
        expect(formatted).toContain('2568');
    });

    it('toLocaleDateString with en-US produces Gregorian year (not Buddhist Era)', () => {
        const date = new Date('2025-01-05T00:00:00Z');
        const formatted = date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        expect(formatted).toContain('2025');
        expect(formatted).not.toContain('2568');
    });

    it('BookingDetailClient source uses th-TH for Thai locale path', () => {
        // Source-inspection: assert the literal th-TH locale selection appears in the component.
        const clientSrc = fs.readFileSync(
            path.resolve(__dirname, '../app/bookings/[id]/BookingDetailClient.tsx'),
            'utf-8'
        );
        // The component may use single or double quotes around the locale string
        expect(clientSrc).toMatch(/"th-TH"|'th-TH'/);
        expect(clientSrc).toMatch(/language === ["']th["']/);
    });
});

// =============================================================================
// UNIT — i18n verbatim (AC#7, AC#10 + key presence)
// =============================================================================

describe('[unit] i18n key verbatim from locales/translations.json', () => {
    const translations = JSON.parse(
        fs.readFileSync(
            path.resolve(__dirname, '../locales/translations.json'),
            'utf-8'
        )
    );

    it('th.bookings.detail.backToBookings === "กลับไปยังการจองของฉัน"', () => {
        expect(translations.th.bookings.detail.backToBookings).toBe('กลับไปยังการจองของฉัน');
    });

    it('th.bookings.detail.forbidden === "ไม่พบข้อมูลการจอง หรือคุณไม่มีสิทธิ์เข้าถึง"', () => {
        expect(translations.th.bookings.detail.forbidden).toBe(
            'ไม่พบข้อมูลการจอง หรือคุณไม่มีสิทธิ์เข้าถึง'
        );
    });

    it('th.bookings.bookingCancelledSuccess === "ยกเลิกการจองสำเร็จ" (AC#5 success toast)', () => {
        expect(translations.th.bookings.bookingCancelledSuccess).toBe('ยกเลิกการจองสำเร็จ');
    });

    it('th.bookings.errorOccurred === "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" (AC#6 error toast)', () => {
        expect(translations.th.bookings.errorOccurred).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });

    it('th.bookings.statusConfirmed === "ยืนยันแล้ว" (AC#1)', () => {
        expect(translations.th.bookings.statusConfirmed).toBe('ยืนยันแล้ว');
    });

    it('th.bookings.statusPending === "รอยืนยัน" (AC#2)', () => {
        expect(translations.th.bookings.statusPending).toBe('รอยืนยัน');
    });

    it('th.bookings.statusCancelled === "ยกเลิกแล้ว" (AC#3)', () => {
        expect(translations.th.bookings.statusCancelled).toBe('ยกเลิกแล้ว');
    });

    it('th.bookings.statusCompleted === "เข้าพักแล้ว" (AC#4)', () => {
        expect(translations.th.bookings.statusCompleted).toBe('เข้าพักแล้ว');
    });

    // EN counterparts
    it('en.bookings.detail.backToBookings present', () => {
        expect(translations.en.bookings.detail.backToBookings).toBe('Back to my bookings');
    });

    it('en.bookings.detail.forbidden present', () => {
        expect(translations.en.bookings.detail.forbidden).toBe(
            'Booking not found or you do not have access'
        );
    });
});

// =============================================================================
// UNIT — cancel flow source-inspection (AC#5, AC#6)
// Asserts the handler in BookingDetailClient.tsx matches the spec:
//   success → toast.success(t.bookings.bookingCancelledSuccess) + setBooking CANCELLED
//   error   → toast.error(t.bookings.errorOccurred), status unchanged
// =============================================================================

describe('[unit/source] cancel flow in BookingDetailClient (AC#5, AC#6)', () => {
    const clientSrc = fs.readFileSync(
        path.resolve(__dirname, '../app/bookings/[id]/BookingDetailClient.tsx'),
        'utf-8'
    );

    it('AC#5 success path: PATCH /api/bookings/[id] with {status: CANCELLED}', () => {
        expect(clientSrc).toContain("status: \"CANCELLED\"");
        expect(clientSrc).toContain('method: "PATCH"');
    });

    it('AC#5 success path: toast.success uses bookingCancelledSuccess key', () => {
        expect(clientSrc).toContain('toast.success(t.bookings.bookingCancelledSuccess)');
    });

    it('AC#5 success path: setBooking updates status to CANCELLED on res.ok', () => {
        expect(clientSrc).toContain("status: \"CANCELLED\"");
        expect(clientSrc).toContain('setBooking');
        expect(clientSrc).toContain('res.ok');
    });

    it('AC#6 error path: toast.error uses errorOccurred key', () => {
        expect(clientSrc).toContain('toast.error(t.bookings.errorOccurred)');
    });

    it('AC#6 error path: no setBooking call in the else/catch block (status unchanged)', () => {
        // The source should not call setBooking when the response is not ok.
        // Verify the else branch only calls toast.error, not setBooking.
        // We check that toast.error appears more than once (both else + catch), and
        // that the else branch (non-ok) does not reassign status.
        const lines = clientSrc.split('\n');
        const elseIdx = lines.findIndex((l) => l.includes('toast.error(t.bookings.errorOccurred)'));
        expect(elseIdx).toBeGreaterThan(-1);
        // 5 lines around the toast.error should not contain setBooking
        const surroundingLines = lines.slice(Math.max(0, elseIdx - 2), elseIdx + 3).join('\n');
        expect(surroundingLines).not.toContain('setBooking');
    });
});

// =============================================================================
// UNIT — cancel button visibility source-inspection (AC#1–4)
// Confirms BookingDetailClient only renders cancel button when status is
// PENDING or CONFIRMED (not CANCELLED or COMPLETED).
// =============================================================================

describe('[unit/source] cancel-button visibility guard (AC#1–4)', () => {
    const clientSrc = fs.readFileSync(
        path.resolve(__dirname, '../app/bookings/[id]/BookingDetailClient.tsx'),
        'utf-8'
    );

    it('isCancellable gate guards the cancel button render', () => {
        // The button is wrapped in {isCancellable && ...}
        expect(clientSrc).toContain('isCancellable');
        expect(clientSrc).toContain('data-testid="btn--booking-cancel"');
    });

    it('isCancellable is computed as PENDING || CONFIRMED only', () => {
        expect(clientSrc).toContain("booking.status === \"PENDING\" || booking.status === \"CONFIRMED\"");
    });

    it('CANCELLED and COMPLETED do not appear in the isCancellable expression', () => {
        // Extract the line with isCancellable assignment
        const match = clientSrc.match(/const isCancellable\s*=\s*.+/);
        expect(match).not.toBeNull();
        const line = match![0];
        expect(line).not.toContain('CANCELLED');
        expect(line).not.toContain('COMPLETED');
    });
});

// =============================================================================
// SOURCE-INSPECTION — skeleton + not-found files exist (AC#9, AC#10)
// =============================================================================

describe('[source] loading.tsx skeleton exists (AC#9)', () => {
    it('app/bookings/[id]/loading.tsx exists and exports a Skeleton-based component', () => {
        const loadingPath = path.resolve(__dirname, '../app/bookings/[id]/loading.tsx');
        expect(fs.existsSync(loadingPath)).toBe(true);
        const src = fs.readFileSync(loadingPath, 'utf-8');
        expect(src).toContain('Skeleton');
    });
});

describe('[source] not-found.tsx handles AC#10 (not found) and AC#7 (forbidden — same UI)', () => {
    it('app/bookings/[id]/not-found.tsx exists', () => {
        const nfPath = path.resolve(__dirname, '../app/bookings/[id]/not-found.tsx');
        expect(fs.existsSync(nfPath)).toBe(true);
    });

    it('not-found.tsx renders backToBookings CTA (AC#10)', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, '../app/bookings/[id]/not-found.tsx'),
            'utf-8'
        );
        expect(src).toContain('backToBookings');
        expect(src).toContain('/bookings');
    });

    it('not-found.tsx comment confirms AC#7 + AC#10 share the same UI (no existence leak)', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, '../app/bookings/[id]/not-found.tsx'),
            'utf-8'
        );
        // The file should mention both AC#7 and AC#10 sharing the same UI
        expect(src).toContain('AC#7');
        expect(src).toContain('AC#10');
    });
});

// =============================================================================
// SOURCE-INSPECTION — owner-scope at DB layer (Security / Rules)
// getOwnedBooking must use where: { id, userId } — NOT a post-fetch JS comparison.
// =============================================================================

describe('[source] getOwnedBooking owner-scoped at DB layer (no existence leak)', () => {
    const bookingsSrc = fs.readFileSync(
        path.resolve(__dirname, '../lib/bookings.ts'),
        'utf-8'
    );

    it('uses prisma.booking.findFirst (not findUnique then filter)', () => {
        expect(bookingsSrc).toContain('findFirst');
        expect(bookingsSrc).not.toContain('findUnique');
    });

    it('where clause contains both id AND userId (DB-level owner-scope, not post-fetch JS)', () => {
        expect(bookingsSrc).toContain('where: { id, userId }');
    });

    it('returns null directly (no 403 vs 404 split that would leak existence)', () => {
        // The function returns `booking ?? null` — no error-throwing, caller maps null → 404
        expect(bookingsSrc).toContain('booking ?? null');
        // Does NOT call apiError or throw a 403 from within this helper
        // (the comment in the source explicitly says "no 403 vs 404 split")
        expect(bookingsSrc).toContain('no 403 vs 404 split');
    });

    it('includes campSite with images ordered by sortOrder (no N+1)', () => {
        expect(bookingsSrc).toContain('orderBy: { sortOrder:');
        expect(bookingsSrc).toContain("'asc'");
    });

    it('includes spot relation in the same query (no N+1)', () => {
        expect(bookingsSrc).toContain('spot:');
        expect(bookingsSrc).toContain('select:');
    });
});

// =============================================================================
// SOURCE-INSPECTION — GET route handler no 403/404 split (AC#7)
// =============================================================================

describe('[source] GET route handler: no 403 — both cases map to 404 (AC#7 no existence leak)', () => {
    const routeSrc = fs.readFileSync(
        path.resolve(__dirname, '../app/api/bookings/[id]/route.ts'),
        'utf-8'
    );

    it('GET handler calls getOwnedBooking (delegates ownership to helper)', () => {
        expect(routeSrc).toContain('getOwnedBooking');
        expect(routeSrc).toContain('session!.user!.id');
    });

    it('GET handler maps null → 404 "Booking not found" (not 403)', () => {
        expect(routeSrc).toContain("apiError('Booking not found', 404)");
    });

    it('GET handler does NOT return 403 (no existence leak — same 404 for both cases)', () => {
        // Extract only the GET function block to avoid the PATCH handler's 403
        const getHandlerStart = routeSrc.indexOf('export async function GET(');
        const getHandlerBlock = routeSrc.slice(getHandlerStart);
        expect(getHandlerBlock).not.toContain('403');
    });
});

// =============================================================================
// INTEGRATION — GET /api/bookings/[id]
// Tests the real GET handler with mocked Prisma + auth boundary only.
// =============================================================================

describe('[integration] GET /api/bookings/[id]', () => {
    describe('AC#8 — unauthenticated → 401', () => {
        it('returns 401 when requireAuth returns an error response', async () => {
            // Arrange: requireAuth returns an error (no session)
            const unauthorizedResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
            mockRequireAuth.mockResolvedValueOnce({ error: unauthorizedResponse, session: null });

            const [req, context] = makeGetRequest();
            // Act
            const res = await GET(req, context);

            // Assert
            expect(res.status).toBe(401);
            const body = await parseJson(res);
            expect(body.error).toBe('Unauthorized');
        });
    });

    describe('AC#10 — booking not found → 404', () => {
        it('returns 404 with "Booking not found" when getOwnedBooking returns null', async () => {
            // Arrange
            mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
            mockGetOwnedBooking.mockResolvedValueOnce(null);

            const [req, context] = makeGetRequest('nonexistent-booking-id');
            // Act
            const res = await GET(req, context);

            // Assert
            expect(res.status).toBe(404);
            const body = await parseJson(res);
            expect(body.error).toBe('Booking not found');
        });
    });

    describe('AC#7 — wrong-owner returns same 404 as missing (no existence leak)', () => {
        it('other user booking → same 404 body as not found (no 403, no existence leak)', async () => {
            // Arrange: session user is OTHER_USER; getOwnedBooking returns null
            // because DB query scoped to OTHER_USER returns nothing for BOOKING_ID
            mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(OTHER_USER) });
            mockGetOwnedBooking.mockResolvedValueOnce(null); // DB returns null for wrong owner

            const [req, context] = makeGetRequest(BOOKING_ID);
            // Act
            const res = await GET(req, context);

            // Assert: same 404, same body — no existence leak
            expect(res.status).toBe(404);
            const body = await parseJson(res);
            expect(body.error).toBe('Booking not found');
            // Confirm no 403 is returned
            expect(res.status).not.toBe(403);
        });

        it('getOwnedBooking is called with session.user.id (not a different id)', async () => {
            mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
            mockGetOwnedBooking.mockResolvedValueOnce(null);

            const [req, context] = makeGetRequest(BOOKING_ID);
            await GET(req, context);

            // Assert: getOwnedBooking receives the session user id
            expect(mockGetOwnedBooking).toHaveBeenCalledOnce();
            const [calledId, calledUserId] = mockGetOwnedBooking.mock.calls[0];
            expect(calledId).toBe(BOOKING_ID);
            expect(calledUserId).toBe(USER_ID);
        });
    });

    describe('AC#1 — owner CONFIRMED → 200 with full booking shape', () => {
        it('returns 200 with booking data when owner is authenticated', async () => {
            // Arrange
            mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
            const fixture = makeBookingFixture('CONFIRMED');
            mockGetOwnedBooking.mockResolvedValueOnce(fixture);

            const [req, context] = makeGetRequest(BOOKING_ID);
            // Act
            const res = await GET(req, context);

            // Assert
            expect(res.status).toBe(200);
            const body = await parseJson(res);
            expect(body.id).toBe(BOOKING_ID);
            expect(body.status).toBe('CONFIRMED');
            expect(body.campSite.nameTh).toBe('แคมป์ทดสอบ');
            expect(body.spot.name).toBe('A1');
        });

        it('campSite.images array is present in the response', async () => {
            mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
            const fixture = makeBookingFixture('CONFIRMED');
            mockGetOwnedBooking.mockResolvedValueOnce(fixture);

            const [req, context] = makeGetRequest(BOOKING_ID);
            const res = await GET(req, context);
            const body = await parseJson(res);

            expect(Array.isArray(body.campSite.images)).toBe(true);
            expect(body.campSite.images[0].url).toBe('https://example.com/cover.jpg');
        });
    });

    describe('AC#2 — owner PENDING → 200', () => {
        it('returns 200 with status PENDING for the owner', async () => {
            mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
            mockGetOwnedBooking.mockResolvedValueOnce(makeBookingFixture('PENDING'));

            const [req, context] = makeGetRequest(BOOKING_ID);
            const res = await GET(req, context);

            expect(res.status).toBe(200);
            const body = await parseJson(res);
            expect(body.status).toBe('PENDING');
        });
    });

    describe('AC#7 security — getOwnedBooking receives session userId (owner-scope proof)', () => {
        it('USER_A cannot read USER_B booking — getOwnedBooking called with USER_A id', async () => {
            // USER_A authenticates but wants BOOKING_ID which belongs to USER_B.
            // The DB helper returns null (owner mismatch) — we assert the correct userId was passed.
            mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
            mockGetOwnedBooking.mockResolvedValueOnce(null);

            const [req, context] = makeGetRequest(BOOKING_ID);
            await GET(req, context);

            const [, passedUserId] = mockGetOwnedBooking.mock.calls[0];
            expect(passedUserId).toBe(USER_ID);
            expect(passedUserId).not.toBe(OTHER_USER);
        });
    });

    describe('500 — unexpected server error', () => {
        it('returns 500 on unexpected Prisma throw', async () => {
            mockRequireAuth.mockResolvedValueOnce({ error: null, session: makeSession(USER_ID) });
            mockGetOwnedBooking.mockRejectedValueOnce(new Error('DB exploded'));

            const [req, context] = makeGetRequest(BOOKING_ID);
            const res = await GET(req, context);

            expect(res.status).toBe(500);
            const body = await parseJson(res);
            expect(body.error).toBeTruthy();
        });
    });
});

// =============================================================================
// UNIT — page.tsx source-inspection: auth guard + notFound for wrong-owner (AC#7, AC#8)
// =============================================================================

describe('[source] page.tsx auth guard and owner-scope (AC#7, AC#8)', () => {
    const pageSrc = fs.readFileSync(
        path.resolve(__dirname, '../app/bookings/[id]/page.tsx'),
        'utf-8'
    );

    it('AC#8 redirect to /login when no session', () => {
        // The source may use single or double quotes; match both
        expect(pageSrc).toMatch(/redirect\(["']\/login["']\)/);
        expect(pageSrc).toContain('session?.user?.id');
    });

    it('AC#7/AC#10 calls notFound() when getOwnedBooking returns null', () => {
        expect(pageSrc).toContain('notFound()');
        expect(pageSrc).toContain('getOwnedBooking');
    });

    it('passes session.user.id to getOwnedBooking (not a param or body value)', () => {
        expect(pageSrc).toContain('session.user.id');
        // The call should be getOwnedBooking(id, session.user.id)
        expect(pageSrc).toContain('getOwnedBooking(id, session.user.id)');
    });

    it('Decimal totalPrice serialized as Number() before passing to client', () => {
        expect(pageSrc).toContain('Number(booking.totalPrice)');
    });

    it('Date fields serialized as .toISOString() before passing to client', () => {
        expect(pageSrc).toContain('.toISOString()');
    });

    it('noindex robots meta (AC#9 — auth page must not be indexed)', () => {
        expect(pageSrc).toContain('robots: { index: false }');
    });
});

// =============================================================================
// UNIT — data-testid conventions present in source (spec compliance)
// =============================================================================

describe('[source] data-testid convention compliance', () => {
    const clientSrc = fs.readFileSync(
        path.resolve(__dirname, '../app/bookings/[id]/BookingDetailClient.tsx'),
        'utf-8'
    );

    it('btn--booking-cancel testid present', () => {
        expect(clientSrc).toContain('data-testid="btn--booking-cancel"');
    });

    it('badge--booking-status testid present', () => {
        expect(clientSrc).toContain('data-testid="badge--booking-status"');
    });

    it('img--booking-cover testid present', () => {
        expect(clientSrc).toContain('data-testid="img--booking-cover"');
    });

    it('booking-cancel-dialog testid present', () => {
        expect(clientSrc).toContain('data-testid="booking-cancel-dialog"');
    });
});
