import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reviewSchema } from '@/lib/validations/review';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 1. Validation
        const validation = reviewSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation Error', details: validation.error.format() },
                { status: 400 }
            );
        }

        const data = validation.data;

        // 2. Check if Campground exists
        const campground = await prisma.campground.findUnique({
            where: { id: data.campgroundId }
        });

        if (!campground) {
            return NextResponse.json({ error: 'Campground not found' }, { status: 404 });
        }

        // 3. (Optional) Check for verified stay using Booking
        // This is where "Verify Stay" logic would go:
        // const hasBooking = await prisma.booking.findFirst({ ... })

        // 4. Create Review
        const review = await prisma.review.create({
            data: {
                authorId: data.authorId,
                campgroundId: data.campgroundId,
                rating: data.rating,
                title: data.title || '',
                content: data.content,
                visitDate: data.visitDate ? new Date(data.visitDate) : new Date(),
            }
        });

        return NextResponse.json(review, { status: 201 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
    }
}
