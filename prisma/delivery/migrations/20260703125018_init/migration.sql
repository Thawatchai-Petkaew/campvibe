-- CreateEnum
CREATE TYPE "TicketState" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'AWAITING_GATE', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('EPIC', 'STORY', 'TASK');

-- CreateEnum
CREATE TYPE "DeliveryRole" AS ENUM ('PRODUCT_OWNER', 'ANALYST', 'ARCHITECT', 'UX_DESIGNER', 'FRONTEND_ENGINEER', 'BACKEND_ENGINEER', 'QA_ENGINEER', 'SECURITY_REVIEWER', 'DEVOPS_RELEASE');

-- CreateEnum
CREATE TYPE "Persona" AS ENUM ('HOST', 'CAMPER', 'ADMIN', 'PLATFORM');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "identifier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "state" "TicketState" NOT NULL DEFAULT 'BACKLOG',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "type" "TicketType" NOT NULL,
    "currentRole" "DeliveryRole",
    "persona" "Persona",
    "epicId" TEXT,
    "featureName" TEXT,
    "gateRaisedAt" TIMESTAMP(3),
    "changesRequested" BOOLEAN NOT NULL DEFAULT false,
    "regressionRound" INTEGER NOT NULL DEFAULT 0,
    "releasedAt" TIMESTAMP(3),
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "roleHistory" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigneeName" TEXT,
    "legacyUrl" TEXT,
    "legacyLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPulse" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryPulse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_identifier_key" ON "Ticket"("identifier");

-- CreateIndex
CREATE INDEX "Ticket_state_idx" ON "Ticket"("state");

-- CreateIndex
CREATE INDEX "Ticket_epicId_idx" ON "Ticket"("epicId");

-- CreateIndex
CREATE INDEX "Ticket_archivedAt_idx" ON "Ticket"("archivedAt");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
