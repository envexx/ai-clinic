import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";

const GUEST_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type CreatedGuestSession = {
  id: string;
  token: string;
  expiresAt: Date;
};

export async function createGuestSession(
  clinicId: string,
): Promise<CreatedGuestSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + GUEST_SESSION_TTL_MS);

  const session = await prisma.guestSession.create({
    data: { clinicId, tokenHash: hashToken(token), expiresAt },
    select: { id: true, expiresAt: true },
  });

  return { id: session.id, token, expiresAt: session.expiresAt };
}

export async function findGuestSessionByToken(token: string | undefined) {
  if (!token) return null;

  const session = await prisma.guestSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session || session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  return session;
}

export const GUEST_SESSION_TTL_SECONDS = GUEST_SESSION_TTL_MS / 1000;
