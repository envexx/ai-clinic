import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { AppointmentStatus, PendingActionType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/result";
import { writeAudit } from "@/modules/audit/audit";
import { getClinicSettings } from "@/modules/clinic/clinic";
import {
  getAvailableSlots,
  type AvailabilitySlot,
} from "@/modules/scheduling/availability";

import {
  assertActionUsable,
  createPendingAction,
  getOwnedAction,
} from "./actions";
import {
  checkIdempotency,
  hashPayload,
  idempotencyConflict,
  recordIdempotency,
} from "./idempotency";
import type {
  PrepareBookingInput,
  PrepareCancellationInput,
  PrepareRescheduleInput,
  StaffStatusInput,
} from "./validation";

export type GuestSessionRef = { id: string; clinicId: string };

export type AppointmentSummary = {
  id: string;
  bookingReference: string;
  serviceId: string;
  serviceName: string;
  providerId: string;
  providerName: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  version: number;
};

export type PreparedAction = {
  actionId: string;
  type: PendingActionType;
  expiresAt: string;
  summary: Record<string, unknown>;
};

const ACTIVE_STATUSES = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
];

function generateBookingReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < bytes.length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `WN-${code}`;
}

function isSlotConflictError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /exclusion|no_overlap|23P01/i.test(message);
}

function toSummary(
  appointment: {
    id: string;
    bookingReference: string;
    serviceId: string;
    serviceName: string;
    providerId: string;
    startAt: Date;
    endAt: Date;
    status: AppointmentStatus;
    durationMinutes: number;
    priceMinor: number;
    currency: string;
    version: number;
  },
  providerName: string,
): AppointmentSummary {
  return {
    id: appointment.id,
    bookingReference: appointment.bookingReference,
    serviceId: appointment.serviceId,
    serviceName: appointment.serviceName,
    providerId: appointment.providerId,
    providerName,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    status: appointment.status,
    durationMinutes: appointment.durationMinutes,
    priceMinor: appointment.priceMinor,
    currency: appointment.currency,
    version: appointment.version,
  };
}

async function resolveBookableSlot(
  clinicId: string,
  serviceId: string,
  providerId: string | undefined,
  startAtIso: string,
  excludeAppointmentId?: string,
): Promise<AvailabilitySlot> {
  const target = new Date(startAtIso).getTime();
  const day = startAtIso.slice(0, 10);
  const slots = await getAvailableSlots({
    clinicId,
    serviceId,
    providerId,
    from: day,
    to: day,
    limit: 500,
    excludeAppointmentId,
  });

  const match = slots.find(
    (slot) =>
      new Date(slot.startAt).getTime() === target &&
      (!providerId || slot.providerId === providerId),
  );
  if (!match) {
    throw new DomainError(
      "SLOT_UNAVAILABLE",
      "That time is not available. Please choose another slot.",
      true,
    );
  }
  return match;
}

export async function prepareBooking(
  session: GuestSessionRef,
  input: PrepareBookingInput,
): Promise<PreparedAction> {
  const clinic = await getClinicSettings(session.clinicId);
  const slot = await resolveBookableSlot(
    session.clinicId,
    input.serviceId,
    input.providerId,
    input.startAt,
  );

  const payload = {
    serviceId: slot.serviceId,
    serviceName: slot.serviceName,
    providerId: slot.providerId,
    providerName: slot.providerName,
    startAt: slot.startAt,
    endAt: slot.endAt,
    occupiedEnd: slot.occupiedEnd,
    durationMinutes: slot.durationMinutes,
    bufferMinutes: slot.bufferMinutes,
    priceMinor: slot.priceMinor,
    currency: slot.currency,
    displayName: input.displayName,
    contact: input.contact,
    consentAt: new Date().toISOString(),
  };

  const action = await createPendingAction({
    clinicId: session.clinicId,
    type: PendingActionType.CREATE_BOOKING,
    guestSessionId: session.id,
    payload,
    ttlMinutes: clinic.pendingActionTtlMinutes,
  });

  return {
    actionId: action.id,
    type: action.type,
    expiresAt: action.expiresAt.toISOString(),
    summary: {
      kind: "booking",
      serviceName: slot.serviceName,
      providerName: slot.providerName,
      startAt: slot.startAt,
      endAt: slot.endAt,
      durationMinutes: slot.durationMinutes,
      priceMinor: slot.priceMinor,
      currency: slot.currency,
      timezone: slot.timezone,
      displayName: input.displayName,
    },
  };
}

