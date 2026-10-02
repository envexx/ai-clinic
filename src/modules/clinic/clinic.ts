import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/result";

import type { SettingsInput } from "./validation";

/** v1 is single-clinic: resolve the demo clinic. */
export async function getDefaultClinicId(): Promise<string> {
  const clinic = await prisma.clinic.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!clinic) {
    throw new DomainError(
      "SERVICE_UNAVAILABLE",
      "Clinic is not configured yet",
      true,
    );
  }
  return clinic.id;
}

export async function getClinicSettings(clinicId: string) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) {
    throw new DomainError("NOT_FOUND", "Clinic not found");
  }
  return clinic;
}

function assertValidTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new DomainError("VALIDATION_ERROR", `Unknown timezone: ${timezone}`);
  }
}

export async function updateClinicSettings(
  clinicId: string,
  input: SettingsInput,
) {
  if (input.timezone) assertValidTimezone(input.timezone);

  return prisma.clinic.update({
    where: { id: clinicId },
    data: { ...input, version: { increment: 1 } },
  });
}
