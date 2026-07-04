-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONVERTED');

-- CreateTable
CREATE TABLE "InternalHold" (
    "id" TEXT NOT NULL,
    "campSiteId" TEXT NOT NULL,
    "spotId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalHold_campSiteId_startDate_endDate_idx" ON "InternalHold"("campSiteId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "InternalHold_spotId_idx" ON "InternalHold"("spotId");

-- CreateIndex
CREATE INDEX "InternalHold_status_idx" ON "InternalHold"("status");

-- AddForeignKey
ALTER TABLE "InternalHold" ADD CONSTRAINT "InternalHold_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalHold" ADD CONSTRAINT "InternalHold_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalHold" ADD CONSTRAINT "InternalHold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
