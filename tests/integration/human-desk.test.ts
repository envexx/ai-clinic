import "dotenv/config";

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ConversationStatus,
  PendingActionStatus,
  PendingActionType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { handleChatMessage, getConversationHistory } from "@/modules/ai/chat";
import { createPendingAction } from "@/modules/appointments/actions";
import { getOrCreateConversation } from "@/modules/conversations/conversations";
import {
  addInternalNote,
  claimConversation,
  getConversationDetail,
  staffReply,
} from "@/modules/conversations/staff";

let session: { id: string; clinicId: string };
let admin: { id: string; clinicId: string; role: string };
let receptionist: { id: string; clinicId: string; role: string };

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

  const adminUser = await prisma.staffUser.findFirstOrThrow({
    where: { clinicId: clinic.id, role: "ADMIN" },
  });
  const receptionUser = await prisma.staffUser.findFirstOrThrow({
    where: { clinicId: clinic.id, role: "RECEPTIONIST" },
  });
  admin = {
    id: adminUser.id,
    clinicId: clinic.id,
    role: adminUser.role,
  };
  receptionist = {
    id: receptionUser.id,
    clinicId: clinic.id,
    role: receptionUser.role,
  };
});

afterAll(async () => {
  if (!session) return;
  const conversations = await prisma.conversation.findMany({
    where: { guestSessionId: session.id },
    select: { id: true },
  });
  const ids = conversations.map((conversation) => conversation.id);
  await prisma.conversation.deleteMany({ where: { id: { in: ids } } });
  await prisma.auditEvent.deleteMany({
    where: { entityType: "conversation", entityId: { in: ids } },
  });
  await prisma.pendingAction.deleteMany({
    where: { guestSessionId: session.id },
  });
  await prisma.guestSession.delete({ where: { id: session.id } });
});

describe("human desk", () => {
  it("claims a conversation atomically and pauses the AI", async () => {
    await handleChatMessage(session, {
      message: "hello",
      clientMessageId: randomUUID(),
    });
    const conversation = await getOrCreateConversation(session);

    // First claim wins.
    const claimed = await claimConversation(
      admin,
      conversation.id,
      conversation.version,
    );
    expect(claimed.assignedStaffId).toBe(admin.id);
    expect(claimed.status).toBe(ConversationStatus.HUMAN_ACTIVE);

    // Second claim with the stale version loses.
    await expect(
      claimConversation(receptionist, conversation.id, conversation.version),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });

    // AI no longer answers on its own.
    const reply = await handleChatMessage(session, {
      message: "what are your opening hours?",
      clientMessageId: randomUUID(),
    });
    expect(reply.handoff).toBe(true);
    expect(reply.reply.toLowerCase()).toContain("staff member");
  });

  it("cancels pending AI actions when a staff member takes over", async () => {
    const conversation = await getOrCreateConversation(session);
    // Reset to AI_ACTIVE for this test scenario.
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: ConversationStatus.AI_ACTIVE, assignedStaffId: null },
    });
    const current = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
    });

    const action = await createPendingAction({
      clinicId: session.clinicId,
      type: PendingActionType.CREATE_BOOKING,
      guestSessionId: session.id,
      payload: { note: "test" },
      ttlMinutes: 5,
    });

    await claimConversation(receptionist, conversation.id, current.version);

    const after = await prisma.pendingAction.findUniqueOrThrow({
      where: { id: action.id },
    });
    expect(after.status).toBe(PendingActionStatus.CANCELLED);
  });

  it("supports staff replies and staff-only notes without leaking to the visitor", async () => {
    const conversation = await getOrCreateConversation(session);

    await staffReply(admin, conversation.id, "Hello, this is the front desk.");
    await addInternalNote(admin, conversation.id, "Visitor asked about parking");

    const detail = await getConversationDetail(session.clinicId, conversation.id);
    expect(
      detail.messages.some(
        (message) =>
          message.role === "STAFF" &&
          message.content.includes("front desk"),
      ),
    ).toBe(true);
    expect(detail.notes.some((note) => note.content.includes("parking"))).toBe(
      true,
    );

    // The visitor serializer must not expose staff-only notes.
    const visitorHistory = await getConversationHistory(session);
    const leaked = visitorHistory.messages.some((message) =>
      message.content.includes("parking"),
    );
    expect(leaked).toBe(false);
  });
});
