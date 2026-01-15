import { prisma } from './lib/prisma';

async function main() {
    const campSites = await prisma.campSite.findMany({
        include: {
            location: true,
            operator: true,
        }
    });

    console.log(JSON.stringify(campSites, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
