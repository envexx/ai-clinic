import { cookies } from "next/headers";
import { z } from "zod";

import {
  assertSameOrigin,
  clientIp,
  parseJson,
  respondOk,
  withRoute,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/result";
import { STAFF_COOKIE, cookieOptions } from "@/modules/auth/cookies";
import {
  STAFF_SESSION_TTL_SECONDS,
  authenticateStaff,
  createStaffSession,
} from "@/modules/auth/staff-session";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);

  if (
    !rateLimit(`staff-login:${clientIp(req)}`, {
      limit: 10,
      windowMs: 60_000,
    })
  ) {
    throw new DomainError("RATE_LIMITED", "Too many login attempts", true);
  }

  const body = await parseJson(req, loginSchema);
  const user = await authenticateStaff(body.email, body.password);
  if (!user) {
    throw new DomainError("UNAUTHORIZED", "Invalid email or password");
  }

  const session = await createStaffSession(user.id);
  const store = await cookies();
  store.set(STAFF_COOKIE, session.token, cookieOptions(STAFF_SESSION_TTL_SECONDS));

  return respondOk(requestId, {
    staffUserId: user.id,
    role: user.role,
    expiresAt: session.expiresAt,
  });
});
