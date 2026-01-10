import { Navbar } from "@/components/Navbar";
import { CategoryBar } from "@/components/CategoryBar";
import { CampgroundCard } from "@/components/CampgroundCard";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'

interface HomeProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { type } = await searchParams;

  // Build filter object
  const where: any = {};
  if (type && type !== 'ALL') {
    where.campgroundType = type;
  }

  // Fetch campgrounds server-side
  let campgrounds: any[] = [];
  try {
    campgrounds = await prisma.campground.findMany({
      where,
      include: {
        location: true,
      },
      take: 20
    });
  } catch (error) {
    console.error("Database connection error:", error);
    // Return empty array and let the UI handle it with the "No campgrounds found" state
    campgrounds = [];
  }

  return (
    <main className="min-h-screen pb-20">
      <Navbar />
      <div className="sticky top-20 bg-white z-40 shadow-sm border-b border-gray-100">
        <CategoryBar />
      </div>

      <div className="container mx-auto px-6 pt-6">
        {campgrounds.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold mb-2">No campgrounds found</h2>
            <p className="text-gray-500 mb-6">Try seeding the database to see some example data.</p>
            <a href="/api/seed" target="_blank" className="font-medium text-green-900 hover:underline">
              Seed Database (Click me)
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {campgrounds.map((camp: any) => (
              <CampgroundCard key={camp.id} campground={camp} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
