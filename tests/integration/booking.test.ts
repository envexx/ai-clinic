import "dotenv/config";

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppointmentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  confirmPendingAction,
  listVisitorAppointments,
  prepareBooking,
} from "@/modules/appointments/appointments";
import { getAvailableSlots } from "@/modules/scheduling/availability";

let clinicId: string;
let serviceId: string;
let service: {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMinor: number;
};
let session: { id: string; clinicId: string };
const extraSessionIds: string[] = [];

function ref(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function createVisitor(name: string) {
  return prisma.visitor.create({
    data: {
      clinicId,
      guestSessionId: session.id,
      displayName: name,
      contact: "integration@example.com",
      consentAt: new Date(),
    },
  });
}

beforeAll(async () => {
  const clinic = await prisma.clinic.findFirstOrThrow();
  clinicId = clinic.id;
  const found = await prisma.service.findFirstOrThrow({
    where: { clinicId, active: true },
  });
  service = {
    id: found.id,
    name: found.name,
    durationMinutes: found.durationMinutes,
    bufferMinutes: found.bufferMinutes,
    priceMinor: found.priceMinor,
  };
  serviceId = found.id;

  const guest = await prisma.guestSession.create({
    data: {
      clinicId,
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  session = { id: guest.id, clinicId };
});

afterAll(async () => {
  if (!session) {
    if (extraSessionIds.length) {
      await prisma.guestSession.deleteMany({
        where: { id: { in: extraSessionIds } },
      });
    }
    return;
  }
  const sessionIds = [session.id, ...extraSessionIds];
  const visitors = await prisma.visitor.findMany({
    where: { guestSessionId: { in: sessionIds } },
    select: { id: true },
  });
  const visitorIds = visitors.map((v) => v.id);
  const appointments = await prisma.appointment.findMany({
    where: { visitorId: { in: visitorIds } },
    select: { id: true },
  });
  const appointmentIds = appointments.map((a) => a.id);
  const actions = await prisma.pendingAction.findMany({
    where: { guestSessionId: { in: sessionIds } },
    select: { id: true },
  });
  const actionIds = actions.map((a) => a.id);

  await prisma.auditEvent.deleteMany({
    where: { entityId: { in: appointmentIds } },
  });
  await prisma.idempotencyRecord.deleteMany({
    where: { scope: { in: actionIds.map((id) => `pending_action:${id}`) } },
  });
  await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  await prisma.visitor.deleteMany({ where: { id: { in: visitorIds } } });
  await prisma.pendingAction.deleteMany({ where: { id: { in: actionIds } } });
  await prisma.guestSession.delete({ where: { id: session.id } });
  if (extraSessionIds.length) {
    await prisma.guestSession.deleteMany({
      where: { id: { in: extraSessionIds } },
    });
  }
});

describe("booking domain", () => {
  it("returns available slots for a seeded service", async () => {
    const slots = await getAvailableSlots({ clinicId, serviceId, limit: 5 });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].startAt).toMatch(/Z$/);
  });

  it("rejects overlapping active appointments at the database level", async () => {
    const slots = await getAvailableSlots({ clinicId, serviceId, limit: 1 });
    const slot = slots[0];
    const visitor = await createVisitor("Constraint Visitor");

    const base = {
      clinicId,
      visitorId: visitor.id,
      serviceId,
      providerId: slot.providerId,
      serviceName: service.name,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      priceMinor: service.priceMinor,
      currency: "AED",
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt),
      occupiedEnd: new Date(slot.occupiedEnd),
      status: AppointmentStatus.CONFIRMED,
    };

    const created = await prisma.appointment.create({
      data: { ...base, bookingReference: ref("WN") },
    });
    await expect(
      prisma.appointment.create({ data: { ...base, bookingReference: ref("WN") } }),
    ).rejects.toThrow();

    // Cancelling frees the interval, so a new appointment may reuse it.
    await prisma.appointment.update({
      where: { id: created.id },
      data: { status: AppointmentStatus.CANCELLED },
    });
    await prisma.appointment.delete({ where: { id: created.id } });
  });

  it("prepares and confirms a booking atomically, then replays idempotently", async () => {
    const slots = await getAvailableSlots({ clinicId, serviceId, limit: 1 });
    const slot = slots[0];

    const prepared = await prepareBooking(session, {
      serviceId,
      providerId: slot.providerId,
      startAt: slot.startAt,
      displayName: "Integration Visitor",
      contact: "integration@example.com",
      consent: true,
    });
    expect(prepared.actionId).toBeTruthy();

    const appointment = await confirmPendingAction(
      session,
      prepared.actionId,
      "integration-key-1",
    );
    expect(appointment.bookingReference).toMatch(/^WN-/);

    // Retrying with the same key returns the same result, not a duplicate.
    const replay = await confirmPendingAction(
      session,
      prepared.actionId,
      "integration-key-1",
    );
    expect(replay.id).toBe(appointment.id);

    const mine = await listVisitorAppointments(session);
    const matches = mine.filter((item) => item.id === appointment.id);
    expect(matches).toHaveLength(1);
  });

  it("lets only one booking win a contested slot", async () => {
    const slots = await getAvailableSlots({ clinicId, serviceId, limit: 1 });
    const slot = slots[0];

    // Two different browsers (guest sessions) contest the same slot.
    const otherGuest = await prisma.guestSession.create({
      data: {
        clinicId,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    extraSessionIds.push(otherGuest.id);
    const otherSession = { id: otherGuest.id, clinicId };

    const first = await prepareBooking(session, {
      serviceId,
      providerId: slot.providerId,
      startAt: slot.startAt,
      displayName: "First",
      contact: "first@example.com",
      consent: true,
    });
    const second = await prepareBooking(otherSession, {
      serviceId,
      providerId: slot.providerId,
      startAt: slot.startAt,
      displayName: "Second",
      contact: "second@example.com",
      consent: true,
    });

    await confirmPendingAction(session, first.actionId, "contest-key-a");

    await expect(
      confirmPendingAction(otherSession, second.actionId, "contest-key-b"),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  async function prepareTwentyForSameSlot() {
    const slots = await getAvailableSlots({ clinicId, serviceId, limit: 1 });
    const slot = slots[0];

    const guests = [];
    for (let i = 0; i < 20; i += 1) {
      guests.push(
        await prisma.guestSession.create({
          data: {
            clinicId,
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 3_600_000),
          },
        }),
      );
    }
    extraSessionIds.push(...guests.map((guest) => guest.id));

    const prepared = [];
    for (let i = 0; i < 20; i += 1) {
      prepared.push(
        await prepareBooking(
          { id: guests[i].id, clinicId },
          {
            serviceId,
            providerId: slot.providerId,
            startAt: slot.startAt,
            displayName: `Guest ${i}`,
            contact: `guest${i}@example.com`,
            consent: true,
          },
        ),
      );
    }
    return { guests, prepared };
  }

  // Deterministic version that runs on any database, including local Prisma
  // Postgres (single connection).
  it("lets exactly one of 20 prepared attempts win a slot", async () => {
    const { guests, prepared } = await prepareTwentyForSameSlot();

    const outcomes: { ok: boolean; code?: string }[] = [];
    for (let i = 0; i < 20; i += 1) {
      try {
        await confirmPendingAction(
          { id: guests[i].id, clinicId },
          prepared[i].actionId,
          `sequential-key-${i}`,
        );
        outcomes.push({ ok: true });
      } catch (error) {
        outcomes.push({ ok: false, code: (error as { code?: string }).code });
      }
    }

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(
      outcomes
        .filter((outcome) => !outcome.ok)
        .every((outcome) => outcome.code === "SLOT_UNAVAILABLE"),
    ).toBe(true);
  });

  // True parallel gate (PRD AT-08). Requires a database with real concurrent
  // connections; local Prisma Postgres is single-connection, so enable it with
  // RUN_CONCURRENCY_GATE=1 against hosted Prisma Postgres.
  it.skipIf(process.env.RUN_CONCURRENCY_GATE !== "1")(
    "resolves 20 concurrent attempts for one slot to exactly one winner",
    async () => {
      const { guests, prepared } = await prepareTwentyForSameSlot();

      const results = await Promise.allSettled(
        prepared.map((action, index) =>
          confirmPendingAction(
            { id: guests[index].id, clinicId },
            action.actionId,
            `concurrency-key-${index}`,
          ),
        ),
      );

      const fulfilled = results.filter((result) => result.status === "fulfilled");
      expect(fulfilled).toHaveLength(1);
      expect(
        results
          .filter((result) => result.status === "rejected")
          .every(
            (result) =>
              result.status === "rejected" &&
              (result.reason as { code?: string }).code === "SLOT_UNAVAILABLE",
          ),
      ).toBe(true);
    },
  );
});
