import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const location = await prisma.location.create({
            data: {
                country: body.country || "Thailand",
                province: body.province,
                region: body.region || "North",
                lat: body.lat,
                lon: body.lon,
                thaiLocationId: body.thaiLocationId
            }
        });

        return NextResponse.json(location, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
    }
}
