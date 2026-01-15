-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('CAMPSITE_UPDATE', 'CAMPSITE_DELETE', 'BOOKING_VIEW', 'BOOKING_UPDATE', 'BOOKING_CREATE', 'BOOKING_DELETE', 'TEAM_VIEW', 'TEAM_INVITE', 'TEAM_UPDATE_ROLE', 'TEAM_REMOVE', 'ANALYTICS_VIEW', 'FINANCIAL_VIEW');

-- AlterTable User - Add KYC and Host fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isHostRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "hostRegisteredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "kycStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "kycSubmittedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "kycApprovedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "kycRejectedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "kycRejectionReason" TEXT,
ADD COLUMN IF NOT EXISTS "kycReviewedBy" TEXT,
ADD COLUMN IF NOT EXISTS "kycDocuments" TEXT,
ADD COLUMN IF NOT EXISTS "businessName" TEXT,
ADD COLUMN IF NOT EXISTS "businessType" TEXT,
ADD COLUMN IF NOT EXISTS "taxId" TEXT,
ADD COLUMN IF NOT EXISTS "businessAddress" TEXT;

-- CreateTable CampSiteTeamMember
CREATE TABLE IF NOT EXISTS "CampSiteTeamMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campSiteId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'VIEWER',
    "permissions" TEXT[],
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampSiteTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_kycStatus_idx" ON "User"("kycStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_isHostRegistered_idx" ON "User"("isHostRegistered");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CampSiteTeamMember_userId_campSiteId_key" ON "CampSiteTeamMember"("userId", "campSiteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampSiteTeamMember_campSiteId_idx" ON "CampSiteTeamMember"("campSiteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampSiteTeamMember_userId_idx" ON "CampSiteTeamMember"("userId");

-- AddForeignKey
ALTER TABLE "CampSiteTeamMember" ADD CONSTRAINT "CampSiteTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampSiteTeamMember" ADD CONSTRAINT "CampSiteTeamMember_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
