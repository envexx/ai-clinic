import { respondOk, withRoute } from "@/lib/http";
import { readGuestSession, readStaffSession } from "@/modules/auth/authorize";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  const staff = await readStaffSession();
  if (staff) {
    return respondOk(requestId, {
      type: "staff",
      staffUserId: staff.staffUser.id,
      role: staff.staffUser.role,
    });
  }

  const guest = await readGuestSession();
  if (guest) {
    return respondOk(requestId, { type: "guest", guestSessionId: guest.id });
  }

  return respondOk(requestId, { type: "anonymous" });
});
