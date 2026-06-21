-- S4b (ADR-006): images CSV -> polymorphic Image table (CampSite/Spot/Review), onDelete Cascade.

-- AlterTable
ALTER TABLE "CampSite" DROP COLUMN "images";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "mediaUrls";

-- AlterTable
ALTER TABLE "Spot" DROP COLUMN "images";

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "campSiteId" TEXT,
    "spotId" TEXT,
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Image_campSiteId_idx" ON "Image"("campSiteId");

-- CreateIndex
CREATE INDEX "Image_spotId_idx" ON "Image"("spotId");

-- CreateIndex
CREATE INDEX "Image_reviewId_idx" ON "Image"("reviewId");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

