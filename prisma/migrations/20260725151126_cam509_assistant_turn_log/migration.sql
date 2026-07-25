-- CreateTable
CREATE TABLE "AssistantTurnLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "userIdHash" TEXT,
    "userText" TEXT NOT NULL,
    "toolCalls" JSONB NOT NULL,
    "assistantText" TEXT,
    "missFlags" TEXT[],
    "roundCount" INTEGER NOT NULL,
    "latencyMs" INTEGER,
    "model" TEXT NOT NULL,

    CONSTRAINT "AssistantTurnLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantTurnLog_createdAt_idx" ON "AssistantTurnLog"("createdAt");

-- CreateIndex
CREATE INDEX "AssistantTurnLog_path_idx" ON "AssistantTurnLog"("path");
