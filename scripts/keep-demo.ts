import "dotenv/config";

import { prisma } from "../src/lib/db";

/**
 * Keeps only the three realistic demo conversations and clears appointment
 * noise, so screenshots and the dashboard show a clean, coherent state.
 */

const DEMO_CONTACTS = [
  "sara.almansoori@gmail.com",
  "james.whitfield@outlook.com",
  "aisha.kareem@gmail.com",
];

async function main() {
  const clinic = await prisma.clinic.findFirstOrThrow();

  const conversations = await prisma.conversation.findMany({
    where: { clinicId: clinic.id },
    select: { id: true, guestSessionId: true },
  });
  const visitors = await prisma.visitor.findMany({
    where: { clinicId: clinic.id },
    orderBy: { createdAt: "desc" },
    select: { guestSessionId: true, contact: true },
  });
  const contactBySession = new Map<string, string>();
  for (const visitor of visitors) {
    if (!contactBySession.has(visitor.guestSessionId)) {
      contactBySession.set(visitor.guestSessionId, visitor.contact);
    }
  }
  const remove = conversations
    .filter(
      (conversation) =>
        !DEMO_CONTACTS.includes(
          contactBySession.get(conversation.guestSessionId) ?? "",
        ),
    )
    .map((conversation) => conversation.id);
  const removedConversations = remove.length
    ? (await prisma.conversation.deleteMany({ where: { id: { in: remove } } }))
        .count
    : 0;

  const appointments = await prisma.appointment.findMany({
    where: { clinicId: clinic.id },
    select: { id: true },
  });
  const appointmentIds = appointments.map((appointment) => appointment.id);
  if (appointmentIds.length) {
    await prisma.auditEvent.deleteMany({
      where: { entityType: "appointment", entityId: { in: appointmentIds } },
    });
  }
  const removedAppointments = appointmentIds.length
    ? (
        await prisma.appointment.deleteMany({
          where: { id: { in: appointmentIds } },
        })
      ).count
    : 0;

  console.log(
    `Demo reset: removed ${removedConversations} conversation(s), ${removedAppointments} appointment(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
