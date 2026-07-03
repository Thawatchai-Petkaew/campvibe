import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { reviewBodySchema, canReview, hasStayOccurred, VERIFIED_STAY_STATUSES } from '@/lib/validations/review';
import { CATALOG_TAG, campTag } from '@/lib/catalog-cache';
import { checkRateLimit } from '@/lib/rate-limit';

// Sentinel thrown from inside the $transaction callback when the DB's unique
// constraint (Review.bookingId) catches a race the pre-check missed — two
// concurrent requests both passing the pre-check for the same booking. Mapped
// to 409 in the outer catch; never leaked as a raw Prisma error (security.md).
class ReviewAlreadyExistsError extends Error {}

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

        // 4. Verified-stay gate (CAM-269 / PREP-3) — server-authoritative, never trusts the
        //    client. A qualifying stay is a Booking for THIS user + THIS campsite whose
        //    status is in VERIFIED_STAY_STATUSES (COMPLETED) AND whose checkInDate has
        //    already passed (Rules: "สถานะ completed และผ่านวันเข้าพัก"). Fetch every
        //    qualifying booking (not just the first) together with whether it already has
        //    a review, in one query — this lets us tell "no qualifying stay" (403) apart
        //    from "already reviewed every qualifying stay" (409) without a second round trip.
        const candidateBookings = await prisma.booking.findMany({
            where: {
                userId: authorId,
                campSiteId: data.campSiteId,
                status: { in: [...VERIFIED_STAY_STATUSES] },
                checkInDate: { lte: new Date() },
                deletedAt: null,
            },
            select: { id: true, checkInDate: true, review: { select: { id: true } } },
        });

        // Defense-in-depth (security.md "assume breach"): re-assert the date rule in
        // application code via the same pure hasStayOccurred() the unit tests exercise,
        // rather than relying solely on the `where` clause above. If a future refactor
        // of this query ever drops or weakens the checkInDate filter, this still blocks
        // a future-dated "COMPLETED" booking (e.g. a host mis-click) from qualifying.
        const qualifyingBookings = candidateBookings.filter((booking) => hasStayOccurred(booking.checkInDate));

        if (!canReview({ hasQualifyingBooking: qualifyingBookings.length > 0 })) {
            return NextResponse.json(
                { error: 'You must have a completed stay at this campsite before leaving a review.' },
                { status: 403 }
            );
        }

        // Bind to a qualifying stay that has no review yet — one review per booking
        // (Data: `bookingId` reference, DB-unique). All qualifying stays already reviewed
        // → the user is not reviewing a NEW stay, reject as a duplicate (409), not silently
        // let them post an unlimited number of reviews per completed stay.
        const availableBooking = qualifyingBookings.find((booking) => booking.review === null);
        if (!availableBooking) {
            return NextResponse.json(
                { error: 'You have already reviewed this stay.' },
                { status: 409 }
            );
        }
        const bookingId = availableBooking.id;

        // 5. Create the review and maintain aggregate in a single atomic transaction (AGG-1 / CAM-189).
        // The aggregate is recomputed from all non-deleted reviews for this camp AFTER the new row is
        // inserted, so the new review is included in the count and avg.
        let review;
        try {
            review = await prisma.$transaction(async (tx) => {
                let created;
                try {
                    created = await tx.review.create({
                        data: {
                            authorId,
                            campSiteId: data.campSiteId,
                            bookingId,
                            verified: true, // every review created via this gate is, by construction, verified
                            rating: data.rating,
                            title: data.title ?? '',
                            content: data.content,
                            visitDate: data.visitDate ? new Date(data.visitDate) : null,
                        },
                    });
                } catch (createErr) {
                    // Race: a concurrent request bound a review to this same booking between
                    // our read above and this write. The DB's unique constraint is the final
                    // backstop — surface it as a duplicate conflict, not a generic 500.
                    if (createErr instanceof Prisma.PrismaClientKnownRequestError && createErr.code === 'P2002') {
                        throw new ReviewAlreadyExistsError();
                    }
                    throw createErr;
                }

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
        } catch (txError) {
            if (txError instanceof ReviewAlreadyExistsError) {
                return NextResponse.json(
                    { error: 'You have already reviewed this stay.' },
                    { status: 409 }
                );
            }
            throw txError;
        }

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
