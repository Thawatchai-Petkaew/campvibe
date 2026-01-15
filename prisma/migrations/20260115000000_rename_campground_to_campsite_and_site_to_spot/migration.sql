-- Rename Campground to CampSite and Site to Spot
-- This migration renames tables and updates all foreign key references

-- Step 1: Rename Campground table to CampSite
ALTER TABLE "Campground" RENAME TO "CampSite";

-- Step 2: Rename Site table to Spot
ALTER TABLE "Site" RENAME TO "Spot";

-- Step 3: Update foreign key column names in related tables
-- Update Booking table
ALTER TABLE "Booking" RENAME COLUMN "campgroundId" TO "campSiteId";
ALTER TABLE "Booking" RENAME COLUMN "siteId" TO "spotId";

-- Update Review table
ALTER TABLE "Review" RENAME COLUMN "campgroundId" TO "campSiteId";

-- Step 4: Update column names in CampSite table
ALTER TABLE "CampSite" RENAME COLUMN "campgroundType" TO "campSiteType";

-- Step 5: Update foreign key column names in Spot table
ALTER TABLE "Spot" RENAME COLUMN "campgroundId" TO "campSiteId";

-- Step 6: Add new columns to Spot table
ALTER TABLE "Spot" ADD COLUMN IF NOT EXISTS "zone" TEXT;
ALTER TABLE "Spot" ADD COLUMN IF NOT EXISTS "images" TEXT;
ALTER TABLE "Spot" ADD COLUMN IF NOT EXISTS "viewType" TEXT;
ALTER TABLE "Spot" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Spot" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 7: Update foreign key constraints
-- Drop old foreign key constraints
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_campgroundId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_siteId_fkey";
ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_campgroundId_fkey";
ALTER TABLE "Spot" DROP CONSTRAINT IF EXISTS "Site_campgroundId_fkey";
ALTER TABLE "CampSite" DROP CONSTRAINT IF EXISTS "Campground_locationId_fkey";
ALTER TABLE "CampSite" DROP CONSTRAINT IF EXISTS "Campground_operatorId_fkey";

-- Add new foreign key constraints
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Spot" ADD CONSTRAINT "Spot_campSiteId_fkey" FOREIGN KEY ("campSiteId") REFERENCES "CampSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampSite" ADD CONSTRAINT "CampSite_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampSite" ADD CONSTRAINT "CampSite_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 8: Update _CampgroundToMasterData junction table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_CampgroundToMasterData') THEN
        ALTER TABLE "_CampgroundToMasterData" RENAME TO "_CampSiteToMasterData";
        ALTER TABLE "_CampSiteToMasterData" RENAME COLUMN "A" TO "A";
        ALTER TABLE "_CampSiteToMasterData" RENAME COLUMN "B" TO "B";
    END IF;
END $$;
