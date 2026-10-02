import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import {
  getProviderSchedule,
  replaceProviderWorkingHours,
} from "@/modules/clinic/schedules";
import { workingHoursInputSchema } from "@/modules/clinic/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ providerId: string }> };

export const GET = withRoute(
  async (_req, { requestId, params }: { requestId: string } & Context) => {
    const { staffUser } = await requireStaff(["ADMIN"]);
    const { providerId } = await params;
    const schedule = await getProviderSchedule(staffUser.clinicId, providerId);
    return respondOk(requestId, schedule);
  },
);

export const PUT = withRoute(
  async (req, { requestId, params }: { requestId: string } & Context) => {
    assertSameOrigin(req);
    const { staffUser } = await requireStaff(["ADMIN"]);
    const { providerId } = await params;
    const input = await parseJson(req, workingHoursInputSchema);
    const workingHours = await replaceProviderWorkingHours(
      staffUser.clinicId,
      providerId,
      input.hours,
    );
    return respondOk(requestId, workingHours);
  },
);
