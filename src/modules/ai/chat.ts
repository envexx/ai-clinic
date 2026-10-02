import { Prisma } from "@/generated/prisma/client";
import { MessageRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  appendMessage,
  findAssistantReply,
  getOrCreateConversation,
  listMessages,
  type SessionRef,
} from "@/modules/conversations/conversations";

import { runAgentTurn } from "./agent";
import type { AgentContext } from "./tools";

export type PendingActionSummary = {
  actionId: string;
  type: string;
  expiresAt: string;
  summary: unknown;
};

export type ChatReply = {
  conversationId: string;
  reply: string;
  citations: unknown[];
  pendingAction: PendingActionSummary | null;
  handoff: boolean;
};

async function summariseAction(
  actionId: string,
): Promise<PendingActionSummary | null> {
  const action = await prisma.pendingAction.findUnique({
    where: { id: actionId },
  });
  if (!action) return null;
  return {
    actionId: action.id,
    type: action.type,
    expiresAt: action.expiresAt.toISOString(),
    summary: action.payload as Prisma.JsonValue,
  };
}

/**
 * Persists the visitor message, runs the agent, persists the assistant reply,
 * and is idempotent per clientMessageId (a retry returns the same reply).
 */
export async function handleChatMessage(
  session: SessionRef,
  input: { message: string; clientMessageId: string },
): Promise<ChatReply> {
  const conversation = await getOrCreateConversation(session);

  const existing = await findAssistantReply(
    conversation.id,
    input.clientMessageId,
  );
  if (existing) {
    return {
      conversationId: conversation.id,
      reply: existing.content,
      citations: (existing.citations as unknown[]) ?? [],
      pendingAction: existing.pendingActionId
        ? await summariseAction(existing.pendingActionId)
        : null,
      handoff: false,
    };
  }

  await appendMessage({
    conversationId: conversation.id,
    role: MessageRole.USER,
    content: input.message,
    clientMessageId: input.clientMessageId,
  });

  const history = (await listMessages(conversation.id)).map((message) => ({
    role: message.role as string,
    content: message.content,
  }));

  const ctx: AgentContext = { clinicId: session.clinicId, session };
  const turn = await runAgentTurn(
    ctx,
    conversation.id,
    history,
    input.message,
  );

  await appendMessage({
    conversationId: conversation.id,
    role: MessageRole.ASSISTANT,
    content: turn.reply,
    citations: turn.citations,
    pendingActionId: turn.pendingAction?.actionId ?? null,
    clientMessageId: `assistant:${input.clientMessageId}`,
  });

  return {
    conversationId: conversation.id,
    reply: turn.reply,
    citations: turn.citations,
    pendingAction: turn.pendingAction,
    handoff: turn.handoff,
  };
}

export async function getConversationHistory(session: SessionRef) {
  const conversation = await getOrCreateConversation(session);
  const messages = await listMessages(conversation.id);
  return {
    conversationId: conversation.id,
    status: conversation.status,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      citations: (message.citations as unknown[]) ?? [],
      pendingActionId: message.pendingActionId,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}
