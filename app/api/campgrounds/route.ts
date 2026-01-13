import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { campgroundSchema } from '@/lib/validations/campground';
import { z } from 'zod';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const minPrice = searchParams.get('min');
    const maxPrice = searchParams.get('max');

    // CSV params
    // CSV params
    const access = searchParams.get('access');
    const facilities = searchParams.get('facilities');
    const external = searchParams.get('external');
    const equipment = searchParams.get('equipment');
    const activities = searchParams.get('activities');
    const terrain = searchParams.get('terrain');

    // Build filter object
    const where: any = {
        isActive: true,
        isPublished: true
    };

    if (type && type !== 'ALL') {
        where.campgroundType = type;
    }

    // Price Filter
    if (minPrice || maxPrice) {
        where.priceLow = {};
        if (minPrice) where.priceLow.gte = parseFloat(minPrice);
        if (maxPrice) where.priceLow.lte = parseFloat(maxPrice);
    }

    // Helper for multi-select AND logic
    const addMultiSelectFilter = (field: string, param: string | null) => {
        if (!param) return;
        const codes = param.split(',').filter(Boolean);
        if (codes.length > 0) {
            where.AND = where.AND || [];
            codes.forEach(code => {
                where.AND.push({
                    [field]: { contains: code }
                });
            });
        }
    };

    addMultiSelectFilter('accessTypes', access);
    addMultiSelectFilter('facilities', facilities);
    addMultiSelectFilter('externalFacilities', external);
    addMultiSelectFilter('equipment', equipment);
    addMultiSelectFilter('activities', activities);
    addMultiSelectFilter('terrain', terrain);

    try {
        const campgrounds = await prisma.campground.findMany({
            where,
            include: {
                location: true,
                sites: true,
                reviews: { select: { rating: true } }
            },
        });
        return NextResponse.json(campgrounds);
    } catch (error) {
        console.error("Fetch error:", error);
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
                externalFacilities: data.externalFacilities?.join(','),
                equipment: data.equipment?.join(','),
                activities: data.activities?.join(','),
                terrain: data.terrain?.join(','),

                address: data.address,
                directions: data.directions,
                videoUrl: data.videoUrl,
                contacts: data.contacts,
                feeInfo: data.feeInfo,
                toiletInfo: data.toiletInfo,
                minimumAge: data.minimumAge,

                latitude: data.latitude,
                longitude: data.longitude,
                checkInTime: data.checkInTime,
                checkOutTime: data.checkOutTime,
                bookingMethod: data.bookingMethod,
                priceLow: data.priceLow,
                priceHigh: data.priceHigh,

                partner: data.partner,
                nationalPark: data.nationalPark,
                images: data.images?.join(','),

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
