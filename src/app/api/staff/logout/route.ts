import { cookies } from "next/headers";

import { assertSameOrigin, respondOk, withRoute } from "@/lib/http";
import { STAFF_COOKIE } from "@/modules/auth/cookies";
import { revokeStaffSession } from "@/modules/auth/staff-session";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);

  const store = await cookies();
  await revokeStaffSession(store.get(STAFF_COOKIE)?.value);
  store.delete(STAFF_COOKIE);

  return respondOk(requestId, { loggedOut: true });
});
