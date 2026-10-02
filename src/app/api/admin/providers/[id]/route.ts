import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { updateProvider } from "@/modules/clinic/providers";
import { providerUpdateSchema } from "@/modules/clinic/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withRoute(
  async (req, { requestId, params }: { requestId: string } & Context) => {
    assertSameOrigin(req);
    const { staffUser } = await requireStaff(["ADMIN"]);
    const { id } = await params;
    const input = await parseJson(req, providerUpdateSchema);
    const provider = await updateProvider(staffUser.clinicId, id, input);
    return respondOk(requestId, provider);
  },
);
