-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CAMPER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "country" TEXT NOT NULL DEFAULT 'Thailand',
    "region" TEXT,
    "province" TEXT,
    "district" TEXT,
    "subDistrict" TEXT,
    "village" TEXT,
    "lat" REAL,
    "lon" REAL
);

-- CreateTable
CREATE TABLE "Campground" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT,
    "nameThSlug" TEXT NOT NULL,
    "nameEnSlug" TEXT NOT NULL,
    "description" TEXT,
    "campgroundType" TEXT NOT NULL,
    "accessTypes" TEXT NOT NULL,
    "accommodationTypes" TEXT NOT NULL,
    "facilities" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "checkInTime" TEXT NOT NULL,
    "checkOutTime" TEXT NOT NULL,
    "bookingMethod" TEXT NOT NULL,
    "priceLow" REAL,
    "priceHigh" REAL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "partner" TEXT,
    "nationalPark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    CONSTRAINT "Campground_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Campground_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "maxCampers" INTEGER,
    "maxTents" INTEGER,
    "environment" TEXT,
    "pricePerNight" REAL NOT NULL,
    "pricePerSite" REAL,
    "nearFacilities" TEXT,
    "campgroundId" TEXT NOT NULL,
    CONSTRAINT "Site_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "content" TEXT,
    "rating" INTEGER NOT NULL,
    "visitDate" TIMESTAMP(3),
    "mediaUrls" TEXT,
    "campgroundId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Campground_nameThSlug_key" ON "Campground"("nameThSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Campground_nameEnSlug_key" ON "Campground"("nameEnSlug");
