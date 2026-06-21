-- CreateEnum
CREATE TYPE "AdminLevel" AS ENUM ('PROVINCE', 'DISTRICT', 'SUBDISTRICT');

-- AlterTable
-- countryCode is nullable with NO default: existing rows stay NULL so the FK below does not
-- violate on a populated table (forward-safe migrate deploy). Seed/app set it to a real Country.
ALTER TABLE "Location" ADD COLUMN     "adminAreaId" TEXT,
ADD COLUMN     "countryCode" TEXT;

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLocal" TEXT,
    "defaultCurrency" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "vatRate" DECIMAL(5,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "AdminArea" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "level" "AdminLevel" NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminArea_countryCode_level_idx" ON "AdminArea"("countryCode", "level");

-- CreateIndex
CREATE INDEX "AdminArea_parentId_idx" ON "AdminArea"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminArea_countryCode_level_code_key" ON "AdminArea"("countryCode", "level", "code");

-- CreateIndex
CREATE INDEX "Location_countryCode_idx" ON "Location"("countryCode");

-- CreateIndex
CREATE INDEX "Location_adminAreaId_idx" ON "Location"("adminAreaId");

-- AddForeignKey
ALTER TABLE "AdminArea" ADD CONSTRAINT "AdminArea_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminArea" ADD CONSTRAINT "AdminArea_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AdminArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_adminAreaId_fkey" FOREIGN KEY ("adminAreaId") REFERENCES "AdminArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
