import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initializing team ownership for existing camp sites...\n');

  // Get all camp sites
  const campSites = await prisma.campSite.findMany({
    include: {
      operator: {
        select: {
          id: true,
          email: true,
          name: true
        }
      }
    }
  });

  console.log(`Found ${campSites.length} camp sites\n`);

  let created = 0;
  let existing = 0;

  for (const campSite of campSites) {
    // Check if team member record exists
    const teamMember = await prisma.campSiteTeamMember.findUnique({
      where: {
        userId_campSiteId: {
          userId: campSite.operatorId,
          campSiteId: campSite.id
        }
      }
    });

    if (teamMember) {
      existing++;
      continue;
    }

    // Create OWNER team member record
    await prisma.campSiteTeamMember.create({
      data: {
        userId: campSite.operatorId,
        campSiteId: campSite.id,
        role: 'OWNER',
        permissions: [
          "CAMPSITE_UPDATE",
          "CAMPSITE_DELETE",
          "BOOKING_VIEW",
          "BOOKING_UPDATE",
          "BOOKING_CREATE",
          "BOOKING_DELETE",
          "TEAM_VIEW",
          "TEAM_INVITE",
          "TEAM_UPDATE_ROLE",
          "TEAM_REMOVE",
          "ANALYTICS_VIEW",
          "FINANCIAL_VIEW"
        ],
        acceptedAt: new Date(),
        isActive: true
      }
    });

    console.log(`✅ ${campSite.operator.email} → OWNER of "${campSite.nameEn || campSite.nameTh}"`);
    created++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Created: ${created} owner records`);
  console.log(`   ⏭️  Skipped: ${existing} (already exists)`);
  console.log(`\n🎉 Done! You can now use Team Management features.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
