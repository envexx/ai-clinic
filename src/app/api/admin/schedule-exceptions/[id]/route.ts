import { assertSameOrigin, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { deleteScheduleException } from "@/modules/clinic/schedules";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const DELETE = withRoute(
  async (req, { requestId, params }: { requestId: string } & Context) => {
    assertSameOrigin(req);
    const { staffUser } = await requireStaff(["ADMIN"]);
    const { id } = await params;
    await deleteScheduleException(staffUser.clinicId, id);
    return respondOk(requestId, { deleted: true });
  },
);
