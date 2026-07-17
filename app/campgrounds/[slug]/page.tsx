import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import CampgroundDetailClient, { type ReviewsListResult } from "@/components/CampgroundDetailClient";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTranslations } from "@/locales/translations";
import { serializeDecimals } from "@/lib/serialize";
import { buildReviewSummary, toReviewListItem } from "@/lib/review-summary";
import { canViewCampSite } from "@/lib/campsite-visibility";
import { getCampBySlug } from "@/lib/catalog-cache";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function CampgroundPage({ params }: { params: Promise<{ slug: string }> }) {
    const session = await auth();
    const { slug } = await params;

    // CACHE-1 (CAM-195): detail read served from unstable_cache on warm requests.
    // getCampBySlug wraps the same prisma.campSite.findFirst (OR slug) + include as before.
    // CRITICAL: canViewCampSite MUST run AFTER the cached call, on the per-request session.
    // It is never cached — caching the access-control decision would leak unpublished camp
    // data to strangers (session-dependent gate, see lib/campsite-visibility.ts).
    let campSite;
    try {
        campSite = await getCampBySlug(slug);
    } catch (error) {
        console.error("Database connection error:", error);
        notFound();
    }

    if (!campSite) {
        notFound();
    }

    // SEC-1: gate non-public campsites — 404 (no info-disclosure).
    // Runs OUTSIDE the cache with the live per-request session — never cached.
    if (!canViewCampSite(campSite, session)) {
        notFound();
    }

    const t = getTranslations('th'); // Default to Thai for SSR or detect from cookies

    // Compare by ID (from session) against the FK on the campsite — operator email is never fetched.
    const isOwner = !!session?.user?.id && session.user.id === campSite.operatorId;

    // AC-2, BR-3: resolve initial saved state server-side (no flash on load).
    let initialSaved = false;
    if (session?.user?.id) {
        try {
            const w = await prisma.wishlist.findUnique({
                where: { userId_campSiteId: { userId: session.user.id, campSiteId: campSite.id } },
                select: { id: true },
            });
            initialSaved = !!w;
        } catch {
            // Non-fatal — default false keeps the UI functional.
        }
    }

    // CAM-79 / CAM-394: the review AGGREGATE (avg + count) stays on the awaited fast
    // path — it feeds the header stars, the section count, and the SEO aggregateRating,
    // all rendered server-side immediately so the shell is not gated on the review list.
    // AC-6: a review DB error MUST NOT break the rest of the page — isolated try/catch.
    const campSiteId = campSite.id;
    let avgRating: number | null = null;
    let reviewCount = 0;
    let reviewsError = false;

    try {
        // CAM-269 (PREP-3) AC-3: count only verified-stay reviews so the number next to
        // the stars always matches the number of review cards rendered.
        const agg = await prisma.review.aggregate({
            where: { campSiteId, deletedAt: null, verified: true },
            _avg: { rating: true },
            _count: { rating: true },
        });
        const summary = buildReviewSummary({ avg: agg._avg.rating, count: agg._count.rating });
        avgRating = summary.avgRating;
        reviewCount = summary.count;
    } catch {
        // AC-6: isolated — rest of page remains usable.
        reviewsError = true;
    }

    // CAM-394: the review LIST is STREAMED — this promise is passed UNAWAITED to the
    // client so the shell (name/hero/description/booking) renders first and the list
    // fills in behind its own <Suspense> skeleton. It never rejects (resolves ok:false)
    // so a list error stays isolated (AC-6). Only queried when there are reviews to show;
    // a 0-review camp renders the empty state from reviewCount without touching this.
    const reviewsPromise: Promise<ReviewsListResult> = reviewCount > 0
        ? prisma.review
            .findMany({
                where: { campSiteId, deletedAt: null, verified: true },
                include: { author: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 10,
            })
            .then((rows) => ({ ok: true as const, reviews: rows.map(toReviewListItem) }))
            .catch(() => ({ ok: false as const }))
        : Promise.resolve({ ok: true as const, reviews: [] });

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <CampgroundDetailClient
                campground={serializeDecimals(campSite)}
                isOwner={isOwner}
                initialSaved={initialSaved}
                isLoggedIn={!!session?.user}
                avgRating={avgRating}
                reviewCount={reviewCount}
                reviewsPromise={reviewsPromise}
                reviewsError={reviewsError}
            />
        </main>
    );
}
