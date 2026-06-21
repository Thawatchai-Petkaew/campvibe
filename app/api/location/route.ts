import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // S5: populate the conformant Country + AdminArea links so live-created camps (not just
        // seeded ones) get a region linkage. Only set countryCode if the Country actually exists
        // (FK-safe); resolve the province AdminArea from the legacy thaiLocationId.
        const wantCountry = (!body.country || body.country === 'Thailand') ? 'TH' : String(body.country);
        const knownCountry = await prisma.country.findUnique({ where: { code: wantCountry }, select: { code: true } });
        let adminAreaId: string | undefined;
        if (body.thaiLocationId) {
            const tl = await prisma.thailandLocation.findUnique({ where: { id: body.thaiLocationId }, select: { provinceCode: true } });
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
                country: body.country || "Thailand",
                province: body.province,
                region: body.region || "North",
                lat: body.lat,
                lon: body.lon,
                thaiLocationId: body.thaiLocationId,
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
