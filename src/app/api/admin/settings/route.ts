import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import {
  getClinicSettings,
  updateClinicSettings,
} from "@/modules/clinic/clinic";
import { settingsInputSchema } from "@/modules/clinic/validation";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  const { staffUser } = await requireStaff(["ADMIN"]);
  const clinic = await getClinicSettings(staffUser.clinicId);
  return respondOk(requestId, clinic);
});

export const PATCH = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);
  const { staffUser } = await requireStaff(["ADMIN"]);
  const input = await parseJson(req, settingsInputSchema);
  const clinic = await updateClinicSettings(staffUser.clinicId, input);
  return respondOk(requestId, clinic);
});
