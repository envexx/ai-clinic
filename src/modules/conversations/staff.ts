import {
  ConversationStatus,
  MessageRole,
  PendingActionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/result";
import { writeAudit } from "@/modules/audit/audit";

export type StaffRef = { id: string; clinicId: string; role: string };

export async function listInbox(clinicId: string, status?: ConversationStatus) {
  const conversations = await prisma.conversation.findMany({
    where: { clinicId, ...(status ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { role: true, content: true, createdAt: true },
      },
    },
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    status: conversation.status,
    assignedStaffId: conversation.assignedStaffId,
    version: conversation.version,
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessage: conversation.messages[0]
      ? {
          role: conversation.messages[0].role,
          content: conversation.messages[0].content,
          createdAt: conversation.messages[0].createdAt.toISOString(),
        }
      : null,
  }));
}

export async function getConversationDetail(
  clinicId: string,
  conversationId: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId },
  });
  if (!conversation) throw new DomainError("NOT_FOUND", "Conversation not found");

  // Sequential for local Prisma Postgres (single connection).
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  const notes = await prisma.internalNote.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  const tickets = await prisma.handoffTicket.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
  });

  return { conversation, messages, notes, tickets };
}

/**
 * Claims a conversation atomically. Two staff claiming at the same time: only
 * one update matches (version + status), the other gets VERSION_CONFLICT.
 * Claiming also cancels any pending AI actions for that visitor.
 */
export async function claimConversation(
  staff: StaffRef,
  conversationId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.conversation.updateMany({
      where: {
        id: conversationId,
        clinicId: staff.clinicId,
        version: expectedVersion,
        status: {
          in: [ConversationStatus.AI_ACTIVE, ConversationStatus.WAITING_HUMAN],
        },
        OR: [{ assignedStaffId: null }, { assignedStaffId: staff.id }],
      },
      data: {
        assignedStaffId: staff.id,
        status: ConversationStatus.HUMAN_ACTIVE,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "This conversation was already claimed or changed",
      );
    }

    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { guestSessionId: true },
    });

    await tx.pendingAction.updateMany({
      where: {
        guestSessionId: conversation.guestSessionId,
        status: PendingActionStatus.PENDING,
      },
      data: { status: PendingActionStatus.CANCELLED },
    });

    await tx.handoffTicket.updateMany({
      where: { conversationId, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByStaffId: staff.id },
    });

    await writeAudit(
      {
        clinicId: staff.clinicId,
        actorType: "STAFF",
        actorId: staff.id,
        action: "CONVERSATION_CLAIMED",
        entityType: "conversation",
        entityId: conversationId,
      },
      tx,
    );

    return tx.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  });
}

export async function staffReply(
  staff: StaffRef,
  conversationId: string,
  content: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId: staff.clinicId },
  });
  if (!conversation) throw new DomainError("NOT_FOUND", "Conversation not found");
  if (
    conversation.assignedStaffId !== staff.id &&
    staff.role !== "ADMIN"
  ) {
    throw new DomainError(
      "FORBIDDEN",
      "This conversation is assigned to another staff member",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.message.create({
      data: {
        conversationId,
        role: MessageRole.STAFF,
        content,
        authorStaffId: staff.id,
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.HUMAN_ACTIVE,
        assignedStaffId: conversation.assignedStaffId ?? staff.id,
        version: { increment: 1 },
      },
    });
  });
}

export async function addInternalNote(
  staff: StaffRef,
  conversationId: string,
  content: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId: staff.clinicId },
    select: { id: true },
  });
  if (!conversation) throw new DomainError("NOT_FOUND", "Conversation not found");

  return prisma.internalNote.create({
    data: { conversationId, authorStaffId: staff.id, content },
  });
}

export async function resolveConversation(
  staff: StaffRef,
  conversationId: string,
  expectedVersion: number,
) {
  const result = await prisma.conversation.updateMany({
    where: {
      id: conversationId,
      clinicId: staff.clinicId,
      version: expectedVersion,
    },
    data: { status: ConversationStatus.RESOLVED, version: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new DomainError("VERSION_CONFLICT", "Conversation changed");
  }

  await prisma.handoffTicket.updateMany({
    where: { conversationId, status: "OPEN" },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByStaffId: staff.id,
    },
  });
}
