/**
 * CAM-216 — SEC-B: Location boundary validation tests
 *
 * Coverage matrix (qa.md §7):
 *   normal      — valid body passes the schema
 *   null/empty  — missing required fields (lat, lon) are rejected
 *   boundary    — lat/lon at the valid edge (±90 / ±180) pass;
 *                 one step out-of-range fail
 *   error       — invalid type for lat/lon returns error
 *   route 400   — POST /api/location with invalid body returns 400
 *   route pass  — POST /api/location with valid body passes validation guard
 *                 (Prisma calls mocked; no auth for this layer test)
 *
 * Layer: unit (zod schema) + integration (route handler — mocked Prisma + auth).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createLocationSchema } from '@/lib/validations/location';

// ---------------------------------------------------------------------------
// Module mocks — declared before route imports (Vitest hoisting boundary)
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
}));

// requireAuth uses auth() internally
vi.mock('@/lib/auth-utils', () => ({
    requireAuth: vi.fn(async () => {
        const session = await mockAuth();
        if (!session) {
            const { NextResponse } = await import('next/server');
            return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }), session: null };
        }
        return { error: null, session };
    }),
}));

const mockLocationCreate         = vi.fn();
const mockCountryFindUnique      = vi.fn();
const mockThailandLocationFind   = vi.fn();
const mockAdminAreaFindUnique    = vi.fn();

vi.mock('@/lib/prisma', () => ({
    prisma: {
        location: {
            create: (...args: unknown[]) => mockLocationCreate(...args),
        },
        country: {
            findUnique: (...args: unknown[]) => mockCountryFindUnique(...args),
        },
        thailandLocation: {
            findUnique: (...args: unknown[]) => mockThailandLocationFind(...args),
        },
        adminArea: {
            findUnique: (...args: unknown[]) => mockAdminAreaFindUnique(...args),
        },
    },
}));

// ---------------------------------------------------------------------------
// Route import (after mocks)
// ---------------------------------------------------------------------------
const { POST: locationPOST } = await import('@/app/api/location/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSession() {
    return { user: { id: 'user-uuid-001', email: 'host@campvibe.th', name: 'Host', role: 'OPERATOR' } };
}

function makeRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const VALID_BODY = { lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai', region: 'North' };
const CREATED_LOCATION = { id: 'loc-uuid-001', ...VALID_BODY, countryCode: 'TH', adminAreaId: null };

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Unit tests: createLocationSchema (pure zod)
// ---------------------------------------------------------------------------
describe('createLocationSchema', () => {
    describe('valid inputs', () => {
        it('accepts a minimal valid body (lat + lon only)', () => {
            const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0 });
            expect(result.success).toBe(true);
        });

        it('accepts full optional fields', () => {
            const result = createLocationSchema.safeParse({
                lat: 18.9167,
                lon: 98.9667,
                country: 'Thailand',
                province: 'Chiang Mai',
                region: 'North',
            });
            expect(result.success).toBe(true);
        });

        it('accepts thaiLocationId as a valid UUID', () => {
            const result = createLocationSchema.safeParse({
                lat: 13.0,
                lon: 100.0,
                thaiLocationId: '123e4567-e89b-12d3-a456-426614174000',
            });
            expect(result.success).toBe(true);
        });

        it('accepts lat = -90 (boundary min)', () => {
            const result = createLocationSchema.safeParse({ lat: -90, lon: 0 });
            expect(result.success).toBe(true);
        });

        it('accepts lat = 90 (boundary max)', () => {
            const result = createLocationSchema.safeParse({ lat: 90, lon: 0 });
            expect(result.success).toBe(true);
        });

        it('accepts lon = -180 (boundary min)', () => {
            const result = createLocationSchema.safeParse({ lat: 0, lon: -180 });
            expect(result.success).toBe(true);
        });

        it('accepts lon = 180 (boundary max)', () => {
            const result = createLocationSchema.safeParse({ lat: 0, lon: 180 });
            expect(result.success).toBe(true);
        });

        it('trims whitespace from string fields', () => {
            const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, country: '  Thailand  ' });
            expect(result.success).toBe(true);
            if (result.success) expect(result.data.country).toBe('Thailand');
        });
    });

    describe('invalid inputs — rejected', () => {
        it('rejects missing lat', () => {
            const result = createLocationSchema.safeParse({ lon: 98.9667 });
            expect(result.success).toBe(false);
        });

        it('rejects missing lon', () => {
            const result = createLocationSchema.safeParse({ lat: 18.9167 });
            expect(result.success).toBe(false);
        });

        it('rejects lat = -91 (below minimum)', () => {
            const result = createLocationSchema.safeParse({ lat: -91, lon: 0 });
            expect(result.success).toBe(false);
        });

        it('rejects lat = 91 (above maximum)', () => {
            const result = createLocationSchema.safeParse({ lat: 91, lon: 0 });
            expect(result.success).toBe(false);
        });

        it('rejects lon = -181 (below minimum)', () => {
            const result = createLocationSchema.safeParse({ lat: 0, lon: -181 });
            expect(result.success).toBe(false);
        });

        it('rejects lon = 181 (above maximum)', () => {
            const result = createLocationSchema.safeParse({ lat: 0, lon: 181 });
            expect(result.success).toBe(false);
        });

        it('rejects lat as a string', () => {
            const result = createLocationSchema.safeParse({ lat: 'north', lon: 100.0 });
            expect(result.success).toBe(false);
        });

        it('rejects lon as a string', () => {
            const result = createLocationSchema.safeParse({ lat: 13.0, lon: 'east' });
            expect(result.success).toBe(false);
        });

        it('rejects thaiLocationId that is not a UUID', () => {
            const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, thaiLocationId: 'not-a-uuid' });
            expect(result.success).toBe(false);
        });

        it('rejects country longer than 100 chars', () => {
            const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, country: 'A'.repeat(101) });
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// Integration tests: POST /api/location route handler
// ---------------------------------------------------------------------------
describe('POST /api/location — route handler validation guard', () => {
    it('returns 400 when lat is missing', async () => {
        mockAuth.mockResolvedValue(makeSession());
        const res = await locationPOST(makeRequest({ lon: 98.9667 }));
        expect(res.status).toBe(400);
        const body = await res.json() as { error: string };
        expect(body.error).toBe('invalid_input');
    });

    it('returns 400 when lon is missing', async () => {
        mockAuth.mockResolvedValue(makeSession());
        const res = await locationPOST(makeRequest({ lat: 18.9167 }));
        expect(res.status).toBe(400);
        const body = await res.json() as { error: string };
        expect(body.error).toBe('invalid_input');
    });

    it('returns 400 when lat is out of range (>90)', async () => {
        mockAuth.mockResolvedValue(makeSession());
        const res = await locationPOST(makeRequest({ lat: 91, lon: 98.9667 }));
        expect(res.status).toBe(400);
        const body = await res.json() as { error: string };
        expect(body.error).toBe('invalid_input');
    });

    it('returns 400 when lon is out of range (<-180)', async () => {
        mockAuth.mockResolvedValue(makeSession());
        const res = await locationPOST(makeRequest({ lat: 18.9, lon: -181 }));
        expect(res.status).toBe(400);
        const body = await res.json() as { error: string };
        expect(body.error).toBe('invalid_input');
    });

    it('returns 400 when thaiLocationId is not a UUID', async () => {
        mockAuth.mockResolvedValue(makeSession());
        const res = await locationPOST(makeRequest({ lat: 18.9, lon: 98.9, thaiLocationId: 'bad-id' }));
        expect(res.status).toBe(400);
    });

    it('returns 401 when not authenticated', async () => {
        mockAuth.mockResolvedValue(null);
        const res = await locationPOST(makeRequest(VALID_BODY));
        expect(res.status).toBe(401);
    });

    it('passes validation and reaches Prisma on valid body', async () => {
        mockAuth.mockResolvedValue(makeSession());
        mockCountryFindUnique.mockResolvedValue({ code: 'TH' });
        mockThailandLocationFind.mockResolvedValue(null);
        mockLocationCreate.mockResolvedValue(CREATED_LOCATION);

        const res = await locationPOST(makeRequest(VALID_BODY));
        expect(res.status).toBe(201);
        // Prisma create was called — validation did not block the happy path
        expect(mockLocationCreate).toHaveBeenCalledOnce();
        const body = await res.json() as typeof CREATED_LOCATION;
        expect(body.id).toBe('loc-uuid-001');
    });
});
