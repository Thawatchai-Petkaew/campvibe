import { prisma } from './lib/prisma';

async function main() {
    const campgrounds = await prisma.campground.findMany({
        include: {
            location: true,
            operator: true,
        }
    });

    console.log(JSON.stringify(campgrounds, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
