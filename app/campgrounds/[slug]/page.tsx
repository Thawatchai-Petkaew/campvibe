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
// CAM-635: the ONE reader for the in-chat booking-prefill contract (CAM-634)
// — this page never re-implements its rules.
import { parseBookingPrefill, type BookingPrefill } from "@/lib/booking-prefill";
// Read-only import of the repo's Bangkok-local "today" helper (never a naive
// UTC-derived day, see lib/booking-prefill.ts's header comment) — lib/ai/**
// itself is out of this story's file surface, this only consumes its export.
import { bangkokTodayISO } from "@/lib/ai/date-phrases";
// CAM-548: reuse the CAM-545 name-based province lookup verbatim (never the
// thaiLocationId FK — see lib/read-models/camp-card.ts doc comment; that FK
// covers only 12 of 652 Location rows).
import { getProvinceThaiNameMap, withProvinceThaiNames } from "@/lib/read-models/camp-card";

interface PageProps {
    params: Promise<{ slug: string }>;
    // CAM-635: /campgrounds/<slug>?checkIn=...&checkOut=...&guests=...&from=chat
    // (lib/booking-prefill.ts). Record shape matches parseBookingPrefill's raw input.
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CampgroundPage({ params, searchParams }: PageProps) {
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
        // CAM-588: a thrown error here is an infrastructure/DB failure (e.g. a
        // stale Prisma client after a migration — see scripts/dev-with-prisma-watch.mjs),
        // not a statement about the data. A 404 means "this camp doesn't exist";
        // a database failure is not that statement, so it must NOT become one.
        // Log it loudly server-side (structured, no stack/secret to the client)
        // and RE-THROW so Next.js routes to the nearest error boundary
        // (app/error.tsx — generic Thai copy, never a stack, per security.md).
        console.error(JSON.stringify({
            level: "error",
            event: "camp_detail_load_failed",
            slug,
            message: error instanceof Error ? error.message : String(error),
        }));
        throw error;
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

    // CAM-635: seed the booking widget from a chat handoff link. Only attempt
    // a parse when the URL actually looks like one (>=1 of the 3 keys
    // present) — an ordinary bare link (the overwhelming common case) must
    // never emit a reject log for a prefill nobody sent.
    const rawSearchParams = await searchParams;
    const looksLikePrefillLink =
        rawSearchParams.checkIn !== undefined ||
        rawSearchParams.checkOut !== undefined ||
        rawSearchParams.guests !== undefined;

    let bookingPrefill: BookingPrefill | null = null;
    if (looksLikePrefillLink) {
        const result = parseBookingPrefill(rawSearchParams, {
            today: bangkokTodayISO(new Date()),
            // CAM-636: the real per-camp/per-date guest ceiling (remaining
            // capacity, or a per-spot camp's own maxGuestsPerDay, which is a
            // documented STALE column for that mode — lib/guest-capacity.ts)
            // is never knowable synchronously here. null means only a
            // structurally invalid guest count (< 1) rejects at this layer;
            // an over-ceiling-but-positive count is CLAMPED client-side by
            // the existing CAM-636 guest-capacity effect, never rejected here.
            maxGuests: null,
        });
        if (result.ok) {
            bookingPrefill = result.value;
        } else {
            // Rejected prefill: render exactly as the no-prefill default
            // (empty dates, guests 1) — no toast/banner, a bad deep link is
            // not something the camper can fix. One structured log line,
            // no PII.
            console.warn(JSON.stringify({
                level: "warn",
                event: "booking_prefill_rejected",
                slug,
                reason: result.reason,
            }));
        }
    }

    // CAM-642: `from=chat` is read independent of whether the prefill itself
    // validated — the camper may still be re-picking a rejected date range
    // from a chat-originated link, and the reserve should still attribute to
    // CHAT in that case. Client-asserted label only; reaches no
    // authz/pricing/capacity decision (lib/validations/booking.ts).
    const bookingSourceIsChat = rawSearchParams.from === "chat";

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

    // CAM-548: attach the Thai province name via the CAM-545 seam — a name-based
    // match against Location.province (English, unchanged/read-only here), reaching
    // 650 of 650 real camps. Applied the same way as the card/catalog call sites.
    const provinceThaiNameMap = await getProvinceThaiNameMap();
    const [campSiteWithProvinceTh] = withProvinceThaiNames([campSite], provinceThaiNameMap);

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <CampgroundDetailClient
                campground={serializeDecimals(campSiteWithProvinceTh)}
                isOwner={isOwner}
                initialSaved={initialSaved}
                isLoggedIn={!!session?.user}
                avgRating={avgRating}
                reviewCount={reviewCount}
                reviewsPromise={reviewsPromise}
                reviewsError={reviewsError}
                prefill={bookingPrefill}
                fromChat={bookingSourceIsChat}
            />
        </main>
    );
}
