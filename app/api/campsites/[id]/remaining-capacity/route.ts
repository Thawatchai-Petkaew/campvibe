import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getRemainingCapacity } from '@/lib/campsite-availability';
import { auth } from '@/lib/auth';
import { isCampSitePublic, canViewCampSite } from '@/lib/campsite-visibility';
import { remainingCapacityQuerySchema } from '@/lib/validations/campsite-availability';

// CAM-267 PREP-1: live "remaining capacity" read for the exact stay the user picked
// in the campsite detail-page booking widget (เหลือ X ที่ / เต็มแล้ว). Always dynamic —
// capacity changes with every booking/cancellation/BlockedDate, never cached.
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Validate at the boundary — re-parse; never trust the client's date strings.
  const searchParams = request.nextUrl.searchParams;
  const parsed = remainingCapacityQuerySchema.safeParse({
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
  });
  if (!parsed.success) {
    return apiError('Invalid startDate or endDate parameters', 400, parsed.error.flatten());
  }

  try {
    const start = new Date(parsed.data.startDate);
    const end = new Date(parsed.data.endDate);

    // Get camp site — include visibility fields so the gate can be applied (mirrors
    // the sibling /availability route).
    const campSite = await prisma.campSite.findUnique({
      where: { id },
      select: {
        isActive: true,
        isPublished: true,
        deletedAt: true,
        operatorId: true,
      },
    });

    if (!campSite) {
      return apiError('Camp site not found', 404);
    }

    // SEC-1: gate non-public campsites. Auth is lazy — only called when the camp
    // is not public so the hot path (public camp) pays zero auth overhead.
    if (!isCampSitePublic(campSite)) {
      const session = await auth();
      if (!canViewCampSite(campSite, session)) {
        // 404 not 403 — no information-disclosure.
        return apiError('Camp site not found', 404);
      }
    }

    // PRIVACY: getRemainingCapacity never reads/returns BlockedDate.reason (CAM-190).
    const result = await getRemainingCapacity(id, start, end);

    const response = apiSuccess({
      campSiteId: id,
      capacity: result.capacity,
      remaining: result.remaining,
      blockedByHost: result.blockedByHost,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return apiError('Failed to fetch remaining capacity', 500, error);
  }
}
