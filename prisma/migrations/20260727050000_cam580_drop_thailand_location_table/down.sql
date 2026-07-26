-- Down for 20260727050000_cam580_drop_thailand_location_table.
-- Recreates the `ThailandLocation` table + its two indexes, structure only
-- (no FK — `Location`'s FK into this table was already dropped by CAM-574's
-- migration, 20260727010000_cam574_retire_thai_location_fk, so restoring it
-- here would not match the pre-migration state). Data is NOT restored (see
-- migration.sql's header comment) — the table comes back empty.

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

-- CreateIndex
CREATE INDEX "ThailandLocation_provinceName_districtName_idx" ON "ThailandLocation"("provinceName", "districtName");

-- CreateIndex
CREATE UNIQUE INDEX "ThailandLocation_provinceCode_districtCode_key" ON "ThailandLocation"("provinceCode", "districtCode");
