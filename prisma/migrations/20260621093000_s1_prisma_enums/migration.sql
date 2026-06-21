-- S1: string -> Prisma enums (docs/adr/ADR-003). Pre-launch: breaking drop+recreate is
-- safe (reset + re-seed). Columns are recreated NOT NULL where required — applies cleanly
-- on empty tables during `prisma migrate reset`; staging/prod use db:reset:staging (not
-- plain migrate deploy) because the populated DB cannot take a NOT NULL add.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'CAMPER');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'PARTNERSHIP');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "BookingMethod" AS ENUM ('ONLI', 'ONCA', 'ONST');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('PRIVATE', 'NATIONAL_PARK');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('GENERAL', 'RIVER', 'MOUNTAIN', 'LAKE', 'FOREST', 'BEACH');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'CANCELLED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "status",
ADD COLUMN     "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED';

-- AlterTable
ALTER TABLE "CampSite" DROP COLUMN "bookingMethod",
ADD COLUMN     "bookingMethod" "BookingMethod" NOT NULL,
DROP COLUMN "ownershipType",
ADD COLUMN     "ownershipType" "OwnershipType";

-- AlterTable
ALTER TABLE "Spot" DROP COLUMN "viewType",
ADD COLUMN     "viewType" "ViewType";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'CAMPER',
DROP COLUMN "kycStatus",
ADD COLUMN     "kycStatus" "KycStatus",
DROP COLUMN "businessType",
ADD COLUMN     "businessType" "BusinessType";

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");
