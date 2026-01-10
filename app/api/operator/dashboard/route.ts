import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    // In a real app, get session from request
    // For demo, we use the seeded Operator ID
    // You can also pass ?operatorId=... query param to test others
    const operator = await prisma.user.findUnique({
        where: { email: 'operator@campvibe.com' }
    });

    const operatorId = operator?.id || 'default-id';

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
