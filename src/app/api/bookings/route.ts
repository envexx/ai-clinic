import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireGuestSession } from "@/modules/auth/authorize";
import { prepareBooking } from "@/modules/appointments/appointments";
import { prepareBookingSchema } from "@/modules/appointments/validation";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);
  const session = await requireGuestSession();
  const input = await parseJson(req, prepareBookingSchema);
  const prepared = await prepareBooking(
    { id: session.id, clinicId: session.clinicId },
    input,
  );
  return respondOk(requestId, prepared, 201);
});
