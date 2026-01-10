import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    // In a real app, get session from request
    // For demo, we use the seeded Operator ID
    // You can also pass ?operatorId=... query param to test others
    const searchParams = request.nextUrl.searchParams;
    const operatorId = searchParams.get('operatorId') || '4a8dfa9f-b2b3-40b4-baf2-7832ff94e62d';

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
            }
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}
