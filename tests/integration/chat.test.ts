import "dotenv/config";

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ConversationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { handleChatMessage } from "@/modules/ai/chat";

let session: { id: string; clinicId: string };

beforeAll(async () => {
  const clinic = await prisma.clinic.findFirstOrThrow();
  const guest = await prisma.guestSession.create({
    data: {
      clinicId: clinic.id,
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  session = { id: guest.id, clinicId: clinic.id };
});

afterAll(async () => {
  if (!session) return;
  await prisma.conversation.deleteMany({
    where: { guestSessionId: session.id },
  });
  await prisma.guestSession.delete({ where: { id: session.id } });
});

describe("chat orchestration (offline fallback agent)", () => {
  it("answers knowledge questions with citations", async () => {
    const reply = await handleChatMessage(session, {
      message: "what are your opening hours?",
      clientMessageId: randomUUID(),
    });
    expect(reply.citations.length).toBeGreaterThan(0);
    expect(reply.reply.toLowerCase()).toContain("found");
  });

  it("abstains when there is no approved source", async () => {
    const reply = await handleChatMessage(session, {
      message: "do you offer underwater basket weaving?",
      clientMessageId: randomUUID(),
    });
    expect(reply.citations).toHaveLength(0);
    expect(reply.reply.toLowerCase()).toContain("approved source");
  });

  it("is idempotent per clientMessageId", async () => {
    const clientMessageId = randomUUID();
    const first = await handleChatMessage(session, {
      message: "hello",
      clientMessageId,
    });
    const replay = await handleChatMessage(session, {
      message: "hello",
      clientMessageId,
    });
    expect(replay.reply).toBe(first.reply);
  });

  it("escalates to human handoff", async () => {
    const reply = await handleChatMessage(session, {
      message: "I want to talk to staff",
      clientMessageId: randomUUID(),
    });
    expect(reply.handoff).toBe(true);

    const conversation = await prisma.conversation.findFirstOrThrow({
      where: { guestSessionId: session.id },
      orderBy: { updatedAt: "desc" },
    });
    expect(conversation.status).toBe(ConversationStatus.WAITING_HUMAN);
  });
});
