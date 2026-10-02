import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { addVersion } from "@/modules/knowledge/knowledge";
import { versionInputSchema } from "@/modules/knowledge/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ documentId: string }> };

export const POST = withRoute(
  async (req, { requestId, params }: { requestId: string } & Context) => {
    assertSameOrigin(req);
    const { staffUser } = await requireStaff(["ADMIN"]);
    const { documentId } = await params;
    const input = await parseJson(req, versionInputSchema);
    const version = await addVersion(staffUser.clinicId, documentId, input);
    return respondOk(requestId, version, 201);
  },
);
