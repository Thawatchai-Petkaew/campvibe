-- CAM-268 (PREP-2): atomic price/fee/cancellation-policy pixels for the M1
-- "Listing Truth" story. Purely additive — a new nullable enum column on CampSite
-- (cancellationPolicy, default NULL = "not set", AC-3), two new nullable columns on
-- CampSite for a single host-set one-time fee (extraFeeAmount/extraFeeLabel), and one
-- new nullable snapshot column on Booking (snapshotExtraFeeAmount, ADR-005
-- crystallization) so a booking's recorded total stays self-explanatory even if the
-- host later edits/removes the fee. No existing column altered/dropped/renamed — no
-- backfill required. Reversible per docs/RUNBOOK-db-migrations.md (pre-launch reset/
-- reseed policy): tested locally via `prisma migrate reset --force` (drop all tables
-- → re-apply every migration including this one → reseed) — proves the end-state
-- schema + seed are valid together.

-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT', 'NON_REFUNDABLE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "snapshotExtraFeeAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "CampSite" ADD COLUMN     "cancellationPolicy" "CancellationPolicy",
ADD COLUMN     "extraFeeAmount" DECIMAL(12,2),
ADD COLUMN     "extraFeeLabel" VARCHAR(100);
