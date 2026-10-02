import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { createProvider, listProviders } from "@/modules/clinic/providers";
import { providerInputSchema } from "@/modules/clinic/validation";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  const { staffUser } = await requireStaff(["ADMIN"]);
  const providers = await listProviders(staffUser.clinicId);
  return respondOk(requestId, providers);
});

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);
  const { staffUser } = await requireStaff(["ADMIN"]);
  const input = await parseJson(req, providerInputSchema);
  const provider = await createProvider(staffUser.clinicId, input);
  return respondOk(requestId, provider, 201);
});
