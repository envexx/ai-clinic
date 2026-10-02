import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type AuditActorType = "GUEST" | "STAFF" | "SYSTEM";

export type AuditInput = {
  clinicId: string;
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Writes an audit event. Pass the transaction client to keep it atomic. */
export async function writeAudit(
  input: AuditInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      clinicId: input.clinicId,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: toJson(input.before),
      after: toJson(input.after),
      requestId: input.requestId ?? null,
    },
  });
}
