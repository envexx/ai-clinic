import { cookies } from "next/headers";

import type { StaffRole } from "@/generated/prisma/enums";
import { DomainError } from "@/lib/result";

import { GUEST_COOKIE, STAFF_COOKIE } from "./cookies";
import { findGuestSessionByToken } from "./guest-session";
import { findStaffSessionByToken } from "./staff-session";

export async function readGuestSession() {
  const store = await cookies();
  return findGuestSessionByToken(store.get(GUEST_COOKIE)?.value);
}

export async function requireGuestSession() {
  const session = await readGuestSession();
  if (!session) {
    throw new DomainError("UNAUTHORIZED", "Guest session required");
  }
  return session;
}

export async function readStaffSession() {
  const store = await cookies();
  return findStaffSessionByToken(store.get(STAFF_COOKIE)?.value);
}

export async function requireStaff(roles?: readonly StaffRole[]) {
  const session = await readStaffSession();
  if (!session) {
    throw new DomainError("UNAUTHORIZED", "Staff login required");
  }
  if (roles && !roles.includes(session.staffUser.role)) {
    throw new DomainError("FORBIDDEN", "Insufficient role");
  }
  return session;
}
