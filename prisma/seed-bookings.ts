
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env.local' }); // Load .env.local

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding mock bookings...');

  // 1. Find the current HOST user (Assuming the first user with HOST/ADMIN role or specific email)
  const hostUser = await prisma.user.findFirst({
    where: { 
        OR: [
            { role: 'OPERATOR' },
            { role: 'ADMIN' },
            { email: 'hoster@campvibe.com' } // Fallback to the seeded host account
        ]
    }
  });

  if (!hostUser) {
    console.error('❌ No HOST user found. Please ensure you have a host account.');
    return;
  }
  console.log(`👤 Using Host User: ${hostUser.email} (${hostUser.id})`);

  // 2. Get Camp Sites owned by this Host
  let campSites = await prisma.campSite.findMany({
    where: { operatorId: hostUser.id }
  });

  if (campSites.length === 0) {
    console.log('⚠️ This host has no camp sites. Creating 3 mock camp sites...');
    
    // Need a location first
    const location = await prisma.location.findFirst() || await prisma.location.create({
        data: {
            country: 'Thailand',
            province: 'Chiang Mai',
            district: 'Mae Rim',
            lat: 18.8790,
            lon: 98.9870
        }
    });

    const createdSites = await Promise.all(
        Array.from({ length: 3 }).map((_, i) => 
            prisma.campSite.create({
                data: {
                    nameTh: `แคมป์ตัวอย่าง ${i + 1} ของ Host`,
                    nameEn: `Host Mock Camp ${i + 1}`,
                    nameThSlug: `host-mock-camp-${i + 1}`,
                    nameEnSlug: `host-mock-camp-${i + 1}`,
                    operatorId: hostUser.id,
                    locationId: location.id,
                    priceLow: 500 + (i * 100),
                    description: 'Mock description for testing',
                    campSiteType: 'CAMPGROUND',
                    accommodationTypes: 'TENT',
                    checkInTime: '14:00',
                    checkOutTime: '12:00',
                    bookingMethod: 'ONLI',
                    isVerified: true,
                    isActive: true,
                    isPublished: true,
                    images: { create: [{ url: '/placeholder-camp.svg', sortOrder: 0 }] }, // Default placeholder image
                    latitude: 18.7883,
                    longitude: 98.9853
                }
            })
        )
    );
    campSites = createdSites;
    console.log(`🏕️ Created ${campSites.length} mock camp sites.`);
  } else {
    console.log(`🏕️ Found ${campSites.length} camp sites for this host.`);
  }

  // 3. Get all Users (assume 'USER' role are guests) - excluding the host
  const users = await prisma.user.findMany({
    where: {
        role: 'CAMPER',
        NOT: { id: hostUser.id }
    }
  });

  if (users.length === 0) {
    console.log('⚠️ No users with role USER found. Creating mock users...');
    // Create mock users if none exist
    const mockUsers = await Promise.all(
      Array.from({ length: 5 }).map((_, i) =>
        prisma.user.create({
          data: {
            email: `mockuser_new_${i + 1}@example.com`,
            name: `Mock User ${i + 1}`,
            role: 'CAMPER',
            password: 'password123' 
          }
        })
      )
    );
    users.push(...mockUsers);
  }

  // 4. Create 20 Mock Bookings for this Host
  const statuses = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
  
  for (let i = 0; i < 20; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const randomCampSite = campSites[Math.floor(Math.random() * campSites.length)];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Random dates within next 3 months
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + Math.floor(Math.random() * 90));
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 5) + 1); // 1-5 nights

    const guests = Math.floor(Math.random() * 4) + 1;
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    const unitPrice = Number(randomCampSite.priceLow ?? 500);
    const totalPrice = unitPrice * nights; // mirror API price math (no guests multiplier) so unit*nights === total

    await prisma.booking.create({
      data: {
        userId: randomUser.id,
        campSiteId: randomCampSite.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests: guests,
        totalPrice: totalPrice,
        currency: 'THB',
        status: randomStatus,
        // ADR-005 crystallized snapshot (mock data mirrors the API create path)
        snapshotCampName: randomCampSite.nameTh,
        snapshotCampNameEn: randomCampSite.nameEn,
        snapshotUnitAmount: unitPrice,
        snapshotSubtotalAmount: totalPrice,
        snapshotTaxRate: 0,
        snapshotTaxAmount: 0,
        snapshotVatInclusive: false,
        snapshotTotalAmount: totalPrice,
        snapshotCurrency: 'THB',
        snapshotNights: nights,
        snapshotCheckInTime: randomCampSite.checkInTime,
        snapshotCheckOutTime: randomCampSite.checkOutTime,
        snapshotTimezone: 'Asia/Bangkok',
        createdAt: new Date(new Date().getTime() - Math.floor(Math.random() * 1000000000)) // Random past created date
      }
    });
  }

  console.log('✅ Created 20 mock bookings for the host');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
