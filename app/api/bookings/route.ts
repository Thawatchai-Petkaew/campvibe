import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bookingSchema } from '@/lib/validations/booking';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 1. Validation
        const validation = bookingSchema.safeParse(body);
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
        // Logic: (ExistingStart < NewEnd) AND (ExistingEnd > NewStart)
        const existingBooking = await prisma.booking.findFirst({
            where: {
                campgroundId: data.campgroundId,
                siteId: data.siteId, // If null, checks general campground bookings (unlikely in real world but OK for now)
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
        // In a real app, we'd fetch price from Site or Campground. For now, assume fixed price logic or fetch.
        let pricePerNight = 50; // Default fallback

        // Fetch campground/site to get actual price
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
                userId: data.userId,
                campgroundId: data.campgroundId,
                siteId: data.siteId,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                guests: data.guests,
                totalPrice: totalPrice,
                status: 'CONFIRMED'
            }
        });

        return NextResponse.json(booking, { status: 201 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }
}
