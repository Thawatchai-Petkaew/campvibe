import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const operator = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    const operatorId = operator?.id;

    if (!operatorId) {
        return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    try {
        const campgrounds = await prisma.campground.findMany({
            where: { operatorId },
            include: {
                _count: {
                    select: { bookings: true, reviews: true }
                }
            }
        });

        const bookings = await prisma.booking.findMany({
            where: {
                campground: {
                    operatorId
                }
            },
            include: {
                user: { select: { name: true, email: true } },
                campground: { select: { nameTh: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate Stats
        const totalRevenue = bookings
            .filter(b => b.status !== 'CANCELLED')
            .reduce((sum, b) => sum + b.totalPrice, 0);

        return NextResponse.json({
            campgrounds,
            bookings,
            stats: {
                totalRevenue,
                totalBookings: bookings.length,
                campgroundCount: campgrounds.length
            },
            operator
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}
