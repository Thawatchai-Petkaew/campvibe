import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { BookingConfirmationClient } from "./BookingConfirmationClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingConfirmationPage({ params }: PageProps) {
  const session = await auth();

  // AC#6: unauthenticated → redirect to login (matches project pattern from auth.ts pages.signIn)
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  // AC#5 + AC#7: fetch scoped to owner (userId === session.user.id).
  // null for wrong-owner OR non-existent id → notFound() (404, never 403 — no existence leak).
  const booking = await prisma.booking.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      guests: true,
      totalPrice: true,
      campSite: {
        select: {
          nameTh: true,
          nameEn: true,
          nameThSlug: true,
        },
      },
    },
  });

  if (!booking) {
    notFound();
  }

  // Serialize Decimal fields (totalPrice) and Date fields for the client component.
  const serialized = {
    id: booking.id,
    status: booking.status,
    checkInDate: booking.checkInDate.toISOString(),
    checkOutDate: booking.checkOutDate.toISOString(),
    guests: booking.guests,
    totalPrice: Number(booking.totalPrice),
    campSite: booking.campSite,
  };

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 py-12">
        <BookingConfirmationClient booking={serialized} />
      </div>
    </main>
  );
}
