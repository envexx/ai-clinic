import { google } from "@ai-sdk/google";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { ConversationStatus } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import { DomainError } from "@/lib/result";
import { prepareBookingSchema } from "@/modules/appointments/validation";
import {
  openHandoffTicket,
  setConversationStatus,
} from "@/modules/conversations/conversations";
import type { KnowledgeCitation } from "@/modules/knowledge/retrieval";

import { classifyIntent } from "./intent";
import {
  toolGetAvailableSlots,
  toolGetOwnedAppointments,
  toolGetServices,
  toolPrepareBooking,
  toolPrepareCancellation,
  toolPrepareReschedule,
  toolSearchKnowledge,
  type AgentContext,
} from "./tools";

export type PreparedSummary = {
  actionId: string;
  type: string;
  expiresAt: string;
  summary: Record<string, unknown>;
};

export type AgentTurnResult = {
  reply: string;
  citations: KnowledgeCitation[];
  pendingAction: PreparedSummary | null;
  handoff: boolean;
};

export function isModelConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const SYSTEM_PROMPT = `You are the administrative front desk assistant for WellNest Clinic in Dubai.
You help with clinic information and appointment booking. You are NOT a medical professional.

Rules:
- Only state clinic facts returned by the searchClinicKnowledge or getClinicServices tools. If no source is found, say you do not have that information and offer to pass the question to staff.
- Never invent prices, durations, availability or policies. Prices and durations come from tools.
- You may use prepareBooking / prepareReschedule / prepareCancellation to prepare a summary, but you can NEVER confirm a booking. The visitor confirms with a button. Always ask them to review and confirm.
- For medical questions, do not diagnose or give treatment advice; offer to connect them with clinic staff.
- Ask a clarifying question when the service or the date/time is ambiguous.
- Keep replies short. Show times in the clinic timezone (Asia/Dubai).
- When you hand off to staff, do not promise a specific response time.
- Reply in plain text. Do not use markdown formatting (no asterisks, no headings).
- Use at most 8 tool steps.`;

type Collected = {
  citations: KnowledgeCitation[];
  pendingAction: PreparedSummary | null;
  handoff: boolean;
};

function dedupeCitations(citations: KnowledgeCitation[]): KnowledgeCitation[] {
  const seen = new Map<string, KnowledgeCitation>();
  for (const citation of citations) {
    if (!seen.has(citation.versionId)) seen.set(citation.versionId, citation);
  }
  return [...seen.values()];
}

function formatAppointments(
  appointments: { bookingReference: string; serviceName: string; providerName: string; startAt: string; status: string }[],
): string {
  if (appointments.length === 0) {
    return "You don't have any appointments in this browser session. You can book one at /book.";
  }
  return appointments
    .map(
      (appointment) =>
        `${appointment.bookingReference} — ${appointment.serviceName} with ${appointment.providerName} on ${new Date(appointment.startAt).toUTCString()} (${appointment.status})`,
    )
    .join("\n");
}

async function runFallbackTurn(
  ctx: AgentContext,
  conversationId: string,
  userText: string,
): Promise<AgentTurnResult> {
  const intent = classifyIntent(userText);

  if (intent === "greeting") {
    return {
      reply:
        "Hello! I can answer questions about WellNest Clinic (services, prices, opening hours, policies) and help you book an appointment. What would you like to do?",
      citations: [],
      pendingAction: null,
      handoff: false,
    };
  }

  if (intent === "handoff") {
    await setConversationStatus(conversationId, ConversationStatus.WAITING_HUMAN);
    await openHandoffTicket(conversationId, "Visitor requested staff");
    return {
      reply:
        "I've asked the clinic team to assist you. They'll pick up this conversation as soon as someone is available.",
      citations: [],
      pendingAction: null,
      handoff: true,
    };
  }

  if (intent === "appointment_status") {
    const appointments = await toolGetOwnedAppointments(ctx);
    return {
      reply: formatAppointments(appointments),
      citations: [],
      pendingAction: null,
      handoff: false,
    };
  }

  if (intent === "booking") {
    const services = await toolGetServices(ctx.clinicId);
    const list = services
      .map(
        (service) =>
          `• ${service.name} (${service.durationMinutes} min) — ${service.currency} ${(service.priceMinor / 100).toFixed(2)}`,
      )
      .join("\n");
    return {
      reply: `I can help you book. Our services are:\n${list}\n\nChoose a time on the booking page at /book, then review and confirm.`,
      citations: [],
      pendingAction: null,
      handoff: false,
    };
  }

  const citations = await toolSearchKnowledge(ctx, userText);
  if (citations.length === 0) {
    return {
      reply:
        "I couldn't find an approved source for that, so I won't guess. I can pass your question to the clinic team — just say \"talk to staff\".",
      citations: [],
      pendingAction: null,
      handoff: false,
    };
  }

  const top = citations[0];
  return {
    reply: `Here's what I found in "${top.title}": ${top.excerpt}`,
    citations: dedupeCitations(citations),
    pendingAction: null,
    handoff: false,
  };
}

