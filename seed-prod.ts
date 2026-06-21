import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting local seed...');

    // 1. Create a Default Operator
    const operator = await prisma.user.upsert({
        where: { email: 'operator@campvibe.com' },
        update: {},
        create: {
            email: 'operator@campvibe.com',
            name: 'John Vibe',
            role: 'OPERATOR',
        },
    });

    console.log('✅ Operator created');

    const campgrounds = [
        {
            nameTh: 'ขอบชลแคมป์ Khob Chon camp',
            nameEn: 'Khob Chon Camp',
            description: 'แคมป์ปิ้งริมน้ำ บรรยากาศเงียบสงบ เหมาะแก่การพักผ่อน',
            campSiteType: 'CAGD',
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
            campSiteType: 'CAGD',
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
            campSiteType: 'CAGD',
            province: 'Chiang Mai',
            priceLow: 600,
            priceHigh: 2000,
            lat: 19.3667,
            lon: 99.1667,
            images: Array.from({ length: 10 }, (_, i) => `/mockup/campgrounds/pn-valley-camp-472/img-${i}.jpg`).join(','),
        }
    ];

    console.log('🧹 Cleaning existing campgrounds...');
    await prisma.campSite.deleteMany({});
    console.log('✅ Base cleaned');

    for (const camp of campgrounds) {
        const slug = camp.nameEn.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Math.floor(Math.random() * 1000);

        await prisma.campSite.create({
            data: {
                nameTh: camp.nameTh,
                nameEn: camp.nameEn,
                nameThSlug: slug,
                nameEnSlug: slug + '-en',
                description: camp.description,
                campSiteType: camp.campSiteType,
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
        console.log(`✨ Created camp: ${camp.nameEn}`);
    }

    console.log('🚀 Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
