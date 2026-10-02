import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";

import { hashToken } from "./guest-session";
import { verifyPassword } from "./password";

const STAFF_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export async function authenticateStaff(email: string, password: string) {
  const user = await prisma.staffUser.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || !user.active) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return user;
}

export async function createStaffSession(staffUserId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + STAFF_SESSION_TTL_MS);

  const session = await prisma.staffSession.create({
    data: { staffUserId, tokenHash: hashToken(token), expiresAt },
    select: { id: true, expiresAt: true },
  });

  return { id: session.id, token, expiresAt: session.expiresAt };
}

export async function findStaffSessionByToken(token: string | undefined) {
  if (!token) return null;

  const session = await prisma.staffSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { staffUser: true },
  });

  if (!session || session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (!session.staffUser.active) return null;

  return session;
}

export async function revokeStaffSession(token: string | undefined) {
  if (!token) return;
  await prisma.staffSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const STAFF_SESSION_TTL_SECONDS = STAFF_SESSION_TTL_MS / 1000;
