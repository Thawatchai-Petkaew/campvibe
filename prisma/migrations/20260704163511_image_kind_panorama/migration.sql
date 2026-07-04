-- CreateEnum
CREATE TYPE "ImageKind" AS ENUM ('PHOTO', 'PANORAMA');

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "kind" "ImageKind" NOT NULL DEFAULT 'PHOTO';
