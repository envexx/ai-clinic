import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { prepareReschedule } from "@/modules/appointments/appointments";
import { prepareRescheduleSchema } from "@/modules/appointments/validation";
import { requireGuestSession } from "@/modules/auth/authorize";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);
  const session = await requireGuestSession();
  const input = await parseJson(req, prepareRescheduleSchema);
  const prepared = await prepareReschedule(
    { id: session.id, clinicId: session.clinicId },
    input,
  );
  return respondOk(requestId, prepared, 201);
});
