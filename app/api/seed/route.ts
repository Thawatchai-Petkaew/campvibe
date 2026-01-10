import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Create Operator
        const operator = await prisma.user.upsert({
            where: { email: 'operator@campvibe.com' },
            update: {},
            create: {
                email: 'operator@campvibe.com',
                name: 'John Operator',
                role: 'OPERATOR',
            },
        });

        // Create Location
        const location = await prisma.location.create({
            data: {
                country: 'Thailand',
                region: 'North',
                province: 'Chiang Mai',
                district: 'Mae Rim',
                lat: 18.90,
                lon: 98.95
            }
        });

        return NextResponse.json({ success: true, operator, location });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Seeding failed', details: String(error) }, { status: 500 });
    }
}
