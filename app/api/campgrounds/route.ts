import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { campgroundSchema } from '@/lib/validations/campground';
import { z } from 'zod';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const access = searchParams.get('access'); // e.g., BAOT
    const facility = searchParams.get('facility'); // e.g., WIFI

    // Build filter object
    const where: any = {};

    if (type) {
        where.campgroundType = type;
    }

    // SQLite textual search for Array simulation
    if (access) {
        where.accessTypes = {
            contains: access,
        };
    }

    if (facility) {
        where.facilities = {
            contains: facility,
        };
    }

    try {
        const campgrounds = await prisma.campground.findMany({
            where,
            include: {
                location: true,
                sites: true,
            },
        });
        return NextResponse.json(campgrounds);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch campgrounds' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate with Zod
        const validation = campgroundSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation Error', details: validation.error.format() },
                { status: 400 }
            );
        }

        const data = validation.data;

        const campground = await prisma.campground.create({
            data: {
                nameTh: data.nameTh,
                nameEn: data.nameEn,
                nameThSlug: data.nameThSlug,
                nameEnSlug: data.nameEnSlug,
                description: data.description,
                campgroundType: data.campgroundType,

                // Join arrays to string
                accessTypes: data.accessTypes.join(','),
                accommodationTypes: data.accommodationTypes.join(','),
                facilities: data.facilities.join(','),

                latitude: data.latitude,
                longitude: data.longitude,
                checkInTime: data.checkInTime,
                checkOutTime: data.checkOutTime,
                bookingMethod: data.bookingMethod,
                priceLow: data.priceLow,
                priceHigh: data.priceHigh,

                partner: data.partner,
                nationalPark: data.nationalPark,

                locationId: data.locationId,
                operatorId: data.operatorId,
            },
        });

        return NextResponse.json(campground, { status: 201 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create campground' }, { status: 500 });
    }
}
