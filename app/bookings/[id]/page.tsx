import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOwnedBooking } from "@/lib/bookings";
import { Navbar } from "@/components/Navbar";
import { BookingDetailClient } from "./BookingDetailClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: PageProps) {
  const session = await auth();

  // AC#8: unauthenticated → redirect to login
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  // AC#7 + AC#10: owner-scoped fetch via getOwnedBooking.
  // Returns null when booking does not exist OR belongs to another user.
  // Mapping both to notFound() prevents existence leaks (Rules: no 403 vs 404 split).
  const booking = await getOwnedBooking(id, session.user.id);
  if (!booking) {
    notFound();
  }

  // Serialize Decimal (totalPrice) and Date fields for the client component.
  const serialized = {
    id: booking.id,
    checkInDate: booking.checkInDate.toISOString(),
    checkOutDate: booking.checkOutDate.toISOString(),
    guests: booking.guests,
    totalPrice: Number(booking.totalPrice),
    currency: booking.currency,
    status: booking.status,
    campSite: {
      nameTh: booking.campSite.nameTh,
      nameEn: booking.campSite.nameEn,
      phone: booking.campSite.phone,
      lineId: booking.campSite.lineId,
      images: booking.campSite.images,
      location: booking.campSite.location,
    },
    spot: booking.spot,
  };

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <BookingDetailClient booking={serialized} />
      </div>
    </main>
  );
}
