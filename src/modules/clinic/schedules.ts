import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/result";

import {
  findClinicCoverageErrors,
  findWorkingHourErrors,
  type WorkingHourInput,
} from "./validation";

export async function listClinicHours(clinicId: string) {
  return prisma.clinicHour.findMany({
    where: { clinicId },
    orderBy: [{ weekday: "asc" }, { localStart: "asc" }],
  });
}

export async function replaceClinicHours(
  clinicId: string,
  hours: WorkingHourInput[],
) {
  const errors = findWorkingHourErrors(hours);
  if (errors.length) {
    throw new DomainError("VALIDATION_ERROR", errors[0]);
  }

  // Every existing provider working block must still fit inside clinic hours.
  const providerHours = await prisma.workingHour.findMany({
    where: { provider: { clinicId } },
    select: { weekday: true, localStart: true, localEnd: true },
  });
  const coverageErrors = findClinicCoverageErrors(providerHours, hours);
  if (coverageErrors.length) {
    throw new DomainError("VALIDATION_ERROR", coverageErrors[0]);
  }

  return prisma.$transaction(async (tx) => {
    await tx.clinicHour.deleteMany({ where: { clinicId } });
    if (hours.length) {
      await tx.clinicHour.createMany({
        data: hours.map((hour) => ({ clinicId, ...hour })),
      });
    }
    return tx.clinicHour.findMany({
      where: { clinicId },
      orderBy: [{ weekday: "asc" }, { localStart: "asc" }],
    });
  });
}

async function assertProviderBelongs(clinicId: string, providerId: string) {
  const provider = await prisma.provider.findFirst({
    where: { id: providerId, clinicId },
    select: { id: true },
  });
  if (!provider) {
    throw new DomainError("NOT_FOUND", "Provider not found");
  }
}

export async function getProviderSchedule(
  clinicId: string,
  providerId: string,
) {
  await assertProviderBelongs(clinicId, providerId);

  const [workingHours, exceptions] = await Promise.all([
    prisma.workingHour.findMany({
      where: { providerId },
      orderBy: [{ weekday: "asc" }, { localStart: "asc" }],
    }),
    prisma.scheduleException.findMany({
      where: { providerId },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  return { workingHours, exceptions };
}

export async function replaceProviderWorkingHours(
  clinicId: string,
  providerId: string,
  hours: WorkingHourInput[],
) {
  await assertProviderBelongs(clinicId, providerId);

  const clinicHours = await listClinicHours(clinicId);
  const errors = [
    ...findWorkingHourErrors(hours),
    ...findClinicCoverageErrors(hours, clinicHours),
  ];
  if (errors.length) {
    throw new DomainError("VALIDATION_ERROR", errors[0]);
  }

  return prisma.$transaction(async (tx) => {
    await tx.workingHour.deleteMany({ where: { providerId } });
    if (hours.length) {
      await tx.workingHour.createMany({
        data: hours.map((hour) => ({ providerId, ...hour })),
      });
    }
    return tx.workingHour.findMany({
      where: { providerId },
      orderBy: [{ weekday: "asc" }, { localStart: "asc" }],
    });
  });
}

export async function createScheduleException(
  clinicId: string,
  input: { providerId: string; startsAt: string; endsAt: string; reason: string },
) {
  await assertProviderBelongs(clinicId, input.providerId);

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!(startsAt.getTime() < endsAt.getTime())) {
    throw new DomainError("VALIDATION_ERROR", "Time off must end after it starts");
  }

  return prisma.scheduleException.create({
    data: {
      providerId: input.providerId,
      startsAt,
      endsAt,
      reason: input.reason,
    },
  });
}

export async function deleteScheduleException(
  clinicId: string,
  exceptionId: string,
) {
  const exception = await prisma.scheduleException.findFirst({
    where: { id: exceptionId, provider: { clinicId } },
    select: { id: true },
  });
  if (!exception) {
    throw new DomainError("NOT_FOUND", "Schedule exception not found");
  }

  await prisma.scheduleException.delete({ where: { id: exceptionId } });
}
