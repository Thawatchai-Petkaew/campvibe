import { Navbar } from "@/components/Navbar";
import { CategoryBar } from "@/components/CategoryBar";
import { CampgroundCard } from "@/components/CampgroundCard";
import { EmptyState } from "@/components/EmptyState";
import { SortDropdown } from "@/components/SortDropdown";
import { FilterSortBar } from "@/components/FilterSortBar";
import { FilterModal } from "@/components/FilterModal";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic'

interface HomeProps {
  searchParams: Promise<{
    type?: string;
    keyword?: string;
    province?: string;
    district?: string;
    startDate?: string;
    endDate?: string;
    guests?: string;
    sort?: string;
    min?: string;
    max?: string;
    access?: string;
    facilities?: string;
    activities?: string;
    terrain?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await auth();
  const {
    type, keyword, province, district, startDate, endDate, guests, sort,
    min, max, access, facilities, activities, terrain
  } = await searchParams;

  // Build filter object
  const where: any = {
    isActive: true,
    isPublished: true
  };

  // 1. Type filter
  if (type && type !== 'ALL') {
    where.campgroundType = type;
  }

  // 2. Keyword filter
  if (keyword) {
    where.OR = [
      { nameTh: { contains: keyword } },
      { nameEn: { contains: keyword } },
      { description: { contains: keyword } },
      { operator: { name: { contains: keyword } } }
    ];
  }

  // 3. Location filter
  if (province || district) {
    where.location = where.location || {};
    if (province) where.location.province = province;
    if (district) where.location.district = district;
  }

  // 4. Price Filter
  if (min || max) {
    where.priceLow = {};
    if (min) where.priceLow.gte = parseFloat(min);
    if (max) where.priceLow.lte = parseFloat(max);
  }

  // 5. Multi-select Filters (AND logic)
  const addMultiSelectFilter = (field: string, param: string | undefined) => {
    if (!param) return;
    const codes = param.split(',').filter(Boolean);
    if (codes.length > 0) {
      where.AND = where.AND || [];
      codes.forEach(code => {
        where.AND.push({
          [field]: { contains: code }
        });
      });
    }
  };

  addMultiSelectFilter('accessTypes', access);
  addMultiSelectFilter('facilities', facilities);
  addMultiSelectFilter('activities', activities);
  addMultiSelectFilter('terrain', terrain);

  // 6. Availability Filter
  if (startDate && endDate) {
    where.sites = {
      some: {
        bookings: {
          none: {
            OR: [
              {
                checkInDate: { lte: new Date(endDate) },
                checkOutDate: { gte: new Date(startDate) },
              }
            ],
            status: { not: 'CANCELLED' }
          }
        }
      }
    };
  }

  // 7. Sorting
  let orderBy: any = { createdAt: 'desc' }; // Balanced / Most Related (default)
  if (sort === 'price_asc') orderBy = { priceLow: 'asc' };
  else if (sort === 'price_desc') orderBy = { priceLow: 'desc' };
  else if (sort === 'rating') {
    orderBy = { createdAt: 'desc' };
  }

  // Fetch campgrounds server-side
  let campgrounds: any[] = [];
  try {
    campgrounds = await prisma.campground.findMany({
      where,
      include: {
        location: true,
        operator: {
          select: { name: true }
        },
        _count: {
          select: { reviews: true }
        }
      },
      orderBy,
      take: 40
    });
  } catch (error) {
    console.error("Database connection error:", error);
    campgrounds = [];
  }

  const isSearchActive = !!(keyword || province || district || startDate || endDate || guests || (type && type !== 'ALL') || min || max || access || facilities || activities || terrain);

  return (
    <main className="min-h-screen pb-20 bg-white">
      <Navbar currentUser={session?.user} />

      <div className="sticky top-20 bg-white z-40 shadow-sm border-b border-gray-100 mb-2">
        <div className="container mx-auto px-6 py-2">
          <CategoryBar />
        </div>
      </div>

      <FilterSortBar>
        <FilterModal />
        <div className="hidden md:block">
          <SortDropdown />
        </div>
      </FilterSortBar>

      <div className="container mx-auto px-6">
        {campgrounds.length === 0 ? (
          <EmptyState
            showReset={isSearchActive}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10 mt-4">
            {campgrounds.map((camp: any) => (
              <CampgroundCard key={camp.id} campground={camp} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
