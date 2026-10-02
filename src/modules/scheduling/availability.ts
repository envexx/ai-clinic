import { DateTime } from "luxon";

import { AppointmentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/result";
import { getClinicSettings } from "@/modules/clinic/clinic";

export type AvailabilitySlot = {
  providerId: string;
  providerName: string;
  serviceId: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  occupiedEnd: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMinor: number;
  currency: string;
  timezone: string;
};

export type AvailabilityInput = {
  clinicId: string;
  serviceId: string;
  providerId?: string;
  /** ISO date/datetime lower bound (clinic timezone when date-only). */
  from?: string;
  /** ISO date/datetime upper bound. */
  to?: string;
  limit?: number;
  /** Ignore this appointment when checking conflicts (used by reschedule). */
  excludeAppointmentId?: string;
};

const ACTIVE_STATUSES = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
];

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function getAvailableSlots(
  input: AvailabilityInput,
): Promise<AvailabilitySlot[]> {
  const clinic = await getClinicSettings(input.clinicId);
  const zone = clinic.timezone;

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, clinicId: input.clinicId, active: true },
    include: { providerServices: true },
  });
  if (!service) {
    throw new DomainError("NOT_FOUND", "Service not found");
  }

  let providerIds = service.providerServices.map((link) => link.providerId);
  if (input.providerId) {
    if (!providerIds.includes(input.providerId)) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Provider does not offer this service",
      );
    }
    providerIds = [input.providerId];
  }
  if (providerIds.length === 0) return [];

  const providers = await prisma.provider.findMany({
    where: { id: { in: providerIds }, clinicId: input.clinicId, active: true },
    select: { id: true, displayName: true },
  });
  if (providers.length === 0) return [];
  const providerName = new Map(providers.map((p) => [p.id, p.displayName]));
  providerIds = providers.map((p) => p.id);

  const now = DateTime.utc();
  const noticeStart = now.plus({ minutes: clinic.minimumNoticeMinutes });
  const horizonEnd = now.plus({ days: clinic.bookingHorizonDays });

  const rangeFrom = input.from
    ? DateTime.fromISO(input.from, { zone }).startOf("day")
    : noticeStart.setZone(zone).startOf("day");
  const rangeTo = input.to
    ? DateTime.fromISO(input.to, { zone }).endOf("day")
    : horizonEnd.setZone(zone).endOf("day");

  const effectiveStart = DateTime.max(rangeFrom, noticeStart.setZone(zone));
  const effectiveEnd = DateTime.min(rangeTo, horizonEnd.setZone(zone));
  if (!effectiveStart.isValid || !effectiveEnd.isValid || effectiveStart > effectiveEnd) {
    return [];
  }

  const [workingHours, exceptions, appointments] = await Promise.all([
    prisma.workingHour.findMany({ where: { providerId: { in: providerIds } } }),
    prisma.scheduleException.findMany({
      where: {
        providerId: { in: providerIds },
        startsAt: { lt: effectiveEnd.toJSDate() },
        endsAt: { gt: effectiveStart.toJSDate() },
      },
    }),
    prisma.appointment.findMany({
      where: {
        providerId: { in: providerIds },
        status: { in: ACTIVE_STATUSES },
        startAt: { lt: effectiveEnd.toJSDate() },
        occupiedEnd: { gt: effectiveStart.toJSDate() },
        ...(input.excludeAppointmentId
          ? { id: { not: input.excludeAppointmentId } }
          : {}),
      },
      select: { providerId: true, startAt: true, occupiedEnd: true },
    }),
  ]);

  const hoursByProvider = new Map<string, Map<number, { start: string; end: string }[]>>();
  for (const hour of workingHours) {
    const byDay = hoursByProvider.get(hour.providerId) ?? new Map();
    const list = byDay.get(hour.weekday) ?? [];
    list.push({ start: hour.localStart, end: hour.localEnd });
    byDay.set(hour.weekday, list);
    hoursByProvider.set(hour.providerId, byDay);
  }

  const exceptionsByProvider = new Map<string, { start: number; end: number }[]>();
  for (const exception of exceptions) {
    const list = exceptionsByProvider.get(exception.providerId) ?? [];
    list.push({
      start: exception.startsAt.getTime(),
      end: exception.endsAt.getTime(),
    });
    exceptionsByProvider.set(exception.providerId, list);
  }

  const appointmentsByProvider = new Map<string, { start: number; end: number }[]>();
  for (const appointment of appointments) {
    const list = appointmentsByProvider.get(appointment.providerId) ?? [];
    list.push({
      start: appointment.startAt.getTime(),
      end: appointment.occupiedEnd.getTime(),
    });
    appointmentsByProvider.set(appointment.providerId, list);
  }

  const occupiedMinutes = service.durationMinutes + service.bufferMinutes;
  const granularity = clinic.slotGranularityMinutes;
  const limit = input.limit ?? 200;
  const slots: AvailabilitySlot[] = [];

  let day = effectiveStart.startOf("day");
  const lastDay = effectiveEnd.startOf("day");
  let guard = 0;

  while (day <= lastDay && slots.length < limit && guard < 400) {
    guard += 1;
    const weekday = day.weekday; // Luxon: 1=Mon .. 7=Sun
    const isoDate = day.toISODate();
    if (!isoDate) break;

    for (const providerId of providerIds) {
      const blocks = hoursByProvider.get(providerId)?.get(weekday);
      if (!blocks) continue;

      for (const block of blocks) {
        const blockStart = DateTime.fromISO(`${isoDate}T${block.start}`, {
          zone,
        });
        const blockEnd = DateTime.fromISO(`${isoDate}T${block.end}`, { zone });
        if (!blockStart.isValid || !blockEnd.isValid) continue;

        let cursor = blockStart;
        while (
          cursor.plus({ minutes: occupiedMinutes }) <= blockEnd &&
          slots.length < limit
        ) {
          const occupiedEnd = cursor.plus({ minutes: occupiedMinutes });
          const startMs = cursor.toMillis();
          const occupiedMs = occupiedEnd.toMillis();

          const afterNotice = cursor >= noticeStart.setZone(zone);
          const beforeHorizon = occupiedEnd <= horizonEnd.setZone(zone);
          const inWindow =
            startMs >= effectiveStart.toMillis() &&
            occupiedMs <= effectiveEnd.toMillis();

          const exceptionConflict = (
            exceptionsByProvider.get(providerId) ?? []
          ).some((e) => overlaps(startMs, occupiedMs, e.start, e.end));
          const appointmentConflict = (
            appointmentsByProvider.get(providerId) ?? []
          ).some((a) => overlaps(startMs, occupiedMs, a.start, a.end));

          if (
            afterNotice &&
            beforeHorizon &&
            inWindow &&
            !exceptionConflict &&
            !appointmentConflict
          ) {
            slots.push({
              providerId,
              providerName: providerName.get(providerId) ?? providerId,
              serviceId: service.id,
              serviceName: service.name,
              startAt: cursor.toUTC().toISO()!,
              endAt: cursor.plus({ minutes: service.durationMinutes }).toUTC().toISO()!,
              occupiedEnd: occupiedEnd.toUTC().toISO()!,
              durationMinutes: service.durationMinutes,
              bufferMinutes: service.bufferMinutes,
              priceMinor: service.priceMinor,
              currency: clinic.currency,
              timezone: zone,
            });
          }

          cursor = cursor.plus({ minutes: granularity });
        }
      }
    }

    day = day.plus({ days: 1 });
  }

  slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return slots.slice(0, limit);
}
