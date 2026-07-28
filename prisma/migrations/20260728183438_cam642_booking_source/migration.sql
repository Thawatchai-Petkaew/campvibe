-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WEB', 'CHAT');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'WEB',
ALTER COLUMN "status" SET DEFAULT 'PENDING';
