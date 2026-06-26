import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { assertSeedAllowed } from '@/lib/seed-guard';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();
    const blocked = assertSeedAllowed(session);
    if (blocked) return blocked;

    try {
        console.log('Starting seed...');

        // 1. Create a Default Operator
        const hashedPassword = await bcrypt.hash('password123', 10);
        const operator = await prisma.user.upsert({
            where: { email: 'operator@campvibe.com' },
            update: {},
            create: {
                email: 'operator@campvibe.com',
                name: 'John Vibe',
                role: 'OPERATOR',
                password: hashedPassword
            },
        });

        const campgrounds = [
            {
                nameTh: 'ขอบชลแคมป์ Khob Chon camp',
                nameEn: 'Khob Chon Camp',
                description: 'แคมป์ปิ้งริมน้ำ บรรยากาศเงียบสงบ เหมาะแก่การพักผ่อน',
                campgroundType: 'CAGD',
                province: 'Chiang Mai',
                priceLow: 500,
                priceHigh: 1200,
                lat: 18.9167,
                lon: 98.9667,
                images: [
                    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800',
                    'https://images.unsplash.com/photo-1533575770077-052fa2c609fc?w=800',
                    'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800',
                ].join(','),
            },
            {
                nameTh: 'รัศมีฟาร์ม Ratsamee Farm',
                nameEn: 'Ratsamee Farm',
                description: 'ฟาร์มสเตย์และที่พักแคมป์ปิ้งท่ามกลางธรรมชาติ',
                campgroundType: 'CAGD',
                province: 'Chiang Mai',
                priceLow: 400,
                priceHigh: 1500,
                lat: 18.8167,
                lon: 99.0667,
                images: [
                    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800',
                    'https://images.unsplash.com/photo-1537565266759-34b6f4ee5da9?w=800',
                    'https://images.unsplash.com/photo-1525811902-f2342640856e?w=800',
                ].join(','),
            },
            {
                nameTh: 'ดอยหมอก แคมป์ปิ้ง',
                nameEn: 'Doi Mok Camping',
                description: 'สัมผัสทะเลหมอกบนยอดดอย บรรยากาศเย็นสบายตลอดปี',
                campgroundType: 'CAGD',
                province: 'Chiang Mai',
                priceLow: 600,
                priceHigh: 2000,
                lat: 19.3667,
                lon: 99.1667,
                images: [
                    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
                    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800',
                    'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=800',
                ].join(','),
            }
        ];

        // Clean existing data to avoid duplicates/conflicts on re-seed (Optional, use with caution in real prod)
        // await prisma.campground.deleteMany({}); 

        let createdCount = 0;

        for (const camp of campgrounds) {
            // Check if exists to avoid duplicates
            const existing = await prisma.campSite.findFirst({
                where: { nameEn: camp.nameEn }
            });

            if (!existing) {
                const slug = camp.nameEn.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Math.floor(Math.random() * 1000);

                await prisma.campSite.create({
                    data: {
                        nameTh: camp.nameTh,
                        nameEn: camp.nameEn,
                        nameThSlug: slug,
                        nameEnSlug: slug + '-en',
                        description: camp.description,
                        campSiteType: camp.campgroundType,
                        images: { create: String(camp.images || '').split(',').filter(Boolean).map((url: string, i: number) => ({ url, sortOrder: i })) },
                        accommodationTypes: 'TENT',
                        checkInTime: '14:00',
                        checkOutTime: '12:00',
                        bookingMethod: 'ONLI',
                        priceLow: camp.priceLow,
                        priceHigh: camp.priceHigh,
                        latitude: camp.lat,
                        longitude: camp.lon,
                        isPublished: true,
                        isActive: true,
                        operator: { connect: { id: operator.id } },
                        location: {
                            create: {
                                country: 'Thailand',
                                province: camp.province,
                            },
                        },
                    },
                });
                createdCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Seeding completed. Created ${createdCount} camp sites.`,
            operator: operator.email
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Seeding failed' }, { status: 500 });
    }
}
