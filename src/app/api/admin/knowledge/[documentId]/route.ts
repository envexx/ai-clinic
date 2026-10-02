import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { setDocumentActive } from "@/modules/knowledge/knowledge";
import { documentUpdateSchema } from "@/modules/knowledge/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ documentId: string }> };

export const PATCH = withRoute(
  async (req, { requestId, params }: { requestId: string } & Context) => {
    assertSameOrigin(req);
    const { staffUser } = await requireStaff(["ADMIN"]);
    const { documentId } = await params;
    const input = await parseJson(req, documentUpdateSchema);
    const document = await setDocumentActive(
      staffUser.clinicId,
      documentId,
      input.active,
    );
    return respondOk(requestId, document);
  },
);
