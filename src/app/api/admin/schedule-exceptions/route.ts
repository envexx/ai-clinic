import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { createScheduleException } from "@/modules/clinic/schedules";
import { scheduleExceptionInputSchema } from "@/modules/clinic/validation";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);
  const { staffUser } = await requireStaff(["ADMIN"]);
  const input = await parseJson(req, scheduleExceptionInputSchema);
  const exception = await createScheduleException(staffUser.clinicId, input);
  return respondOk(requestId, exception, 201);
});