export async function prepareReschedule(
  session: GuestSessionRef,
  input: PrepareRescheduleInput,
): Promise<PreparedAction> {
  const clinic = await getClinicSettings(session.clinicId);
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: { visitor: true },
  });
  if (!appointment || appointment.visitor.guestSessionId !== session.id) {
    throw new DomainError("NOT_FOUND", "Appointment not found");
  }
  if (appointment.status !== AppointmentStatus.CONFIRMED) {
    throw new DomainError(
      "POLICY_REQUIRES_STAFF",
      "This appointment can no longer be changed online",
    );
  }
  if (appointment.version !== input.expectedVersion) {
    throw new DomainError(
      "VERSION_CONFLICT",
      "This appointment changed. Please review the latest details.",
    );
  }

  const slot = await resolveBookableSlot(
    session.clinicId,
    appointment.serviceId,
    input.providerId ?? appointment.providerId,
    input.startAt,
    appointment.id,
  );

  const payload = {
    appointmentId: appointment.id,
    expectedVersion: input.expectedVersion,
    providerId: slot.providerId,
    providerName: slot.providerName,
    startAt: slot.startAt,
    endAt: slot.endAt,
    occupiedEnd: slot.occupiedEnd,
  };

  const action = await createPendingAction({
    clinicId: session.clinicId,
    type: PendingActionType.RESCHEDULE_BOOKING,
    guestSessionId: session.id,
    payload,
    ttlMinutes: clinic.pendingActionTtlMinutes,
  });

  return {
    actionId: action.id,
    type: action.type,
    expiresAt: action.expiresAt.toISOString(),
    summary: {
      kind: "reschedule",
      bookingReference: appointment.bookingReference,
      serviceName: appointment.serviceName,
      providerName: slot.providerName,
      from: appointment.startAt.toISOString(),
      to: slot.startAt,
      endAt: slot.endAt,
      timezone: slot.timezone,
    },
  };
}

export async function prepareCancellation(
  session: GuestSessionRef,
  input: PrepareCancellationInput,
): Promise<PreparedAction> {
  const clinic = await getClinicSettings(session.clinicId);
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: { visitor: true },
  });
  if (!appointment || appointment.visitor.guestSessionId !== session.id) {
    throw new DomainError("NOT_FOUND", "Appointment not found");
  }
  if (appointment.status !== AppointmentStatus.CONFIRMED) {
    throw new DomainError(
      "POLICY_REQUIRES_STAFF",
      "This appointment can no longer be cancelled online",
    );
  }
  if (appointment.version !== input.expectedVersion) {
    throw new DomainError(
      "VERSION_CONFLICT",
      "This appointment changed. Please review the latest details.",
    );
  }

  const action = await createPendingAction({
    clinicId: session.clinicId,
    type: PendingActionType.CANCEL_BOOKING,
    guestSessionId: session.id,
    payload: {
      appointmentId: appointment.id,
      expectedVersion: input.expectedVersion,
    },
    ttlMinutes: clinic.pendingActionTtlMinutes,
  });

  return {
    actionId: action.id,
    type: action.type,
    expiresAt: action.expiresAt.toISOString(),
    summary: {
      kind: "cancel",
      bookingReference: appointment.bookingReference,
      serviceName: appointment.serviceName,
      startAt: appointment.startAt.toISOString(),
    },
  };
}

type CreateBookingPayload = {
  serviceId: string;
  serviceName: string;
  providerId: string;
  providerName: string;
  startAt: string;
  endAt: string;
  occupiedEnd: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMinor: number;
  currency: string;
  displayName: string;
  contact: string;
  consentAt: string;
};

type ReschedulePayload = {
  appointmentId: string;
  expectedVersion: number;
  providerId: string;
  providerName: string;
  startAt: string;
  endAt: string;
  occupiedEnd: string;
};

type CancelPayload = { appointmentId: string; expectedVersion: number };

async function executeCreate(
  tx: Prisma.TransactionClient,
  session: GuestSessionRef,
  payload: CreateBookingPayload,
): Promise<AppointmentSummary> {
  const startAt = new Date(payload.startAt);
  const occupiedEnd = new Date(payload.occupiedEnd);

  const conflict = await tx.appointment.findFirst({
    where: {
      providerId: payload.providerId,
      status: { in: ACTIVE_STATUSES },
      startAt: { lt: occupiedEnd },
      occupiedEnd: { gt: startAt },
    },
    select: { id: true },
  });
  if (conflict) {
    throw new DomainError(
      "SLOT_UNAVAILABLE",
      "That slot was just taken. Please choose another.",
      true,
    );
  }

  const visitor = await tx.visitor.create({
    data: {
      clinicId: session.clinicId,
      guestSessionId: session.id,
      displayName: payload.displayName,
      contact: payload.contact,
      consentAt: new Date(payload.consentAt),
    },
  });

  const appointment = await tx.appointment.create({
    data: {
      clinicId: session.clinicId,
      visitorId: visitor.id,
      serviceId: payload.serviceId,
      providerId: payload.providerId,
      bookingReference: generateBookingReference(),
      serviceName: payload.serviceName,
      durationMinutes: payload.durationMinutes,
      bufferMinutes: payload.bufferMinutes,
      priceMinor: payload.priceMinor,
      currency: payload.currency,
      startAt,
      endAt: new Date(payload.endAt),
      occupiedEnd,
      status: AppointmentStatus.CONFIRMED,
    },
  });

  await writeAudit(
    {
      clinicId: session.clinicId,
      actorType: "GUEST",
      actorId: session.id,
      action: "APPOINTMENT_CREATED",
      entityType: "appointment",
      entityId: appointment.id,
      after: {
        bookingReference: appointment.bookingReference,
        providerId: appointment.providerId,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
      },
    },
    tx,
  );

  return toSummary(appointment, payload.providerName);
}

