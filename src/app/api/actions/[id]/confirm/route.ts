import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { confirmPendingAction } from "@/modules/appointments/appointments";
import { confirmActionSchema } from "@/modules/appointments/validation";
import { requireGuestSession } from "@/modules/auth/authorize";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const POST = withRoute(
  async (req, { requestId, params }: { requestId: string } & Context) => {
    assertSameOrigin(req);
    const session = await requireGuestSession();
    const { id } = await params;
    const input = await parseJson(req, confirmActionSchema);
    const appointment = await confirmPendingAction(
      { id: session.id, clinicId: session.clinicId },
      id,
      input.idempotencyKey,
    );
    return respondOk(requestId, appointment);
  },
);
