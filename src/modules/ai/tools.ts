import { prisma } from "@/lib/db";
import {
  listVisitorAppointments,
  prepareBooking,
  prepareCancellation,
  prepareReschedule,
  type GuestSessionRef,
} from "@/modules/appointments/appointments";
import type {
  PrepareBookingInput,
  PrepareCancellationInput,
  PrepareRescheduleInput,
} from "@/modules/appointments/validation";
import { searchKnowledge } from "@/modules/knowledge/retrieval";
import { getAvailableSlots } from "@/modules/scheduling/availability";

export type AgentContext = {
  clinicId: string;
  session: GuestSessionRef;
};

/** Read tools. These never mutate anything. */

export async function toolSearchKnowledge(
  ctx: AgentContext,
  query: string,
  limit = 4,
) {
  return searchKnowledge(ctx.clinicId, query, limit);
}

export async function toolGetServices(clinicId: string) {
  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { currency: true },
  });
  const services = await prisma.service.findMany({
    where: { clinicId, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      bufferMinutes: true,
      priceMinor: true,
    },
  });
  return services.map((service) => ({ ...service, currency: clinic.currency }));
}

export async function toolGetAvailableSlots(
  ctx: AgentContext,
  input: {
    serviceId: string;
    providerId?: string;
    from?: string;
    to?: string;
  },
) {
  return getAvailableSlots({
    clinicId: ctx.clinicId,
    limit: 12,
    ...input,
  });
}

export async function toolGetOwnedAppointments(ctx: AgentContext) {
  return listVisitorAppointments(ctx.session);
}

/** Action tools. They only PREPARE a pending action; they never confirm. */

export async function toolPrepareBooking(
  ctx: AgentContext,
  input: PrepareBookingInput,
) {
  return prepareBooking(ctx.session, input);
}

export async function toolPrepareReschedule(
  ctx: AgentContext,
  input: PrepareRescheduleInput,
) {
  return prepareReschedule(ctx.session, input);
}

export async function toolPrepareCancellation(
  ctx: AgentContext,
  input: PrepareCancellationInput,
) {
  return prepareCancellation(ctx.session, input);
}
