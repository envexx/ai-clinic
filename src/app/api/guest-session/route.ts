import { cookies } from "next/headers";

import { assertSameOrigin, clientIp, respondOk, withRoute } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/result";
import { GUEST_COOKIE, cookieOptions } from "@/modules/auth/cookies";
import {
  GUEST_SESSION_TTL_SECONDS,
  createGuestSession,
  findGuestSessionByToken,
  getDefaultClinicId,
} from "@/modules/auth/guest-session";

export const dynamic = "force-dynamic";

/**
 * Creates or reuses an opaque guest session bound to an HttpOnly cookie.
 * The token itself is never returned in the response body.
 */
export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);

  if (
    !rateLimit(`guest-session:${clientIp(req)}`, {
      limit: 20,
      windowMs: 60_000,
    })
  ) {
    throw new DomainError("RATE_LIMITED", "Too many session requests", true);
  }

  const store = await cookies();
  const existingToken = store.get(GUEST_COOKIE)?.value;
  const existing = await findGuestSessionByToken(existingToken);

  if (existing && existingToken) {
    store.set(GUEST_COOKIE, existingToken, cookieOptions(GUEST_SESSION_TTL_SECONDS));
    return respondOk(requestId, {
      guestSessionId: existing.id,
      expiresAt: existing.expiresAt,
    });
  }

  const clinicId = await getDefaultClinicId();
  const session = await createGuestSession(clinicId);
  store.set(GUEST_COOKIE, session.token, cookieOptions(GUEST_SESSION_TTL_SECONDS));

  return respondOk(
    requestId,
    { guestSessionId: session.id, expiresAt: session.expiresAt },
    201,
  );
});
