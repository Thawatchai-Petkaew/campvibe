import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PROVINCES = [
    'Chiang Mai', 'Kanchanaburi', 'Phetchaburi', 'Nakhon Ratchasima',
    'Ratchaburi', 'Chachoengsao', 'Prachuap Khiri Khan', 'Rayong',
    'Trat', 'Surat Thani', 'Nan', 'Phrae', 'Loei', 'Chaiyaphum'
];

const ADJECTIVES = ['Green', 'Quiet', 'Beautiful', 'Golden', 'Cool', 'Mist', 'Sunny', 'Wild', 'Deep', 'Secret'];
const NOUNS = ['Valley', 'Mountain', 'River', 'Forest', 'Peak', 'Glade', 'Ridge', 'Creek', 'Camp', 'Paradise'];

const CG_TYPES = ['CAGD', 'CACP', 'GLAMP'];
const ACCESS_TYPES = ['DRIV', 'HIKE', 'BAOT', 'BIKE'];
const ACCOM_TYPES = ['TENT', 'CABI', 'TRAI', 'GLAM'];
const FACILITIES = ['WIFI', 'TOIL', 'SHOW', 'KITC', 'PARK', 'FIRE', 'WATR', 'SECU'];

function getRandom(arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomCSV(arr: any[], count: number = 3) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).join(',');
}

function slugify(text: string) {
    return text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
}

export async function POST() {
    try {
        // 1. Clear existing data
        await prisma.booking.deleteMany();
        await prisma.review.deleteMany();
        await prisma.site.deleteMany();
        await prisma.campground.deleteMany();
        await prisma.location.deleteMany();

        // 2. Ensure Operator exists
        const operator = await prisma.user.upsert({
            where: { email: 'operator@campvibe.com' },
            update: {},
            create: {
                email: 'operator@campvibe.com',
                name: 'John Operator',
                role: 'OPERATOR',
            },
        });

        // 3. Generate 100 campgrounds
        for (let i = 1; i <= 100; i++) {
            const province = getRandom(PROVINCES);
            const adj = getRandom(ADJECTIVES);
            const noun = getRandom(NOUNS);
            const nameEn = `${adj} ${noun} ${i}`;
            const nameTh = `${adj} ${noun} (ไทย) ${i}`;

            const location = await prisma.location.create({
                data: {
                    country: 'Thailand',
                    province: province,
                    lat: 13.0 + Math.random() * 6.0,
                    lon: 98.0 + Math.random() * 4.0,
                }
            });

            const campground = await prisma.campground.create({
                data: {
                    nameEn,
                    nameTh,
                    nameEnSlug: slugify(nameEn),
                    nameThSlug: slugify(nameTh),
                    description: `Experience the beauty of ${nameEn} in the heart of ${province}.`,
                    campgroundType: getRandom(CG_TYPES),
                    accessTypes: getRandomCSV(ACCESS_TYPES, 2),
                    accommodationTypes: getRandomCSV(ACCOM_TYPES, 2),
                    facilities: getRandomCSV(FACILITIES, 4),
                    latitude: location.lat!,
                    longitude: location.lon!,
                    checkInTime: '14:00',
                    checkOutTime: '12:00',
                    bookingMethod: 'ONLI',
                    priceLow: 300 + Math.floor(Math.random() * 500),
                    priceHigh: 1000 + Math.floor(Math.random() * 2000),
                    isVerified: Math.random() > 0.3,
                    isActive: true,
                    isPublished: true,
                    operatorId: operator.id,
                    locationId: location.id,
                }
            });

            // Add 2-5 sites per campground
            const siteCount = 2 + Math.floor(Math.random() * 4);
            for (let j = 1; j <= siteCount; j++) {
                await prisma.site.create({
                    data: {
                        name: `Site ${j}`,
                        maxCampers: 2 + Math.floor(Math.random() * 6),
                        maxTents: 1 + Math.floor(Math.random() * 2),
                        pricePerNight: (campground.priceLow || 300) + (j * 50),
                        campgroundId: campground.id,
                    }
                });
            }
        }

        return NextResponse.json({ success: true, message: '100 campgrounds and their sites seeded successfully.' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Bulk seeding failed', details: String(error) }, { status: 500 });
    }
}
