import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { prepareCancellation } from "@/modules/appointments/appointments";
import { prepareCancellationSchema } from "@/modules/appointments/validation";
import { requireGuestSession } from "@/modules/auth/authorize";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);
  const session = await requireGuestSession();
  const input = await parseJson(req, prepareCancellationSchema);
  const prepared = await prepareCancellation(
    { id: session.id, clinicId: session.clinicId },
    input,
  );
  return respondOk(requestId, prepared, 201);
});
