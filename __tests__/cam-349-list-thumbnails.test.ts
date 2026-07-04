/**
 * CAM-349 — My Camp Sites thumbnails: /api/operator/dashboard must ship
 * `images[0].url` on each listing camp (the page reads camp.images[0].url;
 * the include previously carried only location + _count, so every row fell
 * to the placeholder). Route-level integration via the real GET handler
 * (mocked prisma + auth — same pattern as cam-341 / spot-rbac).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        campSite: { findMany: vi.fn() },
        campSiteTeamMember: { findMany: vi.fn() },
        booking: { findMany: vi.fn(), count: vi.fn() },
    },
}));

vi.mock('@/lib/auth-utils', () => ({
    requireAuth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { GET as dashboardGET } from '@/app/api/operator/dashboard/route';

const HOST_ID = 'host-1';
const CAMP = {
    id: 'camp-1',
    nameTh: 'ม่านหมอกภูทับเบิก',
    operatorId: HOST_ID,
    location: null,
    _count: { bookings: 0, reviews: 0 },
};

function req() {
    return new NextRequest('http://localhost/api/operator/dashboard');
}

beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ session: { user: { id: HOST_ID } } });
    (prisma.user.findUnique as any).mockResolvedValue({ id: HOST_ID, role: 'OPERATOR' });
    (prisma.campSiteTeamMember.findMany as any).mockResolvedValue([]);
    (prisma.booking.findMany as any).mockResolvedValue([]);
    (prisma.booking.count as any).mockResolvedValue(0);
});

describe('CAM-349 dashboard listing ships images (AC-1, AC-2, EC-1, BR-1)', () => {
    it('AC-1: campSites[] carries images[0].url when the camp has photos', async () => {
        const withImage = { ...CAMP, images: [{ url: 'https://cdn/a.jpg', sortOrder: 0 }] };
        (prisma.campSite.findMany as any)
            .mockResolvedValueOnce([withImage]) // ownedSites
            .mockResolvedValueOnce([withImage]); // teamCampSites (the listing)

        const res = await dashboardGET(req());
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.campSites?.[0]?.images?.[0]?.url).toBe('https://cdn/a.jpg');
    });

    it('AC-2/EC-1: a photo-less camp ships images: [] (placeholder path, no crash)', async () => {
        const noImage = { ...CAMP, images: [] };
        (prisma.campSite.findMany as any)
            .mockResolvedValueOnce([noImage])
            .mockResolvedValueOnce([noImage]);

        const res = await dashboardGET(req());
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.campSites?.[0]?.images).toEqual([]);
    });

    it('BR-1: the listing query asks for exactly one image, sorted, url-only', async () => {
        const withImage = { ...CAMP, images: [{ url: 'https://cdn/a.jpg', sortOrder: 0 }] };
        (prisma.campSite.findMany as any)
            .mockResolvedValueOnce([withImage])
            .mockResolvedValueOnce([withImage]);

        await dashboardGET(req());

        // Second campSite.findMany call = the teamCampSites listing query.
        const listingCall = (prisma.campSite.findMany as any).mock.calls[1][0];
        expect(listingCall.include.images).toEqual({
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true, sortOrder: true },
        });
    });
});
