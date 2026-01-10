import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { campgroundSchema } from '@/lib/validations/campground';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const campground = await prisma.campground.findUnique({
            where: { id },
            include: { location: true }
        });

        if (!campground) {
            return NextResponse.json({ error: 'Campground not found' }, { status: 404 });
        }

        return NextResponse.json(campground);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch campground' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Verify ownership
        const existing = await prisma.campground.findUnique({
            where: { id },
            include: { operator: true }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Campground not found' }, { status: 404 });
        }

        if (existing.operator.email !== session.user.email) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        // Validate with Zod (partial validation or reuse schema)
        const validation = campgroundSchema.partial().safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: 'Validation Error', details: validation.error.format() }, { status: 400 });
        }
        const data = validation.data;

        // Update Location (if needed) - Simplified: Assuming location ID doesn't change, just update fields
        // Update Location (if needed)
        if (data.locationId && (body as any).province) {
            await prisma.location.update({
                where: { id: data.locationId },
                data: {
                    province: (body as any).province,
                    lat: data.latitude,
                    lon: data.longitude
                }
            });
        }

        const updated = await prisma.campground.update({
            where: { id },
            data: {
                nameTh: data.nameTh,
                nameEn: data.nameEn,
                description: data.description,
                campgroundType: data.campgroundType,
                accessTypes: data.accessTypes?.join(','),
                accommodationTypes: data.accommodationTypes?.join(','),
                facilities: data.facilities?.join(','),
                latitude: data.latitude,
                longitude: data.longitude,
                checkInTime: data.checkInTime,
                checkOutTime: data.checkOutTime,
                bookingMethod: data.bookingMethod,
                priceLow: data.priceLow,
                priceHigh: data.priceHigh,
                images: data.images?.join(',')
            }
        });

        return NextResponse.json(updated);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update campground' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const existing = await prisma.campground.findUnique({
            where: { id },
            include: { operator: true }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Campground not found' }, { status: 404 });
        }

        if (existing.operator.email !== session.user.email) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.campground.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete campground' }, { status: 500 });
    }
}
