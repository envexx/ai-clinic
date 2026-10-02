import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import {
  listClinicHours,
  replaceClinicHours,
} from "@/modules/clinic/schedules";
import { clinicHoursInputSchema } from "@/modules/clinic/validation";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  const { staffUser } = await requireStaff(["ADMIN"]);
  const hours = await listClinicHours(staffUser.clinicId);
  return respondOk(requestId, hours);
});

export const PUT = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);
  const { staffUser } = await requireStaff(["ADMIN"]);
  const input = await parseJson(req, clinicHoursInputSchema);
  const hours = await replaceClinicHours(staffUser.clinicId, input.hours);
  return respondOk(requestId, hours);
});
