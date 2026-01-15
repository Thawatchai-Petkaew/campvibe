import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log('🌱 Starting production seed...');

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
                images: Array.from({ length: 10 }, (_, i) => `/mockup/campgrounds/khob-chon-camp-935/img-${i}.${i < 8 ? 'jpeg' : 'jpg'}`).join(','),
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
                images: Array.from({ length: 10 }, (_, i) => `/mockup/campgrounds/ratsamee-farm-86/img-${i}.jpg`).join(','),
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
                images: Array.from({ length: 10 }, (_, i) => `/mockup/campgrounds/pn-valley-camp-472/img-${i}.jpg`).join(','),
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
                        images: camp.images,
                        accessTypes: 'DRIV',
                        accommodationTypes: 'TENT',
                        facilities: 'TOIL,SHOW',
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
        return NextResponse.json({ error: 'Seeding failed', details: String(error) }, { status: 500 });
    }
}
