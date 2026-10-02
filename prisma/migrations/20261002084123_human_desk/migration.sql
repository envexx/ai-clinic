-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterEnum
ALTER TYPE "MessageRole" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "authorStaffId" UUID;

-- CreateTable
CREATE TABLE "internal_notes" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "authorStaffId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoff_tickets" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "HandoffStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ,
    "resolvedByStaffId" UUID,

    CONSTRAINT "handoff_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_notes_conversationId_createdAt_idx" ON "internal_notes"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "handoff_tickets_conversationId_status_idx" ON "handoff_tickets"("conversationId", "status");

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_tickets" ADD CONSTRAINT "handoff_tickets_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
