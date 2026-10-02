import { respondOk, withRoute } from "@/lib/http";
import { listVisitorAppointments } from "@/modules/appointments/appointments";
import { requireGuestSession } from "@/modules/auth/authorize";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  const session = await requireGuestSession();
  const appointments = await listVisitorAppointments({
    id: session.id,
    clinicId: session.clinicId,
  });
  return respondOk(requestId, appointments);
});
