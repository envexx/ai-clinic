import { Prisma } from "@/generated/prisma/client";
import { ConversationStatus, MessageRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  appendMessage,
  findAssistantReply,
  findOpenConversation,
  findUserMessage,
  getOrCreateConversation,
  listVisitorMessages,
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

  // AI stops once a human owns the conversation (PRD section 9).
  if (conversation.status !== ConversationStatus.AI_ACTIVE) {
    const already = await findUserMessage(conversation.id, input.clientMessageId);
    if (!already) {
      await appendMessage({
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: input.message,
        clientMessageId: input.clientMessageId,
      });
    }
    const reply =
      "A clinic staff member has this conversation now. Your message was added and they'll reply here.";
    await appendMessage({
      conversationId: conversation.id,
      role: MessageRole.ASSISTANT,
      content: reply,
      clientMessageId: `assistant:${input.clientMessageId}`,
    });
    return {
      conversationId: conversation.id,
      reply,
      citations: [],
      pendingAction: null,
      handoff: true,
    };
  }

  // Only persist the visitor message once, so retries stay idempotent.
  const existingUser = await findUserMessage(
    conversation.id,
    input.clientMessageId,
  );
  if (!existingUser) {
    await appendMessage({
      conversationId: conversation.id,
      role: MessageRole.USER,
      content: input.message,
      clientMessageId: input.clientMessageId,
    });
  }

  const history = (await listVisitorMessages(conversation.id)).map((message) => ({
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
  // Reading history must not create an empty conversation.
  const conversation = await findOpenConversation(session);
  if (!conversation) {
    return { conversationId: null, status: "NONE", messages: [] };
  }
  const messages = await listVisitorMessages(conversation.id);
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
