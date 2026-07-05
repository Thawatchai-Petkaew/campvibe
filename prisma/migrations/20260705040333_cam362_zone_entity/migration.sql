-- AlterTable
ALTER TABLE "Spot" ADD COLUMN     "zoneId" TEXT;

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "campSiteId" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Zone_campSiteId_deletedAt_idx" ON "Zone"("campSiteId", "deletedAt");

-- CreateIndex
CREATE INDEX "Zone_campSiteId_name_idx" ON "Zone"("campSiteId", "name");

-- CreateIndex
CREATE INDEX "Spot_zoneId_idx" ON "Spot"("zoneId");

-- AddForeignKey
ALTER TABLE "Spot" ADD CONSTRAINT "Spot_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CAM-362 backfill (tech.md §2.2 step 5) — one Zone row per DISTINCT
-- normalized live zone string per camp, deduped case/whitespace-insensitively
-- to satisfy the partial unique index created below. Never touches
-- Spot.zone (the reversibility guarantee, tech.md §2.3). A soft-deleted
-- spot (deletedAt IS NOT NULL) contributes no Zone row.
INSERT INTO "Zone" ("id","campSiteId","name","sortOrder","createdAt","updatedAt","version")
SELECT DISTINCT ON (s."campSiteId", lower(btrim(s."zone")))
       gen_random_uuid(), s."campSiteId", btrim(s."zone"), 0, now(), now(), 1
FROM "Spot" s
WHERE s."zone" IS NOT NULL AND btrim(s."zone") <> '' AND s."deletedAt" IS NULL
ORDER BY s."campSiteId", lower(btrim(s."zone")), s."createdAt";

-- CAM-362 backfill LINK (tech.md §2.2 step 6) — point each live spot at its
-- Zone by normalized (case/whitespace-insensitive) name match.
UPDATE "Spot" s SET "zoneId" = z."id"
FROM "Zone" z
WHERE z."campSiteId" = s."campSiteId"
  AND lower(btrim(z."name")) = lower(btrim(s."zone"))
  AND s."zone" IS NOT NULL AND s."deletedAt" IS NULL;

-- CAM-362 partial unique index (tech.md §2.1/§2.2 step 7) — created LAST so a
-- backfill dedup bug surfaces as a loud index-build failure rather than
-- silent duplicates. Enforces `name` unique per camp among LIVE rows only
-- (case-insensitive + trimmed) — a soft-deleted name is re-creatable because
-- the WHERE clause excludes tombstoned rows. Prisma does NOT manage this
-- index (not declared in schema.prisma) — see the schema's Zone model
-- comment + tech.md §2.1 caveats: it will not appear in `prisma migrate
-- diff`, and a reset/regenerate-from-schema-alone would lose it unless this
-- migration file stays committed.
CREATE UNIQUE INDEX "Zone_campSiteId_name_active_key"
  ON "Zone" ("campSiteId", (lower(btrim("name")))) WHERE "deletedAt" IS NULL;
