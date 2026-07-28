/**
 * cam-613-location-write-authz.test.ts — CAM-613
 *
 * Story: a host who owns camp A could rewrite ANY other camp's
 * province/district/sub-district by sending that other camp's `locationId`
 * inside a PUT to their OWN camp A. `app/api/campsites/[id]/route.ts`
 * authorised the camp NAMED IN THE PATH (`requireCampSitePermission`) but
 * then wrote a `Location` row keyed by `data.locationId` from the REQUEST
 * BODY — never compared to the authorised camp's own `existing.locationId`.
 *
 * Prove-It (failing-first, qa.md): the cross-tenant test below reproduces
 * the exact abuse from the ticket and FAILS against the pre-fix code —
 * confirmed by hand (temporarily reverting the route's location-update
 * block back to `where: { id: data.locationId }` makes the
 * "[cross-tenant]" test below fail with `call.where` equal to the FOREIGN
 * location id instead of the authorised camp's own) — then passes after the
 * fix (`where: { id: existing.locationId }`, gated on `hasLocationFieldEdit`
 * alone).
 *
 * Layer: integration (route handler, mocked Prisma + auth-utils — same
 * precedent as __tests__/cam-559-cascading-location.test.ts, which this
 * story's fix directly touches; see that file's one-line `locationId`
 * fixture addition, documented in tech.md).
 *
 * Coverage matrix (qa.md §7):
 *   normal (AC-2) — the legitimate own-camp edit still writes the
 *                    authorised camp's own Location row
 *   null/empty (AC-3) — omitting `locationId` from the body entirely still
 *                    writes the authorised camp's own Location row
 *   error/abuse (AC-1) — a foreign `locationId` in the body is IGNORED; the
 *                    write never targets the foreign row
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks — declared before route imports (Vitest hoisting boundary),
// same pattern as cam-559/cam-360.
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
    prisma: {
        campSite: { update: vi.fn() },
        location: { update: vi.fn() },
    },
}));

vi.mock('@/lib/auth-utils', () => ({
    requireCampSitePermission: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { PUT as campSitePUT } from '@/app/api/campsites/[id]/route';

// Camp A — the camp Host A owns and is authorised to edit via the PATH id.
const CAMP_A_ID = '550e8400-e29b-41d4-a716-446655440613';
const LOCATION_A_ID = 'a2fef996-3f4c-4ff0-99ab-4425438f2613'; // camp A's OWN, real locationId

// Camp B — a DIFFERENT host's camp. Its locationId is what a real attacker
// would have read off `GET /api/campsites/{B}` (the ticket's own exposure
// note) and then tried to smuggle into a PUT on camp A.
const LOCATION_B_FOREIGN_ID = 'b3fef996-3f4c-4ff0-99ab-4425438f2613';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function mockAllowed() {
    // The record requireCampSitePermission fetched + proved belongs to the
    // path's `id` — carries camp A's OWN real locationId, exactly as the
    // real `prisma.campSite.findUnique` would return it (a plain scalar
    // column, see prisma/schema.prisma `CampSite.locationId`).
    (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
        error: null,
        campSite: { id: CAMP_A_ID, operatorId: 'op-1', locationId: LOCATION_A_ID, isPublished: false } as never,
        session: { user: { id: 'op-1' } } as never,
    });
}

function putRequest(body: Record<string, unknown>) {
    return new NextRequest(`http://localhost/api/campsites/${CAMP_A_ID}`, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
    });
}

describe('PUT /api/campsites/[id] — the location write targets the AUTHORISED camp only (CAM-613)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAllowed();
        (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: CAMP_A_ID,
            nameThSlug: 'camp-a-th',
            nameEnSlug: 'camp-a-en',
        });
        (prisma.location.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: LOCATION_A_ID });
    });

    it('[error/abuse, AC-1] a foreign locationId in the body is IGNORED — the write never targets it, only the authorised camp\'s own Location row', async () => {
        const res = await campSitePUT(
            putRequest({
                locationId: LOCATION_B_FOREIGN_ID, // <- another camp's real locationId, smuggled in
                province: '',
                district: '',
                subDistrict: '',
            }),
            makeParams(CAMP_A_ID)
        );

        expect(res.status).toBe(200);
        expect(prisma.location.update).toHaveBeenCalledOnce();
        const call = (prisma.location.update as ReturnType<typeof vi.fn>).mock.calls[0][0];

        // The write must land on camp A's OWN location — never the foreign one.
        expect(call.where).toEqual({ id: LOCATION_A_ID });
        expect(call.where).not.toEqual({ id: LOCATION_B_FOREIGN_ID });
    });

    it('[normal, AC-2] the legitimate path — editing one\'s own camp with one\'s own real locationId — still succeeds unchanged', async () => {
        const res = await campSitePUT(
            putRequest({ locationId: LOCATION_A_ID, province: 'Chiang Mai', district: 'Mueang', subDistrict: 'Suthep' }),
            makeParams(CAMP_A_ID)
        );

        expect(res.status).toBe(200);
        const call = (prisma.location.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.where).toEqual({ id: LOCATION_A_ID });
        expect(call.data.province).toBe('Chiang Mai');
        expect(call.data.district).toBe('Mueang');
        expect(call.data.subDistrict).toBe('Suthep');
    });

    it('[null/empty, AC-3] omitting locationId from the body entirely still writes the authorised camp\'s own Location row', async () => {
        const res = await campSitePUT(
            putRequest({ province: 'Phuket' }), // no locationId key at all
            makeParams(CAMP_A_ID)
        );

        expect(res.status).toBe(200);
        expect(prisma.location.update).toHaveBeenCalledOnce();
        const call = (prisma.location.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call.where).toEqual({ id: LOCATION_A_ID });
        expect(call.data.province).toBe('Phuket');
    });

    it('[null/empty] no location field edited at all -> no location.update call (unchanged pre-existing behavior)', async () => {
        await campSitePUT(putRequest({ priceLow: 700 }), makeParams(CAMP_A_ID));
        expect(prisma.location.update).not.toHaveBeenCalled();
    });
});