function buildTools(ctx: AgentContext, collected: Collected) {
  return {
    searchClinicKnowledge: tool({
      description:
        "Search approved clinic knowledge: policies, opening hours, services, preparation.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const hits = await toolSearchKnowledge(ctx, query);
        collected.citations.push(...hits);
        return hits;
      },
    }),
    getClinicServices: tool({
      description: "List active services with durations and prices.",
      inputSchema: z.object({}),
      execute: async () => toolGetServices(ctx.clinicId),
    }),
    getAvailableSlots: tool({
      description: "Find free appointment slots for a service.",
      inputSchema: z.object({
        serviceId: z.string(),
        providerId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
      execute: async (input) => toolGetAvailableSlots(ctx, input),
    }),
    getOwnedAppointments: tool({
      description: "List the visitor's own appointments in this session.",
      inputSchema: z.object({}),
      execute: async () => toolGetOwnedAppointments(ctx),
    }),
    prepareBooking: tool({
      description:
        "Prepare a booking summary for the visitor to confirm. Does not save anything.",
      inputSchema: prepareBookingSchema.omit({ consent: true }),
      execute: async (input) => {
        const prepared = await toolPrepareBooking(ctx, { ...input, consent: true });
        collected.pendingAction = prepared;
        return prepared;
      },
    }),
    prepareReschedule: tool({
      description:
        "Prepare a reschedule summary for the visitor to confirm. Does not change anything.",
      inputSchema: z.object({
        appointmentId: z.string(),
        providerId: z.string().optional(),
        startAt: z.string(),
        expectedVersion: z.number().int().positive(),
      }),
      execute: async (input) => {
        const prepared = await toolPrepareReschedule(ctx, input);
        collected.pendingAction = prepared;
        return prepared;
      },
    }),
    prepareCancellation: tool({
      description:
        "Prepare a cancellation summary for the visitor to confirm. Does not cancel anything.",
      inputSchema: z.object({
        appointmentId: z.string(),
        expectedVersion: z.number().int().positive(),
      }),
      execute: async (input) => {
        const prepared = await toolPrepareCancellation(ctx, input);
        collected.pendingAction = prepared;
        return prepared;
      },
    }),
    requestHumanHandoff: tool({
      description: "Ask clinic staff to take over the conversation.",
      inputSchema: z.object({ reason: z.string() }),
      execute: async () => {
        collected.handoff = true;
        return { status: "WAITING_HUMAN" };
      },
    }),
  };
}

async function runModelTurn(
  ctx: AgentContext,
  conversationId: string,
  history: { role: string; content: string }[],
  userText: string,
): Promise<AgentTurnResult> {
  const collected: Collected = {
    citations: [],
    pendingAction: null,
    handoff: false,
  };

  const modelId = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const messages = [
    ...history
      .filter((message) => message.role === "USER" || message.role === "ASSISTANT")
      .map((message) => ({
        role: message.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: message.content,
      })),
    { role: "user" as const, content: userText },
  ];

  const result = await generateText({
    model: google(modelId),
    system: SYSTEM_PROMPT,
    messages,
    tools: buildTools(ctx, collected),
    stopWhen: stepCountIs(8),
    // Fail fast so a rate limit degrades to the grounded fallback quickly.
    maxRetries: 0,
  });

  // The model sometimes ends a step with only tool calls. Ask once more for a
  // plain-text answer so the visitor always receives a real reply.
  let replyText = result.text.trim();
  if (!replyText) {
    const followUp = await generateText({
      model: google(modelId),
      system: SYSTEM_PROMPT,
      messages: [
        ...messages,
        {
          role: "user",
          content: "Please answer my last message now, in plain text.",
        },
      ],
      maxRetries: 0,
    });
    replyText = followUp.text.trim();
  }

  if (collected.handoff) {
    await setConversationStatus(conversationId, ConversationStatus.WAITING_HUMAN);
    await openHandoffTicket(conversationId, "Model requested handoff");
  }

  return {
    reply:
      replyText ||
      "I can't answer that from our records. You can book at /book or ask to speak with staff.",
    citations: dedupeCitations(collected.citations),
    pendingAction: collected.pendingAction,
    handoff: collected.handoff,
  };
}

export async function runAgentTurn(
  ctx: AgentContext,
  conversationId: string,
  history: { role: string; content: string }[],
  userText: string,
): Promise<AgentTurnResult> {
  if (!isModelConfigured()) {
    return runFallbackTurn(ctx, conversationId, userText);
  }

  try {
    return await runModelTurn(ctx, conversationId, history, userText);
  } catch (error) {
    logger.error("ai.model_turn_failed", {
      message: error instanceof Error ? error.message : String(error),
    });

    // In strict mode (used when seeding real model conversations) a model
    // failure must surface so it can be retried, never silently replaced.
    if (process.env.AI_STRICT === "1") {
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        "SERVICE_UNAVAILABLE",
        "The assistant is temporarily unavailable. You can still use /book or ask for staff.",
        true,
      );
    }

    // Otherwise degrade to the grounded offline agent instead of failing.
    return runFallbackTurn(ctx, conversationId, userText);
  }
}
