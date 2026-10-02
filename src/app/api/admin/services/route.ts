import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { createService, listServices } from "@/modules/clinic/services";
import { serviceInputSchema } from "@/modules/clinic/validation";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  const { staffUser } = await requireStaff(["ADMIN"]);
  const services = await listServices(staffUser.clinicId);
  return respondOk(requestId, services);
});

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);
  const { staffUser } = await requireStaff(["ADMIN"]);
  const input = await parseJson(req, serviceInputSchema);
  const service = await createService(staffUser.clinicId, input);
  return respondOk(requestId, service, 201);
});
