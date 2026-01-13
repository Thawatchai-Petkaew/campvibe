
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sort = searchParams.get('sort') || 'desc';

    try {
        // Build the where clause
        const where: any = {
            campground: {
                operatorId: session.user.id
            }
        };

        if (status && status !== 'ALL') {
            where.status = status;
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                campground: {
                    select: {
                        nameTh: true,
                        nameEn: true,
                        images: true
                    }
                },
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: sort === 'asc' ? 'asc' : 'desc'
            }
        });

        return NextResponse.json(bookings);
    } catch (error) {
        console.error('Fetch operator bookings error:', error);
        return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }
}
