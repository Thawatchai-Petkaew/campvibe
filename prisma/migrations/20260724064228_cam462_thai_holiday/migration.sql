-- CreateTable
CREATE TABLE "ThaiHoliday" (
    "date" DATE NOT NULL,
    "nameTh" TEXT NOT NULL,
    "isLongWeekend" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThaiHoliday_pkey" PRIMARY KEY ("date")
);
