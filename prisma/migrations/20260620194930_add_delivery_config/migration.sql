-- CreateTable
CREATE TABLE "DeliveryConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "autonomousMode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "DeliveryConfig_pkey" PRIMARY KEY ("id")
);
