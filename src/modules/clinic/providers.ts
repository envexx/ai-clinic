import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/result";

import type { ProviderInput, ProviderUpdate } from "./validation";

export async function listProviders(clinicId: string) {
  return prisma.provider.findMany({
    where: { clinicId },
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
    include: {
      providerServices: { select: { serviceId: true } },
      workingHours: { orderBy: [{ weekday: "asc" }, { localStart: "asc" }] },
    },
  });
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
