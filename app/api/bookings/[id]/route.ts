import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    const { id } = await context.params;

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { status } = body;

        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 });
        }

        // Fetch booking to check permissions
        const booking = await prisma.booking.findUnique({
            where: { id },
            include: {
                campground: true
            }
        });

        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // Permissions:
        // 1. Camper can CANCEL their own booking.
        // 2. Operator can CONFIRM or CANCEL bookings at their campground.

        const isCamper = booking.userId === session.user.id;
        const isOperator = booking.campground.operatorId === session.user.id;

        if (!isCamper && !isOperator) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // If camper cancels, status must be CANCELLED
        if (isCamper && !isOperator && status !== 'CANCELLED') {
            return NextResponse.json({ error: 'Campers can only cancel bookings' }, { status: 400 });
        }

        const updatedBooking = await prisma.booking.update({
            where: { id },
            data: { status }
        });

        return NextResponse.json(updatedBooking);

    } catch (error) {
        console.error('Update booking error:', error);
        return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }
}
