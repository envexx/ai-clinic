import { PendingActionStatus, PendingActionType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/result";

import { hashPayload } from "./idempotency";

export type PendingActionPayload = Record<string, unknown>;

export type CreateActionInput = {
  clinicId: string;
  type: PendingActionType;
  guestSessionId: string;
  payload: PendingActionPayload;
  ttlMinutes: number;
};

/**
 * Creates a single-use confirmation request. Creating a new action of the same
 * type cancels any previous pending one so a changed choice invalidates the
 * old approval (PRD section 15).
 */
export async function createPendingAction(input: CreateActionInput) {
  const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);

  return prisma.$transaction(async (tx) => {
    await tx.pendingAction.updateMany({
      where: {
        guestSessionId: input.guestSessionId,
        type: input.type,
        status: PendingActionStatus.PENDING,
      },
      data: { status: PendingActionStatus.CANCELLED },
    });

    return tx.pendingAction.create({
      data: {
        clinicId: input.clinicId,
        type: input.type,
        guestSessionId: input.guestSessionId,
        payload: input.payload as object,
        payloadHash: hashPayload(input.payload),
        expiresAt,
      },
    });
  });
}

/** Loads an action owned by the session without judging its status. */
export async function getOwnedAction(
  guestSessionId: string,
  actionId: string,
) {
  const action = await prisma.pendingAction.findUnique({
    where: { id: actionId },
  });
  if (!action || action.guestSessionId !== guestSessionId) {
    throw new DomainError("NOT_FOUND", "Action not found");
  }
  return action;
}

/**
 * Rejects an action that can no longer be executed. Idempotent replays are
 * handled before this check, so a successful retry still returns its result.
 */
export async function assertActionUsable(action: {
  id: string;
  status: PendingActionStatus;
  expiresAt: Date;
}): Promise<void> {
  if (action.status === PendingActionStatus.CONSUMED) {
    throw new DomainError("ACTION_EXPIRED", "This action was already used");
  }
  if (
    action.status === PendingActionStatus.CANCELLED ||
    action.status === PendingActionStatus.EXPIRED
  ) {
    throw new DomainError("ACTION_EXPIRED", "This action is no longer valid");
  }
  if (action.expiresAt.getTime() <= Date.now()) {
    await prisma.pendingAction.updateMany({
      where: { id: action.id, status: PendingActionStatus.PENDING },
      data: { status: PendingActionStatus.EXPIRED },
    });
    throw new DomainError("ACTION_EXPIRED", "This action has expired");
  }
}
