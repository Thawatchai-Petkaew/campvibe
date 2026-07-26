/**
 * CAM-553 — Prove-It: the district a host types is silently dropped.
 *
 * CAM-551 found that `components/CampgroundForm.tsx`'s create-location POST
 * body only sent `country`, `province`, `lat`, `lon`, `thaiLocationId` — the
 * `district` field the host typed/selected was collected into form state but
 * never left the client, so `Location.district` is null on every camp. This
 * suite is RED against the pre-fix code (verified by hand: reverting the
 * `district` line in the POST body and the `district` field on
 * `createLocationSchema`/`app/api/location/route.ts` makes every test below
 * fail) and GREEN after the fix below.
 *
 * Layer: source-inspection (FE payload line, same precedent as
 * __tests__/cam-360-logo-clear-persists.test.ts) + unit (zod boundary) +
 * integration (route handler, mocked Prisma + auth, same precedent as
 * __tests__/cam-216-sec-b-location-validation.test.ts).
 *
 * Coverage matrix (qa.md §7):
 *   normal      — a submitted district reaches `prisma.location.create`'s data
 *   null/empty  — omitting district still creates the location (no regression)
 *   boundary    — district at the 100-char max passes; 101 chars is rejected
 *   error       — a non-string district is rejected by the zod boundary
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { createLocationSchema } from '@/lib/validations/location';

// ---------------------------------------------------------------------------
// Module mocks — declared before route import (Vitest hoisting boundary),
// same pattern as __tests__/cam-216-sec-b-location-validation.test.ts
// ---------------------------------------------------------------------------
const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
}));

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

const mockLocationCreate = vi.fn();
const mockCountryFindUnique = vi.fn();
const mockThailandLocationFind = vi.fn();
const mockAdminAreaFindUnique = vi.fn();

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

const { POST: locationPOST } = await import('@/app/api/location/route');

function makeSession() {
    return { user: { id: 'user-uuid-553', email: 'host@campvibe.th', name: 'Host', role: 'OPERATOR' } };
}

function makeRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(makeSession());
    mockCountryFindUnique.mockResolvedValue({ code: 'TH' });
    mockThailandLocationFind.mockResolvedValue(null);
    mockLocationCreate.mockResolvedValue({ id: 'loc-uuid-553' });
});

// ---------------------------------------------------------------------------
// FE payload wiring — source-inspection (same precedent as CAM-360's logo
// check): the create-location fetch body must carry `district`.
// ---------------------------------------------------------------------------
describe('CampgroundForm — location POST body includes district (source-inspection)', () => {
    const formSrc = fs.readFileSync(
        path.join(path.resolve(__dirname, '..'), 'components/CampgroundForm.tsx'),
        'utf-8'
    );

    it('sends district: formData.district in the /api/location POST body', () => {
        expect(formSrc).toContain('district: formData.district');
    });
});

// ---------------------------------------------------------------------------
// Zod boundary — createLocationSchema accepts district (atomic, mirrors province)
// ---------------------------------------------------------------------------
describe('createLocationSchema.district (CAM-553)', () => {
    it('[normal] accepts a district string alongside province', () => {
        const result = createLocationSchema.safeParse({
            lat: 18.9167, lon: 98.9667, province: 'Chiang Mai', district: 'Mueang Chiang Mai',
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.district).toBe('Mueang Chiang Mai');
    });

    it('[null/empty] omitting district is still valid (no regression to the optional contract)', () => {
        const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0 });
        expect(result.success).toBe(true);
    });

    it('[boundary] district at exactly 100 chars passes', () => {
        const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, district: 'D'.repeat(100) });
        expect(result.success).toBe(true);
    });

    it('[boundary] district at 101 chars is rejected', () => {
        const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, district: 'D'.repeat(101) });
        expect(result.success).toBe(false);
    });

    it('[error/validation] a non-string district is rejected', () => {
        const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, district: 42 });
        expect(result.success).toBe(false);
    });

    it('trims whitespace from district', () => {
        const result = createLocationSchema.safeParse({ lat: 13.0, lon: 100.0, district: '  Mueang  ' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.district).toBe('Mueang');
    });
});

// ---------------------------------------------------------------------------
// Integration — POST /api/location persists district (the actual Prove-It:
// this is RED before the fix — `district` never reaches prisma.location.create).
// ---------------------------------------------------------------------------
describe('POST /api/location — district reaches the database (CAM-553 Prove-It)', () => {
    it('[normal] a submitted district is passed to prisma.location.create', async () => {
        const res = await locationPOST(makeRequest({
            lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai', district: 'Mueang Chiang Mai',
        }));

        expect(res.status).toBe(201);
        expect(mockLocationCreate).toHaveBeenCalledOnce();
        const call = mockLocationCreate.mock.calls[0][0];
        expect(call.data.district).toBe('Mueang Chiang Mai');
    });

    it('[null/empty] omitting district still creates the location (no regression)', async () => {
        const res = await locationPOST(makeRequest({
            lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai',
        }));

        expect(res.status).toBe(201);
        const call = mockLocationCreate.mock.calls[0][0];
        expect(call.data.district).toBeUndefined();
    });

    it('[regression] province still reaches the database alongside district (CAM-216 path unweakened)', async () => {
        await locationPOST(makeRequest({
            lat: 18.9167, lon: 98.9667, country: 'Thailand', province: 'Chiang Mai', district: 'Mae Rim',
        }));

        const call = mockLocationCreate.mock.calls[0][0];
        expect(call.data.province).toBe('Chiang Mai');
        expect(call.data.district).toBe('Mae Rim');
    });
});
