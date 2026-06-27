import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { reviewBodySchema, canReview, VERIFIED_STAY_STATUSES } from '@/lib/validations/review';
import { CATALOG_TAG, campTag } from '@/lib/catalog-cache';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    // 1. Authentication — session must exist; authorId comes from session only.
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const authorId = session.user.id;

    // RISK-5: Rate-limit review creation per user (5 req / 1 hour).
    const rl = checkRateLimit(`review:create:${authorId}`, { limit: 5, windowMs: 3_600_000 });
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'rate_limited' },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
        );
    }

    try {
        // 2. Input validation — authorId is never read from the request body.
        const body = await request.json();
        const validation = reviewBodySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation Error', details: validation.error.format() },
                { status: 400 }
            );
        }

        const data = validation.data;

        // 3. Check campsite exists.
        const campSite = await prisma.campSite.findUnique({
            where: { id: data.campSiteId },
        });
        if (!campSite) {
            return NextResponse.json({ error: 'Camp site not found' }, { status: 404 });
        }

        // 4. Verified-stay check — user must have a CONFIRMED booking for this campsite.
        const confirmedBooking = await prisma.booking.findFirst({
            where: {
                userId: authorId,
                campSiteId: data.campSiteId,
                status: { in: [...VERIFIED_STAY_STATUSES] },
            },
            select: { id: true },
        });

        const allowed = canReview({ hasConfirmedBooking: confirmedBooking !== null });
        if (!allowed) {
            return NextResponse.json(
                { error: 'You must have a confirmed booking at this campsite before leaving a review.' },
                { status: 403 }
            );
        }

        // 5. Create the review and maintain aggregate in a single atomic transaction (AGG-1 / CAM-189).
        // The aggregate is recomputed from all non-deleted reviews for this camp AFTER the new row is
        // inserted, so the new review is included in the count and avg.
        const review = await prisma.$transaction(async (tx) => {
            const created = await tx.review.create({
                data: {
                    authorId,
                    campSiteId: data.campSiteId,
                    rating: data.rating,
                    title: data.title ?? '',
                    content: data.content,
                    visitDate: data.visitDate ? new Date(data.visitDate) : null,
                },
            });

            // Recompute aggregate from source of truth (non-deleted reviews for this camp).
            const agg = await tx.review.aggregate({
                where: { campSiteId: data.campSiteId, deletedAt: null },
                _avg: { rating: true },
                _count: { id: true },
            });

            const count = agg._count.id;
            const rawAvg = agg._avg.rating;
            const avgRating =
                rawAvg != null
                    ? new Prisma.Decimal(Math.round(Number(rawAvg) * 10) / 10)
                    : null;

            await tx.campSite.update({
                where: { id: data.campSiteId },
                data: { reviewCount: count, avgRating },
            });

            return created;
        });

        // FRESH-1: invalidate the camp-specific cache entry and the broad
        // catalog cache after the AGG-1 transaction commits (avgRating /
        // reviewCount on CampSite are updated inside the tx above).
        // Called after the transaction succeeds, before the success response.
        revalidateTag(campTag(data.campSiteId), {});
        revalidateTag(CATALOG_TAG, {});

        return NextResponse.json(review, { status: 201 });

    } catch (error) {
        // Do not leak internal details in production.
        console.error('[POST /api/reviews]', error);
        return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
    }
}
