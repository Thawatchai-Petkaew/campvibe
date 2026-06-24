import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/Navbar";

// AC#9: loading skeleton shown while the server fetch resolves.
// Matches the loaded-state card layout: cover → name+price → ref → date grid → guests/nights.
export default function BookingDetailLoading() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Back link skeleton */}
          <Skeleton className="w-40 h-4 rounded-full" />

          <div className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm">
            {/* Cover skeleton */}
            <Skeleton className="w-full h-48 md:h-64 rounded-none" />

            <div className="p-4 md:p-6 space-y-6">
              {/* Camp name + price */}
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="w-48 h-6 rounded-full" />
                  <Skeleton className="w-32 h-4 rounded-full" />
                </div>
                <Skeleton className="w-20 h-8 rounded-full" />
              </div>

              {/* Booking ref */}
              <Skeleton className="w-36 h-4 rounded-full" />

              {/* Date grid */}
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>

              {/* Guests + nights */}
              <Skeleton className="w-48 h-4 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
