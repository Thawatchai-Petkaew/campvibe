import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { createLocationSchema } from '@/lib/validations/location';

export async function POST(request: NextRequest) {
    // RISK-6: Location creation requires authentication.
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    // 1. Validate at the boundary before any DB work.
    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const parsed = createLocationSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const { lat, lon, country, province, region, thaiLocationId } = parsed.data;

    try {
        // S5: populate the conformant Country + AdminArea links so live-created camps (not just
        // seeded ones) get a region linkage. Only set countryCode if the Country actually exists
        // (FK-safe); resolve the province AdminArea from the legacy thaiLocationId.
        const wantCountry = (!country || country === 'Thailand') ? 'TH' : country;
        const knownCountry = await prisma.country.findUnique({ where: { code: wantCountry }, select: { code: true } });
        let adminAreaId: string | undefined;
        if (thaiLocationId) {
            const tl = await prisma.thailandLocation.findUnique({ where: { id: thaiLocationId }, select: { provinceCode: true } });
            if (tl) {
                const area = await prisma.adminArea.findUnique({
                    where: { countryCode_level_code: { countryCode: 'TH', level: 'PROVINCE', code: tl.provinceCode } },
                    select: { id: true },
                });
                adminAreaId = area?.id;
            }
        }

        const location = await prisma.location.create({
            data: {
                country: country || 'Thailand',
                province,
                region: region || 'North',
                lat,
                lon,
                thaiLocationId,
                countryCode: knownCountry?.code,
                adminAreaId,
            }
        });

        return NextResponse.json(location, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
    }
}
