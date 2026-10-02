import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { updateAppointmentStatus } from "@/modules/appointments/appointments";
import { staffStatusSchema } from "@/modules/appointments/validation";
import { requireStaff } from "@/modules/auth/authorize";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withRoute(
  async (req, { requestId, params }: { requestId: string } & Context) => {
    assertSameOrigin(req);
    const { staffUser } = await requireStaff();
    const { id } = await params;
    const input = await parseJson(req, staffStatusSchema);
    const appointment = await updateAppointmentStatus(
      { id: staffUser.id, clinicId: staffUser.clinicId, role: staffUser.role },
      id,
      input,
    );
    return respondOk(requestId, appointment);
  },
);