async function executeReschedule(
  tx: Prisma.TransactionClient,
  session: GuestSessionRef,
  payload: ReschedulePayload,
): Promise<AppointmentSummary> {
  const appointment = await tx.appointment.findUnique({
    where: { id: payload.appointmentId },
    include: { visitor: true },
  });
  if (!appointment || appointment.visitor.guestSessionId !== session.id) {
    throw new DomainError("NOT_FOUND", "Appointment not found");
  }
  if (appointment.status !== AppointmentStatus.CONFIRMED) {
    throw new DomainError(
      "POLICY_REQUIRES_STAFF",
      "This appointment can no longer be changed online",
    );
  }
  if (appointment.version !== payload.expectedVersion) {
    throw new DomainError(
      "VERSION_CONFLICT",
      "This appointment changed. Please review the latest details.",
    );
  }

  const startAt = new Date(payload.startAt);
  const occupiedEnd = new Date(payload.occupiedEnd);
  const conflict = await tx.appointment.findFirst({
    where: {
      id: { not: appointment.id },
      providerId: payload.providerId,
      status: { in: ACTIVE_STATUSES },
      startAt: { lt: occupiedEnd },
      occupiedEnd: { gt: startAt },
    },
    select: { id: true },
  });
  if (conflict) {
    throw new DomainError(
      "SLOT_UNAVAILABLE",
      "That slot was just taken. The original appointment is unchanged.",
      true,
    );
  }

  const updated = await tx.appointment.update({
    where: { id: appointment.id },
    data: {
      providerId: payload.providerId,
      startAt,
      endAt: new Date(payload.endAt),
      occupiedEnd,
      version: { increment: 1 },
    },
  });

  await writeAudit(
    {
      clinicId: session.clinicId,
      actorType: "GUEST",
      actorId: session.id,
      action: "APPOINTMENT_RESCHEDULED",
      entityType: "appointment",
      entityId: appointment.id,
      before: {
        providerId: appointment.providerId,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
      },
      after: {
        providerId: updated.providerId,
        startAt: updated.startAt,
        endAt: updated.endAt,
      },
    },
    tx,
  );

  return toSummary(updated, payload.providerName);
}

async function executeCancel(
  tx: Prisma.TransactionClient,
  session: GuestSessionRef,
  payload: CancelPayload,
): Promise<AppointmentSummary> {
  const appointment = await tx.appointment.findUnique({
    where: { id: payload.appointmentId },
    include: { visitor: true, provider: true },
  });
  if (!appointment || appointment.visitor.guestSessionId !== session.id) {
    throw new DomainError("NOT_FOUND", "Appointment not found");
  }
  if (appointment.status !== AppointmentStatus.CONFIRMED) {
    throw new DomainError(
      "POLICY_REQUIRES_STAFF",
      "This appointment can no longer be cancelled online",
    );
  }
  if (appointment.version !== payload.expectedVersion) {
    throw new DomainError(
      "VERSION_CONFLICT",
      "This appointment changed. Please review the latest details.",
    );
  }

  const updated = await tx.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      version: { increment: 1 },
    },
  });

  await writeAudit(
    {
      clinicId: session.clinicId,
      actorType: "GUEST",
      actorId: session.id,
      action: "APPOINTMENT_CANCELLED",
      entityType: "appointment",
      entityId: appointment.id,
      before: { status: appointment.status },
      after: { status: updated.status },
    },
    tx,
  );

  return toSummary(updated, appointment.provider.displayName);
}

