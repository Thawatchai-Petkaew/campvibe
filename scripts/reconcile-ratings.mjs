/**
 * AGG-1 (CAM-189) — Reconcile avgRating + reviewCount for all CampSite rows.
 *
 * Self-healing backstop: corrects any drift between the maintained aggregate columns
 * and the source Review rows. Idempotent — running multiple times produces the same
 * result when the source data has not changed.
 *
 * Derivation contract (must stay in sync with POST /api/reviews and the migration backfill):
 *   avgRating   = ROUND(AVG(Review.rating WHERE campSiteId=X AND deletedAt IS NULL), 1)
 *   reviewCount = COUNT(Review WHERE campSiteId=X AND deletedAt IS NULL)
 *   avgRating   = NULL when reviewCount = 0
 *
 * Usage:
 *   DATABASE_URL=<target> npm run reconcile:ratings
 *
 * Do NOT run on prod without first testing on Staging and verifying duration is acceptable.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log(JSON.stringify({ level: 'info', event: 'reconcile_ratings_start' }));

    // Pass 1: update all camps that have at least one non-deleted review.
    // ROUND(AVG(rating), 1) mirrors roundAvgRating(computeAvgRating(...)) in TypeScript.
    const result1 = await prisma.$executeRaw`
        UPDATE "CampSite" cs
        SET
            "reviewCount" = COALESCE(agg."cnt", 0),
            "avgRating"   = CASE WHEN COALESCE(agg."cnt", 0) = 0 THEN NULL
                                 ELSE ROUND(agg."avg_rating"::NUMERIC, 1)
                            END,
            "updatedAt"   = NOW()
        FROM (
            SELECT
                r."campSiteId",
                COUNT(*)::INT            AS "cnt",
                AVG(r."rating"::NUMERIC) AS "avg_rating"
            FROM "Review" r
            WHERE r."deletedAt" IS NULL
            GROUP BY r."campSiteId"
        ) AS agg
        WHERE cs."id" = agg."campSiteId"
    `;

    // Pass 2: zero out camps that have no non-deleted reviews but carry a stale reviewCount > 0.
    const result2 = await prisma.$executeRaw`
        UPDATE "CampSite"
        SET "reviewCount" = 0,
            "avgRating"   = NULL,
            "updatedAt"   = NOW()
        WHERE "id" NOT IN (
            SELECT DISTINCT "campSiteId" FROM "Review" WHERE "deletedAt" IS NULL
        )
        AND "reviewCount" > 0
    `;

    console.log(
        JSON.stringify({
            level: 'info',
            event: 'reconcile_ratings_complete',
            rowsUpdatedWithReviews: Number(result1),
            rowsZeroed: Number(result2),
        }),
    );
}

main()
    .catch((err) => {
        console.error(JSON.stringify({ level: 'error', event: 'reconcile_ratings_failed', message: String(err) }));
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
