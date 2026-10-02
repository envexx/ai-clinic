import type { Prisma } from "@/generated/prisma/client";
import { ConversationStatus } from "@/generated/prisma/enums";
import type { MessageRole } from "@/generated/prisma/enums";
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
