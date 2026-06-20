-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('CAMPSITE_VIEW', 'CAMPSITE_UPDATE', 'CAMPSITE_DELETE', 'BOOKING_VIEW', 'BOOKING_UPDATE', 'BOOKING_CREATE', 'BOOKING_DELETE', 'TEAM_VIEW', 'TEAM_INVITE', 'TEAM_UPDATE_ROLE', 'TEAM_REMOVE', 'ANALYTICS_VIEW', 'FINANCIAL_VIEW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "image" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CAMPER',
    "isHostRegistered" BOOLEAN NOT NULL DEFAULT false,
    "hostRegisteredAt" TIMESTAMP(3),
    "kycStatus" TEXT,
    "kycSubmittedAt" TIMESTAMP(3),
    "kycApprovedAt" TIMESTAMP(3),
    "kycRejectedAt" TIMESTAMP(3),
    "kycRejectionReason" TEXT,
    "kycReviewedBy" TEXT,
    "kycDocuments" TEXT,
    "businessName" TEXT,
    "businessType" TEXT,
    "taxId" TEXT,
    "businessAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThailandLocation" (
    "id" TEXT NOT NULL,
    "provinceCode" TEXT NOT NULL,
    "provinceName" TEXT NOT NULL,
    "provinceNameEn" TEXT NOT NULL,
    "districtCode" TEXT,
    "districtName" TEXT,
    "districtNameEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThailandLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Thailand',
    "region" TEXT,
    "province" TEXT,
    "district" TEXT,
    "subDistrict" TEXT,
    "village" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "thaiLocationId" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampSite" (
    "id" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameThSlug" TEXT NOT NULL,
    "nameEnSlug" TEXT NOT NULL,
    "description" TEXT,
    "campSiteType" TEXT NOT NULL,
    "logo" TEXT,
    "images" TEXT,
    "videoUrl" TEXT,
    "accessTypes" TEXT NOT NULL,
    "accommodationTypes" TEXT NOT NULL,
    "facilities" TEXT NOT NULL,
    "externalFacilities" TEXT,
    "equipment" TEXT,
    "activities" TEXT,
    "terrain" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "directions" TEXT,
    "checkInTime" TEXT NOT NULL,
    "checkOutTime" TEXT NOT NULL,
    "bookingMethod" TEXT NOT NULL,
    "feeInfo" TEXT,
    "toiletInfo" TEXT,
    "minimumAge" INTEGER,
    "maxGuestsPerDay" INTEGER,
    "maxTentsPerDay" INTEGER,
    "groundType" TEXT,
    "phone" TEXT,
    "lineId" TEXT,
    "facebookUrl" TEXT,
    "facebookMessageUrl" TEXT,
    "tiktokUrl" TEXT,
    "priceLow" DOUBLE PRECISION,
    "priceHigh" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publicDate" TIMESTAMP(3),
    "tags" TEXT,
    "partner" TEXT,
    "nationalPark" TEXT,
    "ownershipType" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "petFriendly" BOOLEAN NOT NULL DEFAULT false,
    "useSpotView" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,

    CONSTRAINT "CampSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampSiteTeamMember" (
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

-- CreateTable
CREATE TABLE "MasterData" (
    "code" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "icon" TEXT,

    CONSTRAINT "MasterData_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Spot" (
    "id" TEXT NOT NULL,
    "zone" TEXT,
    "name" TEXT NOT NULL,
    "images" TEXT,
    "viewType" TEXT,
    "maxCampers" INTEGER,
    "maxTents" INTEGER,
    "environment" TEXT,
    "pricePerNight" DOUBLE PRECISION NOT NULL,
    "pricePerSite" DOUBLE PRECISION,
    "nearFacilities" TEXT,
    "campSiteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "rating" INTEGER NOT NULL,
    "visitDate" TIMESTAMP(3),
    "mediaUrls" TEXT,
    "campSiteId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "userId" TEXT NOT NULL,
    "campSiteId" TEXT NOT NULL,
    "spotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CampSiteToMasterData" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

-- CreateIndex
CREATE INDEX "User_isHostRegistered_idx" ON "User"("isHostRegistered");

-- CreateIndex
CREATE INDEX "ThailandLocation_provinceName_districtName_idx" ON "ThailandLocation"("provinceName", "districtName");

-- CreateIndex
CREATE UNIQUE INDEX "ThailandLocation_provinceCode_districtCode_key" ON "ThailandLocation"("provinceCode", "districtCode");

-- CreateIndex
CREATE UNIQUE INDEX "CampSite_nameThSlug_key" ON "CampSite"("nameThSlug");

-- CreateIndex
CREATE UNIQUE INDEX "CampSite_nameEnSlug_key" ON "CampSite"("nameEnSlug");

-- CreateIndex
CREATE INDEX "CampSiteTeamMember_campSiteId_idx" ON "CampSiteTeamMember"("campSiteId");

-- CreateIndex
CREATE INDEX "CampSiteTeamMember_userId_idx" ON "CampSiteTeamMember"("userId");

-- CreateIndex
CREATE INDEX "CampSiteTeamMember_role_idx" ON "CampSiteTeamMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "CampSiteTeamMember_userId_campSiteId_key" ON "CampSiteTeamMember"("userId", "campSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "_CampSiteToMasterData_AB_unique" ON "_CampSiteToMasterData"("A", "B");

-- CreateIndex
CREATE INDEX "_CampSiteToMasterData_B_index" ON "_CampSiteToMasterData"("B");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_thaiLocationId_fkey" FOREIGN KEY ("thaiLocationId") REFERENCES "ThailandLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampSite" ADD CONSTRAINT "CampSite_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampSite" ADD CONSTRAINT "CampSite_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampSiteTeamMember" ADD CONSTRAINT "CampSiteTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampSiteTeamMember" ADD CONSTRAINT "CampSiteTeamMember_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spot" ADD CONSTRAINT "Spot_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CampSiteToMasterData" ADD CONSTRAINT "_CampSiteToMasterData_A_fkey" FOREIGN KEY ("A") REFERENCES "CampSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CampSiteToMasterData" ADD CONSTRAINT "_CampSiteToMasterData_B_fkey" FOREIGN KEY ("B") REFERENCES "MasterData"("code") ON DELETE CASCADE ON UPDATE CASCADE;