export async function confirmPendingAction(
  session: GuestSessionRef,
  actionId: string,
  idempotencyKey: string,
): Promise<AppointmentSummary> {
  const action = await getOwnedAction(session.id, actionId);
  const scope = `pending_action:${action.id}`;
  const requestHash = hashPayload(action.payload);

  // Idempotent replay: the same key + payload returns the stored result even
  // after the action was consumed (covers a client retry after a timeout).
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { scope_key: { scope, key: idempotencyKey } },
  });
  if (existing) {
    if (existing.requestHash !== requestHash) throw idempotencyConflict();
    return existing.result as unknown as AppointmentSummary;
  }

  await assertActionUsable(action);

  try {
    return await prisma.$transaction(async (tx) => {
      const lookup = await checkIdempotency(tx, scope, idempotencyKey, requestHash);
      if (lookup.kind === "conflict") throw idempotencyConflict();
      if (lookup.kind === "replay") {
        return lookup.result as unknown as AppointmentSummary;
      }

      let outcome: AppointmentSummary;
      if (action.type === PendingActionType.CREATE_BOOKING) {
        outcome = await executeCreate(
          tx,
          session,
          action.payload as unknown as CreateBookingPayload,
        );
      } else if (action.type === PendingActionType.RESCHEDULE_BOOKING) {
        outcome = await executeReschedule(
          tx,
          session,
          action.payload as unknown as ReschedulePayload,
        );
      } else {
        outcome = await executeCancel(
          tx,
          session,
          action.payload as unknown as CancelPayload,
        );
      }

      await tx.pendingAction.update({
        where: { id: action.id },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });

      await recordIdempotency(tx, scope, idempotencyKey, requestHash, outcome);
      return outcome;
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isSlotConflictError(error)) {
      throw new DomainError(
        "SLOT_UNAVAILABLE",
        "That slot was just taken. Please choose another.",
        true,
      );
    }
    throw error;
  }
}

export type StaffAppointmentRow = AppointmentSummary & {
  visitorName: string;
  contact: string;
};

export async function listClinicAppointments(
  clinicId: string,
  filters: { status?: AppointmentStatus; from?: string; to?: string },
): Promise<StaffAppointmentRow[]> {
  const where: Prisma.AppointmentWhereInput = { clinicId };
  if (filters.status) where.status = filters.status;
  if (filters.from || filters.to) {
    where.startAt = {};
    if (filters.from) where.startAt.gte = new Date(filters.from);
    if (filters.to) where.startAt.lte = new Date(filters.to);
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    take: 200,
    include: {
      provider: true,
      visitor: { select: { displayName: true, contact: true } },
    },
  });

  return appointments.map((appointment) => ({
    ...toSummary(appointment, appointment.provider.displayName),
    visitorName: appointment.visitor.displayName,
    contact: appointment.visitor.contact,
  }));
}

export async function listVisitorAppointments(
  session: GuestSessionRef,
): Promise<AppointmentSummary[]> {
  const appointments = await prisma.appointment.findMany({
    where: { visitor: { guestSessionId: session.id } },
    include: { provider: true },
    orderBy: { startAt: "asc" },
  });
  return appointments.map((appointment) =>
    toSummary(appointment, appointment.provider.displayName),
  );
}

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  CONFIRMED: [
    AppointmentStatus.CHECKED_IN,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  CHECKED_IN: [AppointmentStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export async function updateAppointmentStatus(
  staff: { id: string; clinicId: string; role: string },
  appointmentId: string,
  input: StaffStatusInput,
): Promise<AppointmentSummary> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId: staff.clinicId },
    include: { provider: true },
  });
  if (!appointment) {
    throw new DomainError("NOT_FOUND", "Appointment not found");
  }
  if (appointment.version !== input.expectedVersion) {
    throw new DomainError(
      "VERSION_CONFLICT",
      "This appointment changed. Please reload it.",
    );
  }

  const target = input.status as AppointmentStatus;
  const allowed = ALLOWED_TRANSITIONS[appointment.status].includes(target);
  const adminOverride = staff.role === "ADMIN" && Boolean(input.reason);
  if (!allowed && !adminOverride) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `Cannot move an appointment from ${appointment.status} to ${target}`,
    );
  }

  const timestampField: Partial<
    Record<AppointmentStatus, "checkedInAt" | "completedAt" | "cancelledAt" | "noShowAt">
  > = {
    CHECKED_IN: "checkedInAt",
    COMPLETED: "completedAt",
    CANCELLED: "cancelledAt",
    NO_SHOW: "noShowAt",
  };

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: target,
        version: { increment: 1 },
        ...(timestampField[target]
          ? { [timestampField[target] as string]: new Date() }
          : {}),
      },
    });
    await writeAudit(
      {
        clinicId: staff.clinicId,
        actorType: "STAFF",
        actorId: staff.id,
        action: "APPOINTMENT_STATUS_CHANGED",
        entityType: "appointment",
        entityId: appointment.id,
        before: { status: appointment.status },
        after: { status: target, reason: input.reason ?? null },
      },
      tx,
    );
    return next;
  });

  return toSummary(updated, appointment.provider.displayName);
}
