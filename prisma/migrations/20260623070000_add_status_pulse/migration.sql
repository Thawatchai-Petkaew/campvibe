-- Real-time signal table for the /status dashboard (CAM-140). Single "singleton"
-- row bumped by the Linear webhook; the SSE stream polls it. Additive + reversible.
CREATE TABLE "StatusPulse" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusPulse_pkey" PRIMARY KEY ("id")
);
