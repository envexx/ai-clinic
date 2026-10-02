import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/lib/result";

export type IdempotencyLookup =
  | { kind: "new" }
  | { kind: "replay"; result: Prisma.JsonValue }
  | { kind: "conflict" };

/** Deterministic JSON stringify so the same payload always hashes the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

/**
 * Idempotency guard. The same key with the same payload replays the stored
 * result; the same key with a different payload is rejected.
 */
export async function checkIdempotency(
  tx: Prisma.TransactionClient,
  scope: string,
  key: string,
  requestHash: string,
): Promise<IdempotencyLookup> {
  const existing = await tx.idempotencyRecord.findUnique({
    where: { scope_key: { scope, key } },
  });
  if (!existing) return { kind: "new" };
  if (existing.requestHash !== requestHash) return { kind: "conflict" };
  return { kind: "replay", result: existing.result };
}

export async function recordIdempotency(
  tx: Prisma.TransactionClient,
  scope: string,
  key: string,
  requestHash: string,
  result: unknown,
): Promise<void> {
  await tx.idempotencyRecord.create({
    data: {
      scope,
      key,
      requestHash,
      status: "SUCCESS",
      result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    },
  });
}

export function idempotencyConflict(): DomainError {
  return new DomainError(
    "VALIDATION_ERROR",
    "Idempotency key was reused with a different request",
  );
}
