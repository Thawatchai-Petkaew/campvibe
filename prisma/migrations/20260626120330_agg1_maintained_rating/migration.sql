-- AlterTable
ALTER TABLE "CampSite" ADD COLUMN     "avgRating" DECIMAL(2,1),
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- AGG-1 backfill: compute avgRating + reviewCount from existing non-deleted reviews.
-- Runs once at migration time inside the same transaction; idempotent (re-running produces same result).
-- Camps with zero reviews keep reviewCount=0 and avgRating=NULL (DEFAULT already set by ALTER TABLE).
UPDATE "CampSite" cs
SET "reviewCount" = COALESCE(agg."cnt", 0),
    "avgRating"   = CASE WHEN COALESCE(agg."cnt", 0) = 0 THEN NULL
                         ELSE ROUND(agg."avg_rating"::NUMERIC, 1)
                    END
FROM (
  SELECT
    r."campSiteId",
    COUNT(*)::INT             AS "cnt",
    AVG(r."rating"::NUMERIC)  AS "avg_rating"
  FROM "Review" r
  WHERE r."deletedAt" IS NULL
  GROUP BY r."campSiteId"
) AS agg
WHERE cs."id" = agg."campSiteId";
