import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { bookingSchema } from '@/lib/validations/booking';

export async function POST(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();

        // 1. Validation (Inject session user ID)
        const validation = bookingSchema.safeParse({ ...body, userId: session.user.id });
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation Error', details: validation.error.format() },
                { status: 400 }
            );
        }

        const data = validation.data;
        const checkIn = new Date(data.checkInDate);
        const checkOut = new Date(data.checkOutDate);

        // 2. Check Overlaps
        const existingBooking = await prisma.booking.findFirst({
            where: {
                campgroundId: data.campgroundId,
                siteId: data.siteId,
                status: { not: 'CANCELLED' },
                AND: [
                    { checkInDate: { lt: checkOut } },
                    { checkOutDate: { gt: checkIn } }
                ]
            }
        });

        if (existingBooking) {
            return NextResponse.json(
                { error: 'Dates not available', details: 'Selected dates overlap with an existing booking.' },
                { status: 409 }
            );
        }

        // 3. Price Calculation
        let pricePerNight = 50;

        const campground = await prisma.campground.findUnique({
            where: { id: data.campgroundId },
            include: { sites: true }
        });

        if (!campground) {
            return NextResponse.json({ error: 'Campground not found' }, { status: 404 });
        }

        if (data.siteId) {
            const site = campground.sites.find(s => s.id === data.siteId);
            if (site) {
                pricePerNight = site.pricePerNight;
            }
        } else if (campground.priceLow) {
            pricePerNight = campground.priceLow;
        }

        const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalPrice = pricePerNight * diffDays;

        // 4. Create Booking
        const booking = await prisma.booking.create({
            data: {
                userId: session.user.id,
                campgroundId: data.campgroundId,
                siteId: data.siteId,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                guests: data.guests,
                totalPrice: totalPrice,
                status: 'PENDING' // Start as pending
            }
        });

        return NextResponse.json(booking, { status: 201 });

    } catch (error) {
        console.error('Booking creation error:', error);
        return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const bookings = await prisma.booking.findMany({
            where: { userId: session.user.id },
            include: {
                campground: {
                    select: {
                        nameTh: true,
                        nameEn: true,
                        images: true,
                        location: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(bookings);

    } catch (error) {
        console.error('Fetch bookings error:', error);
        return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }
}
