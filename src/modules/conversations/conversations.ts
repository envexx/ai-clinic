import type { Prisma } from "@/generated/prisma/client";
import { ConversationStatus, MessageRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

export type SessionRef = { id: string; clinicId: string };

export async function getOrCreateConversation(session: SessionRef) {
  const existing = await prisma.conversation.findFirst({
    where: {
      guestSessionId: session.id,
      status: {
        in: [
          ConversationStatus.AI_ACTIVE,
          ConversationStatus.WAITING_HUMAN,
          ConversationStatus.HUMAN_ACTIVE,
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: { clinicId: session.clinicId, guestSessionId: session.id },
  });
}

export async function listMessages(conversationId: string, limit = 40) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/** Visitor-safe roles. Tool/system messages are never exposed to the visitor. */
const VISITOR_ROLES = [
  MessageRole.USER,
  MessageRole.ASSISTANT,
  MessageRole.STAFF,
] as const;

export async function listVisitorMessages(conversationId: string, limit = 40) {
  return prisma.message.findMany({
    where: { conversationId, role: { in: [...VISITOR_ROLES] } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function findAssistantReply(
  conversationId: string,
  clientMessageId: string,
) {
  return prisma.message.findFirst({
    where: { conversationId, clientMessageId: `assistant:${clientMessageId}` },
  });
}

export async function appendMessage(input: {
  conversationId: string;
  role: MessageRole;
  content: string;
  citations?: unknown;
  pendingActionId?: string | null;
  clientMessageId?: string | null;
}) {
  return prisma.message.create({
    data: {
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      citations:
        input.citations === undefined
          ? undefined
          : (input.citations as Prisma.InputJsonValue),
      pendingActionId: input.pendingActionId ?? null,
      clientMessageId: input.clientMessageId ?? null,
    },
  });
}

export async function setConversationStatus(
  conversationId: string,
  status: ConversationStatus,
) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { status, version: { increment: 1 } },
  });
}

/** Opens a handoff ticket, keeping at most one open ticket per conversation. */
export async function openHandoffTicket(
  conversationId: string,
  reason: string,
) {
  const existing = await prisma.handoffTicket.findFirst({
    where: { conversationId, status: "OPEN" },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.handoffTicket.create({
    data: { conversationId, reason },
  });
}
