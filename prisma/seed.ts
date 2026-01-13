import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const masterData = [
    // Facility - Internal
    { code: 'SHOW', group: 'Internal facility', nameTh: 'ห้องอาบน้ำ', nameEn: 'Showers', icon: 'ShowerHead' },
    { code: 'TOIL', group: 'Internal facility', nameTh: 'ห้องน้ำ', nameEn: 'Toilet', icon: 'Bath' },
    { code: 'PICN', group: 'Internal facility', nameTh: 'โต๊ะปิคนิค', nameEn: 'Picnictable', icon: 'Table2' },
    { code: 'WIFI', group: 'Internal facility', nameTh: 'ไวไฟ', nameEn: 'Wifi', icon: 'Wifi' },
    { code: 'TRAS', group: 'Internal facility', nameTh: 'ถังขยะ', nameEn: 'Trash', icon: 'Trash2' },
    { code: 'SANI', group: 'Internal facility', nameTh: 'จุดทิ้งสิ่งปฏิกูล', nameEn: 'Sanitary dump', icon: 'Trash' },
    { code: 'POTA', group: 'Internal facility', nameTh: 'ก๊อกน้ำ', nameEn: 'Potable water', icon: 'Droplets' },
    { code: 'ELEC', group: 'Internal facility', nameTh: 'จุดจ่ายไฟฟ้า', nameEn: 'Electrichookups', icon: 'Zap' },
    { code: 'WATE', group: 'Internal facility', nameTh: 'จุดจ่ายน้ำ', nameEn: 'Waterhookups', icon: 'Droplet' },
    { code: 'SINK', group: 'Internal facility', nameTh: 'อ่างล้างจาน', nameEn: 'Sink', icon: 'Utensils' },
    { code: 'CART', group: 'Internal facility', nameTh: 'รถเข็น', nameEn: 'Cart', icon: 'ShoppingCart' },
    { code: 'MIMT', group: 'Internal facility', nameTh: 'ร้านขายของชำ', nameEn: 'Mini mart', icon: 'Store' },
    { code: 'GRIL', group: 'Internal facility', nameTh: 'หมูกระทะ', nameEn: 'Grilled pork', icon: 'UtensilsCrossed' },
    { code: 'CAFE', group: 'Internal facility', nameTh: 'คาเฟ่', nameEn: 'Cafe', icon: 'Coffee' },
    { code: 'REST', group: 'Internal facility', nameTh: 'ร้านอาหาร', nameEn: 'Restuarant', icon: 'Utensils' },
    { code: 'FEIC', group: 'Internal facility', nameTh: 'น้ำแข็งฟรี', nameEn: 'Free ice', icon: 'Snowflake' },
    { code: 'FEDW', group: 'Internal facility', nameTh: 'น้ำดื่มฟรี', nameEn: 'Free drinking water', icon: 'GlassWater' },

    // Equipment
    { code: 'TENT', group: 'Equipment for rent', nameTh: 'เต็นท์', nameEn: 'Tent', icon: 'Tent' },
    { code: 'POWE', group: 'Equipment for rent', nameTh: 'ปลั๊กสนาม', nameEn: 'Power plug', icon: 'Plug' },
    { code: 'TFAN', group: 'Equipment for rent', nameTh: 'พัดลม', nameEn: 'Table fan', icon: 'Fan' },
    { code: 'BLKT', group: 'Equipment for rent', nameTh: 'ผ้าห่ม', nameEn: 'Blanket', icon: 'Bed' },
    { code: 'LEDL', group: 'Equipment for rent', nameTh: 'หลอดไฟ Led', nameEn: 'LED light', icon: 'Lightbulb' },
    { code: 'GDST', group: 'Equipment for rent', nameTh: 'ผ้าปูรองเต็นท์', nameEn: 'Ground sheet', icon: 'Layers' },
    { code: 'SSTV', group: 'Equipment for rent', nameTh: 'เตาถ่าน ขนาดเล็ก', nameEn: 'Small stove', icon: 'Flame' },
    { code: 'LSTV', group: 'Equipment for rent', nameTh: 'เตาถ่าน ขนาดใหญ่', nameEn: 'Large stove', icon: 'Flame' },
    { code: 'CHAI', group: 'Equipment for rent', nameTh: 'เก้าอี้', nameEn: 'Chair', icon: 'Armchair' },
    { code: 'FYST', group: 'Equipment for rent', nameTh: 'ผ้าฟลายชีท', nameEn: 'Fly sheet', icon: 'Umbrella' },
    { code: 'ICBK', group: 'Equipment for rent', nameTh: 'กระติกน้ำแข็ง', nameEn: 'Ice bucket', icon: 'Box' },

    // External
    { code: 'SVEL', group: 'External facility', nameTh: 'เซเว่น', nameEn: '7 Eleven', icon: 'Store' },
    { code: 'LOTS', group: 'External facility', nameTh: 'โลตัส', nameEn: 'Lotus espress', icon: 'ShoppingBag' },
    { code: 'MAKT', group: 'External facility', nameTh: 'ตลาดนัด', nameEn: 'Market', icon: 'ShoppingBasket' },
    { code: 'MIBC', group: 'External facility', nameTh: 'บิ๊กซี', nameEn: 'Mini big c', icon: 'ShoppingCart' },

    // Campground Type
    { code: 'CAGD', group: 'Campground type', nameTh: 'ลานกางกับพื้น', nameEn: 'Campground', icon: 'Tent' },
    { code: 'CACP', group: 'Campground type', nameTh: 'รถเต็นท์', nameEn: 'Car camp', icon: 'Car' },

    // Access Types
    { code: 'BAOT', group: 'Access type', nameTh: 'เรือ', nameEn: 'boat', icon: 'Anchor' },
    { code: 'DRIV', group: 'Access type', nameTh: 'ขับรถ', nameEn: 'drive', icon: 'Car' },
    { code: 'HIKE', group: 'Access type', nameTh: 'ไต่เขา', nameEn: 'hike', icon: 'Mountain' },
    { code: 'WALK', group: 'Access type', nameTh: 'เดิน', nameEn: 'walk', icon: 'Footprints' },

    // Activities
    { code: 'SWIM', group: 'Activity', nameTh: 'ว่ายน้ำ', nameEn: 'Swimming', icon: 'Waves' },
    { code: 'HIKI', group: 'Activity', nameTh: 'เดินเล่น', nameEn: 'Hiking', icon: 'Mountain' },
    { code: 'SURF', group: 'Activity', nameTh: 'เล่นเซิร์ฟ', nameEn: 'Surfing', icon: 'Waves' },
    { code: 'FISH', group: 'Activity', nameTh: 'ตกปลา', nameEn: 'Fishing', icon: 'Fish' },
    { code: 'WILD', group: 'Activity', nameTh: 'ส่องสัตว์ป่า', nameEn: 'Wildlife watching', icon: 'Binoculars' },
    { code: 'BOAT', group: 'Activity', nameTh: 'พายเรือ', nameEn: 'Boating', icon: 'Anchor' },
    { code: 'HORS', group: 'Activity', nameTh: 'ขี่ม้า', nameEn: 'Horseback riding', icon: 'PawPrint' },
    { code: 'OFFR', group: 'Activity', nameTh: 'เส้นทางออฟโรด', nameEn: 'Off-roading (OHV)', icon: 'Car' },
    { code: 'LIVE', group: 'Activity', nameTh: 'ดนตรี สด', nameEn: 'Live music', icon: 'Music' },
    { code: 'CLIM', group: 'Activity', nameTh: 'ปีนเขา', nameEn: 'Climbing', icon: 'Mountain' },

    // Terrain
    { code: 'BEAC', group: 'Terrain', nameTh: 'ชายหาด', nameEn: 'Beach', icon: 'Palmtree' },
    { code: 'FORE', group: 'Terrain', nameTh: 'ป่า', nameEn: 'Forest', icon: 'Trees' },
    { code: 'RIVE', group: 'Terrain', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek', icon: 'Waves' },
    { code: 'MTNS', group: 'Terrain', nameTh: 'ภูเขา (ล้อมรอบด้วยภูเขา)', nameEn: 'Mountainous', icon: 'Mountain' },
]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log('🌱 Start seeding database...')

    // 1. Seed MasterData
    console.log('📊 Seeding MasterData...')
    for (const item of masterData) {
        await prisma.masterData.upsert({
            where: { code: item.code },
            update: item,
            create: item,
        })
    }
    console.log('✅ MasterData seeded')

    // 2. Seed Thailand Locations
    console.log('🗺️ Seeding Thailand locations...')
    const locationsData = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'data/thailand-locations.json'), 'utf8')
    )

    for (const province of locationsData) {
        // Create province entry (district code "")
        await prisma.thailandLocation.upsert({
            where: {
                provinceCode_districtCode: {
                    provinceCode: province.code,
                    districtCode: ""
                }
            },
            update: {
                provinceName: province.nameTh,
                provinceNameEn: province.nameEn,
                districtName: province.nameTh,
                districtNameEn: province.nameEn
            },
            create: {
                provinceCode: province.code,
                provinceName: province.nameTh,
                provinceNameEn: province.nameEn,
                districtCode: "",
                districtName: province.nameTh,
                districtNameEn: province.nameEn
            }
        })

        // Create district entries
        for (const district of province.districts || []) {
            await prisma.thailandLocation.upsert({
                where: {
                    provinceCode_districtCode: {
                        provinceCode: province.code,
                        districtCode: district.code
                    }
                },
                update: {
                    provinceName: province.nameTh,
                    provinceNameEn: province.nameEn,
                    districtName: district.nameTh,
                    districtNameEn: district.nameEn
                },
                create: {
                    provinceCode: province.code,
                    provinceName: province.nameTh,
                    provinceNameEn: province.nameEn,
                    districtCode: district.code,
                    districtName: district.nameTh,
                    districtNameEn: district.nameEn
                }
            })
        }
    }
    console.log('✅ Thailand locations seeded')

    // 3. Create Test Users
    console.log('👥 Creating test users...')
    const hashedPassword = await bcrypt.hash('password123', 10)

    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@campvibe.com' },
        update: {},
        create: {
            email: 'admin@campvibe.com',
            password: hashedPassword,
            name: 'Admin CampVibe',
            role: 'ADMIN'
        }
    })

    const hosterUser = await prisma.user.upsert({
        where: { email: 'hoster@campvibe.com' },
        update: {},
        create: {
            email: 'hoster@campvibe.com',
            password: hashedPassword,
            name: 'Hoster Demo',
            role: 'OPERATOR' // Changed from USER to OPERATOR
        }
    })

    const camperUser = await prisma.user.upsert({
        where: { email: 'camper@campvibe.com' },
        update: {},
        create: {
            email: 'camper@campvibe.com',
            password: hashedPassword,
            name: 'Camper Demo',
            role: 'CAMPER'
        }
    })

    console.log('✅ Test users created')

    // 4. Create 12 Mock Campgrounds
    console.log('🏕️ Creating 12 mock campgrounds...')

    const campgroundsData = [
        {
            nameTh: 'ลานกางเต็นท์ภูทับเบิก',
            nameEn: 'Phu Thap Boek Campground',
            nameThSlug: 'phu-thap-boek-campground-1',
            nameEnSlug: 'phu-thap-boek-campground-en-1',
            description: 'ลานกางเต็นท์บนยอดเขาที่สูงที่สุดในเพชรบูรณ์ วิวสวยงาม อากาศเย็นสบาย',
            campgroundType: 'CAGD',
            accessTypes: 'DRIV',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,WIFI,POTA', // Internal
            externalFacilities: 'SVEL',
            equipment: 'TENT,BLKT,TFAN',
            activities: 'HIKI,WILD,CLIM',
            terrain: 'MTNS,FORE',
            address: 'Tumbol Wang Ban, Amphoe Lom Kao, Phetchabun 67120',
            directions: 'Take Highway 21 to Lom Kao, turn onto Route 2331. Steep climb, drive carefully.',
            videoUrl: 'https://www.youtube.com/watch?v=example1',
            contacts: 'Tel: 056-123-456, FB: PhuThapBoekOfficial',
            feeInfo: 'Entrance fee 20 THB, Tent space 100 THB/person',
            toiletInfo: 'Shared bathrooms with hot showers (coin operated)',
            minimumAge: 0,
            latitude: 16.9764,
            longitude: 101.0814,
            checkInTime: '14:00',
            checkOutTime: '11:00',
            bookingMethod: 'ONLI',
            priceLow: 300,
            priceHigh: 800,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์เขาใหญ่',
            nameEn: 'Khao Yai Camping Site',
            nameThSlug: 'khao-yai-camping-site-2',
            nameEnSlug: 'khao-yai-camping-site-en-2',
            description: 'ลานกางเต็นท์ในอุทยานแห่งชาติเขาใหญ่ ใกล้น้ำตก ธรรมชาติสวยงาม',
            campgroundType: 'CAGD',
            accessTypes: 'DRIV,WALK',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,PICN,TRAS,POTA',
            externalFacilities: 'LOTS,MAKT',
            equipment: 'TENT,GDST,SSTV',
            activities: 'HIKI,WILD',
            terrain: 'FORE,MTNS',
            address: 'Moo 1, Tambon Hin Tung, Amphoe Mueang, Nakhon Nayok 26000',
            directions: 'Enter via Pak Chong entrance. Follow signs to Lam Ta Khong campsite.',
            videoUrl: 'https://www.youtube.com/watch?v=example2',
            contacts: 'Tel: 037-319-002',
            feeInfo: 'Park entrance: 40 THB (Thai), 400 THB (Foreigner). Camping: 30 THB/night.',
            toiletInfo: 'Clean restrooms, cold showers only.',
            minimumAge: 0,
            latitude: 14.4426,
            longitude: 101.3717,
            checkInTime: '13:00',
            checkOutTime: '12:00',
            bookingMethod: 'ONLI',
            priceLow: 250,
            priceHigh: 600,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์ดอยอ่างขาง',
            nameEn: 'Doi Ang Khang Campsite',
            nameThSlug: 'doi-ang-khang-campsite-3',
            nameEnSlug: 'doi-ang-khang-campsite-en-3',
            description: 'ลานกางเต็นท์บนดอยอ่างขาง อากาศหนาวเย็น วิวทะเลหมอกสวยงาม',
            campgroundType: 'CACP',
            accessTypes: 'DRIV',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,WIFI,CAFE,MIMT',
            externalFacilities: '',
            equipment: 'TENT,BLKT,LEDL',
            activities: 'HIKI,WILD',
            terrain: 'MTNS,FORE',
            address: 'Moo 5, Tambon Mon Pin, Amphoe Fang, Chiang Mai 50110',
            directions: 'Take Route 107 north from Chiang Mai, turn left onto Route 1249.',
            videoUrl: '',
            contacts: 'Tel: 053-450-107',
            feeInfo: 'Tent rental available 225 THB/night.',
            toiletInfo: 'Western style toilets, hot water available.',
            minimumAge: 12,
            latitude: 19.9286,
            longitude: 99.0506,
            checkInTime: '14:00',
            checkOutTime: '11:00',
            bookingMethod: 'ONLI',
            priceLow: 400,
            priceHigh: 1000,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์ปางอุ๋ง',
            nameEn: 'Pang Ung Lakeside Camp',
            nameThSlug: 'pang-ung-lakeside-camp-4',
            nameEnSlug: 'pang-ung-lakeside-camp-en-4',
            description: 'ลานกางเต็นท์ริมทะเลสาบปางอุ๋ง บรรยากาศสไตล์สวิตเซอร์แลนด์',
            campgroundType: 'CAGD',
            accessTypes: 'DRIV',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,REST,POTA,PICN',
            externalFacilities: 'SVEL',
            equipment: 'CHAI,ICBK',
            activities: 'BOAT,FISH,WILD',
            terrain: 'RIVE,FORE',
            address: 'Ban Ruam Thai, Tambon Mok Cham Pae, Amphoe Mueang, Mae Hong Son 58000',
            directions: 'Drive from Mae Hong Son city for 44km. Narrow winding road.',
            videoUrl: 'https://www.youtube.com/watch?v=pangung',
            contacts: 'Tel: 080-123-4567, Line: @pangung',
            feeInfo: 'Entry 20 THB. Raft boarding 150 THB.',
            toiletInfo: 'Basic facilities, bring own toiletries.',
            minimumAge: 0,
            latitude: 19.5833,
            longitude: 97.9167,
            checkInTime: '14:00',
            checkOutTime: '11:00',
            bookingMethod: 'ONLI',
            priceLow: 350,
            priceHigh: 900,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์หาดไร่เลย์',
            nameEn: 'Railay Beach Camping',
            nameThSlug: 'railay-beach-camping-5',
            nameEnSlug: 'railay-beach-camping-en-5',
            description: 'ลานกางเต็นท์ริมหาดไร่เลย์ กระบี่ วิวทะเลสวยงาม เหมาะกับนักปีนเขา',
            campgroundType: 'CAGD',
            accessTypes: 'BAOT',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,REST,CAFE',
            externalFacilities: 'LOTS,MIBC',
            equipment: 'TENT,FYST,POWE',
            activities: 'SWIM,CLIM,SURF,BOAT',
            terrain: 'BEAC',
            address: 'Ao Nang, Mueang Krabi District, Krabi 81000',
            directions: 'Access by long-tail boat only from Ao Nang or Ao Nam Mao.',
            videoUrl: '',
            contacts: 'Boat Co-op: 075-637-290',
            feeInfo: 'Boat fare 100 THB/person. Camping fee depends on zone.',
            toiletInfo: 'Public restrooms available near walking street.',
            minimumAge: 15,
            latitude: 8.0119,
            longitude: 98.8394,
            checkInTime: '13:00',
            checkOutTime: '12:00',
            bookingMethod: 'ONCA',
            priceLow: 500,
            priceHigh: 1200,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์เขาค้อ',
            nameEn: 'Khao Kho Mountain Camp',
            nameThSlug: 'khao-kho-mountain-camp-6',
            nameEnSlug: 'khao-kho-mountain-camp-en-6',
            description: 'ลานกางเต็นท์บนเขาค้อ วิวทะเลหมอก อากาศเย็นสบาย',
            campgroundType: 'CACP',
            accessTypes: 'DRIV',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,WIFI,CAFE,ELEC',
            externalFacilities: 'SVEL,MAKT',
            equipment: 'TENT,BLKT,TFAN,POWE',
            activities: 'HIKI,WILD',
            terrain: 'MTNS',
            address: 'Tung Samo, Khao Kho, Phetchabun 67270',
            directions: 'Route 12, near the wind turbines.',
            videoUrl: '',
            contacts: 'FB: KhaoKhoCamp',
            feeInfo: '500 THB per tent (own tent). Rental 1500 THB.',
            toiletInfo: 'Private bathrooms for VIP zone. Shared for others.',
            minimumAge: 0,
            latitude: 16.6333,
            longitude: 101.0667,
            checkInTime: '14:00',
            checkOutTime: '11:00',
            bookingMethod: 'ONLI',
            priceLow: 350,
            priceHigh: 850,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์ภูกระดึง',
            nameEn: 'Phu Kradueng National Park Camp',
            nameThSlug: 'phu-kradueng-camp-7',
            nameEnSlug: 'phu-kradueng-camp-en-7',
            description: 'ลานกางเต็นท์ในอุทยานแห่งชาติภูกระดึง ธรรมชาติสวยงาม',
            campgroundType: 'CAGD',
            accessTypes: 'HIKE',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,POTA,PICN',
            externalFacilities: '',
            equipment: 'TENT',
            activities: 'HIKI,WILD',
            terrain: 'MTNS,FORE',
            address: 'Moo 1, Ban Si Than, Amphoe Phu Kradueng, Loei 42180',
            directions: 'Hike 9km from the base. Porter service available.',
            videoUrl: 'https://vimeo.com/12345678',
            contacts: 'DNP Contact Center: 1362',
            feeInfo: 'Park fee 40 THB. Porter 30 THB/kg.',
            toiletInfo: 'Simple squat toilets. Cold water buckets.',
            minimumAge: 7,
            latitude: 16.9167,
            longitude: 101.8500,
            checkInTime: '14:00',
            checkOutTime: '10:00',
            bookingMethod: 'ONLI',
            priceLow: 200,
            priceHigh: 500,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์เกาะช้าง',
            nameEn: 'Koh Chang Island Camping',
            nameThSlug: 'koh-chang-island-camping-8',
            nameEnSlug: 'koh-chang-island-camping-en-8',
            description: 'ลานกางเต็นท์ริมหาดเกาะช้าง บรรยากาศเงียบสงบ',
            campgroundType: 'CAGD',
            accessTypes: 'BAOT,DRIV',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,REST,CAFE',
            externalFacilities: 'SVEL,LOTS,MIBC',
            equipment: 'TENT,CHAI,FYST',
            activities: 'SWIM,FISH,BOAT',
            terrain: 'BEAC',
            address: 'Koh Chang Tai, Koh Chang District, Trat 23170',
            directions: 'Ferry from Trat (Ao Thammachat pier).',
            videoUrl: '',
            contacts: 'Resort Tel: 039-555-123',
            feeInfo: 'Ferry 80 THB. Camping 200 THB/night.',
            toiletInfo: 'Standard resort facilities.',
            minimumAge: 0,
            latitude: 12.0431,
            longitude: 102.3358,
            checkInTime: '13:00',
            checkOutTime: '12:00',
            bookingMethod: 'ONCA',
            priceLow: 400,
            priceHigh: 1000,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์ดอยสุเทพ',
            nameEn: 'Doi Suthep Viewpoint Camp',
            nameThSlug: 'doi-suthep-viewpoint-camp-9',
            nameEnSlug: 'doi-suthep-viewpoint-camp-en-9',
            description: 'ลานกางเต็นท์บนดอยสุเทพ วิวเมืองเชียงใหม่สวยงาม',
            campgroundType: 'CAGD',
            accessTypes: 'DRIV,HIKE',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,WIFI,POTA',
            externalFacilities: 'MAKT',
            equipment: 'TENT,BLKT',
            activities: 'HIKI,WILD',
            terrain: 'MTNS,FORE',
            address: 'Suthep, Mueang Chiang Mai District, Chiang Mai 50200',
            directions: 'Drive past Doi Suthep temple for 4km.',
            videoUrl: '',
            contacts: 'Pui National Park: 053-210-244',
            feeInfo: '30 THB entry. 30 THB camping fee.',
            toiletInfo: 'Clean and well maintained.',
            minimumAge: 0,
            latitude: 18.8047,
            longitude: 98.9217,
            checkInTime: '14:00',
            checkOutTime: '11:00',
            bookingMethod: 'ONLI',
            priceLow: 300,
            priceHigh: 700,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์เขาสก',
            nameEn: 'Khao Sok Jungle Camp',
            nameThSlug: 'khao-sok-jungle-camp-10',
            nameEnSlug: 'khao-sok-jungle-camp-en-10',
            description: 'ลานกางเต็นท์ในป่าเขาสก ธรรมชาติอุดมสมบูรณ์',
            campgroundType: 'CAGD',
            accessTypes: 'DRIV,BOAT',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,REST,POTA',
            externalFacilities: '',
            equipment: 'TENT,GDST',
            activities: 'HIKI,WILD,BOAT',
            terrain: 'FORE,RIVE',
            address: 'Khlong Sok, Phanom District, Surat Thani 84250',
            directions: 'Route 401 from Surat Thani town.',
            videoUrl: '',
            contacts: 'Tel: 077-395-139',
            feeInfo: 'Call for raft house prices (approx 2000 THB/night).',
            toiletInfo: 'En-suite mostly.',
            minimumAge: 5,
            latitude: 8.9156,
            longitude: 98.5314,
            checkInTime: '13:00',
            checkOutTime: '11:00',
            bookingMethod: 'ONLI',
            priceLow: 350,
            priceHigh: 900,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์ภูชี้ฟ้า',
            nameEn: 'Phu Chi Fa Sunrise Camp',
            nameThSlug: 'phu-chi-fa-sunrise-camp-11',
            nameEnSlug: 'phu-chi-fa-sunrise-camp-en-11',
            description: 'ลานกางเต็นท์บนภูชี้ฟ้า ชมพระอาทิตย์ขึ้นสวยงาม',
            campgroundType: 'CAGD',
            accessTypes: 'DRIV',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,CAFE,POTA',
            externalFacilities: 'SVEL',
            equipment: 'TENT,BLKT,LEDL',
            activities: 'HIKI,WILD',
            terrain: 'MTNS',
            address: 'Tap Tao, Thoeng District, Chiang Rai 57160',
            directions: 'Steep winding road. 2 hours from Chiang Rai city.',
            videoUrl: '',
            contacts: 'Local admin: 053-795-345',
            feeInfo: 'Free parking. Shuttle bus to peak 20 THB.',
            toiletInfo: 'Public toilets at base camp.',
            minimumAge: 0,
            latitude: 20.4667,
            longitude: 100.9833,
            checkInTime: '14:00',
            checkOutTime: '10:00',
            bookingMethod: 'ONLI',
            priceLow: 250,
            priceHigh: 600,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800'
        },
        {
            nameTh: 'ลานกางเต็นท์หาดป่าตอง',
            nameEn: 'Patong Beach Camping Zone',
            nameThSlug: 'patong-beach-camping-zone-12',
            nameEnSlug: 'patong-beach-camping-zone-en-12',
            description: 'ลานกางเต็นท์ริมหาดป่าตอง ภูเก็ต ใกล้แหล่งบันเทิง',
            campgroundType: 'CAGD',
            accessTypes: 'DRIV',
            accommodationTypes: 'TENT',
            facilities: 'TOIL,SHOW,WIFI,REST,CAFE',
            externalFacilities: 'SVEL,LOTS',
            equipment: 'TENT,POWE,BLKT',
            activities: 'SWIM,SURF,LIVE',
            terrain: 'BEAC',
            address: 'Patong, Kathu District, Phuket 83150',
            directions: 'Beachfront road, near Bangla walking street.',
            videoUrl: '',
            contacts: 'Hotel concierge',
            feeInfo: 'Glamping packages start at 2500 THB.',
            toiletInfo: 'Luxury private bathrooms.',
            minimumAge: 18,
            latitude: 7.8965,
            longitude: 98.3005,
            checkInTime: '13:00',
            checkOutTime: '12:00',
            bookingMethod: 'ONLI',
            priceLow: 500,
            priceHigh: 1500,
            isVerified: true,
            isActive: true,
            isPublished: true,
            images: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800'
        }
    ]

    for (const campData of campgroundsData) {
        // Find suitable ThailandLocation for this campground's province
        // For mock data, we'll try to match provinceNameEn
        let provinceNameEn = "";
        if (campData.nameEn.includes("Phu Thap Boek") || campData.nameEn.includes("Khao Kho")) provinceNameEn = "Phetchabun";
        else if (campData.nameEn.includes("Khao Yai")) provinceNameEn = "Nakhon Ratchasima";
        else if (campData.nameEn.includes("Doi Ang Khang") || campData.nameEn.includes("Doi Suthep")) provinceNameEn = "Chiang Mai";
        else if (campData.nameEn.includes("Pang Ung")) provinceNameEn = "Mae Hong Son";
        else if (campData.nameEn.includes("Railay")) provinceNameEn = "Krabi";
        else if (campData.nameEn.includes("Phu Kradueng")) provinceNameEn = "Loei";
        else if (campData.nameEn.includes("Koh Chang")) provinceNameEn = "Trat";
        else if (campData.nameEn.includes("Khao Sok")) provinceNameEn = "Surat Thani";
        else if (campData.nameEn.includes("Phu Chi Fa")) provinceNameEn = "Chiang Rai";
        else if (campData.nameEn.includes("Patong")) provinceNameEn = "Phuket";

        const thaiLoc = await prisma.thailandLocation.findFirst({
            where: {
                provinceNameEn: provinceNameEn,
                districtCode: "" // Province record
            }
        });

        // Create or update location
        const location = await prisma.location.create({
            data: {
                country: 'Thailand',
                province: provinceNameEn || 'Unknown',
                lat: campData.latitude,
                lon: campData.longitude,
                thaiLocationId: thaiLoc?.id
            }
        });

        // Create or update campground
        await prisma.campground.upsert({
            where: { nameThSlug: campData.nameThSlug },
            update: {
                ...campData,
                locationId: location.id,
                operatorId: hosterUser.id
            },
            create: {
                ...campData,
                locationId: location.id,
                operatorId: hosterUser.id
            },

        });
    }

    console.log('✅ 12 campgrounds created')
    console.log('\n🎉 Seeding completed successfully!')
    console.log('\n📝 Test Credentials:')
    console.log('   Admin:  admin@campvibe.com / password123')
    console.log('   Hoster: hoster@campvibe.com / password123')
    console.log('   Camper: camper@campvibe.com / password123')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error('❌ Seeding failed:', e)
        await prisma.$disconnect()
        process.exit(1)
    })
