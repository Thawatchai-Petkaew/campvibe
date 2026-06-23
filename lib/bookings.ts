import { prisma } from '@/lib/prisma';

/**
 * Fetch a single booking that belongs to the given userId.
 *
 * Owner-scoped: returns null if the booking does not exist OR if it belongs to
 * a different user — the caller must map null → 404 (no 403 vs 404 split that
 * would reveal existence; see CAM-61 AC#7 / Rules).
 *
 * Pure data — no NextResponse dependency so it is reusable in a Next.js Server
 * Component (SSR page fetch) as well as in the API route handler.
 *
 * Includes the relations the /bookings/[id] detail page needs:
 *   campSite  → nameTh, nameEn, images (url + sortOrder), location (province),
 *               checkInTime, checkOutTime, phone, lineId
 *   spot      → name, zone
 */
export async function getOwnedBooking(id: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id, userId },
    select: {
      id: true,
      checkInDate: true,
      checkOutDate: true,
      guests: true,
      totalPrice: true,
      currency: true,
      status: true,
      createdAt: true,
      campSite: {
        select: {
          nameTh: true,
          nameEn: true,
          checkInTime: true,
          checkOutTime: true,
          phone: true,
          lineId: true,
          images: {
            select: {
              url: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
          location: {
            select: {
              province: true,
            },
          },
        },
      },
      spot: {
        select: {
          name: true,
          zone: true,
        },
      },
    },
  });

  return booking ?? null;
}
