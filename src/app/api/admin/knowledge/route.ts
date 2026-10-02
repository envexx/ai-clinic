import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import {
  createDocument,
  listDocuments,
} from "@/modules/knowledge/knowledge";
import { documentInputSchema } from "@/modules/knowledge/validation";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  const { staffUser } = await requireStaff(["ADMIN"]);
  const documents = await listDocuments(staffUser.clinicId);
  return respondOk(requestId, documents);
});

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);
  const { staffUser } = await requireStaff(["ADMIN"]);
  const input = await parseJson(req, documentInputSchema);
  const document = await createDocument(staffUser.clinicId, input);
  return respondOk(requestId, document, 201);
});
