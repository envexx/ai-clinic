import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/result";

import { getClinicSettings } from "./clinic";
import type { ServiceInput, ServiceUpdate } from "./validation";

function assertGranularity(
  granularity: number,
  durationMinutes: number,
  bufferMinutes: number,
): void {
  if (durationMinutes % granularity !== 0) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `Duration must be a multiple of ${granularity} minutes`,
    );
  }
  if (bufferMinutes % granularity !== 0) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `Buffer must be a multiple of ${granularity} minutes`,
    );
  }
}

async function assertProvidersBelong(
  clinicId: string,
  providerIds: string[],
): Promise<void> {
  if (providerIds.length === 0) return;
  const unique = [...new Set(providerIds)];
  const count = await prisma.provider.count({
    where: { clinicId, id: { in: unique } },
  });
  if (count !== unique.length) {
    throw new DomainError("VALIDATION_ERROR", "One or more providers are unknown");
  }
}

export async function listServices(clinicId: string) {
  return prisma.service.findMany({
    where: { clinicId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { providerServices: { select: { providerId: true } } },
  });
}

export async function createService(clinicId: string, input: ServiceInput) {
  const clinic = await getClinicSettings(clinicId);
  assertGranularity(
    clinic.slotGranularityMinutes,
    input.durationMinutes,
    input.bufferMinutes,
  );
  await assertProvidersBelong(clinicId, input.providerIds);

  return prisma.$transaction(async (tx) => {
    const service = await tx.service.create({
      data: {
        clinicId,
        name: input.name,
        durationMinutes: input.durationMinutes,
        bufferMinutes: input.bufferMinutes,
        priceMinor: input.priceMinor,
      },
    });

    if (input.providerIds.length) {
      await tx.providerService.createMany({
        data: [...new Set(input.providerIds)].map((providerId) => ({
          providerId,
          serviceId: service.id,
        })),
      });
    }

    return service;
  });
}

export async function updateService(
  clinicId: string,
  serviceId: string,
  input: ServiceUpdate,
) {
  const existing = await prisma.service.findFirst({
    where: { id: serviceId, clinicId },
  });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Service not found");
  }

  const clinic = await getClinicSettings(clinicId);
  assertGranularity(
    clinic.slotGranularityMinutes,
    input.durationMinutes ?? existing.durationMinutes,
    input.bufferMinutes ?? existing.bufferMinutes,
  );

  if (input.providerIds) {
    await assertProvidersBelong(clinicId, input.providerIds);
  }

  return prisma.$transaction(async (tx) => {
    const service = await tx.service.update({
      where: { id: serviceId },
      data: {
        name: input.name,
        durationMinutes: input.durationMinutes,
        bufferMinutes: input.bufferMinutes,
        priceMinor: input.priceMinor,
        active: input.active,
        version: { increment: 1 },
      },
    });

    if (input.providerIds) {
      await tx.providerService.deleteMany({ where: { serviceId } });
      const unique = [...new Set(input.providerIds)];
      if (unique.length) {
        await tx.providerService.createMany({
          data: unique.map((providerId) => ({ providerId, serviceId })),
        });
      }
    }

    return service;
  });
}

/** Services are never deleted; they are deactivated so history stays intact. */
export async function setServiceActive(
  clinicId: string,
  serviceId: string,
  active: boolean,
) {
  const existing = await prisma.service.findFirst({
    where: { id: serviceId, clinicId },
  });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Service not found");
  }

  return prisma.service.update({
    where: { id: serviceId },
    data: { active, version: { increment: 1 } },
  });
}
