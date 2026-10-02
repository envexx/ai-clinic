import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/result";

import type { ProviderInput, ProviderUpdate } from "./validation";

export async function listProviders(clinicId: string) {
  // Sequential queries on purpose: local Prisma Postgres is single-connection
  // and drops the connection under concurrent nested reads.
  const providers = await prisma.provider.findMany({
    where: { clinicId },
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
  });
  const links = await prisma.providerService.findMany({
    where: { provider: { clinicId } },
    select: { providerId: true, serviceId: true },
  });
  const hours = await prisma.workingHour.findMany({
    where: { provider: { clinicId } },
    orderBy: [{ weekday: "asc" }, { localStart: "asc" }],
  });

  return providers.map((provider) => ({
    ...provider,
    providerServices: links
      .filter((link) => link.providerId === provider.id)
      .map((link) => ({ serviceId: link.serviceId })),
    workingHours: hours.filter((hour) => hour.providerId === provider.id),
  }));
}

export async function createProvider(clinicId: string, input: ProviderInput) {
  return prisma.provider.create({
    data: {
      clinicId,
      displayName: input.displayName,
      active: input.active ?? true,
    },
  });
}

export async function updateProvider(
  clinicId: string,
  providerId: string,
  input: ProviderUpdate,
) {
  const existing = await prisma.provider.findFirst({
    where: { id: providerId, clinicId },
  });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Provider not found");
  }

  return prisma.provider.update({
    where: { id: providerId },
    data: {
      displayName: input.displayName,
      active: input.active,
    },
  });
}
