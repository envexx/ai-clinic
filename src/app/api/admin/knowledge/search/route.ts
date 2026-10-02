import { respondOk, withRoute } from "@/lib/http";
import { DomainError } from "@/lib/result";
import { requireStaff } from "@/modules/auth/authorize";
import { searchKnowledge } from "@/modules/knowledge/retrieval";
import { searchQuerySchema } from "@/modules/knowledge/validation";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (req, { requestId }) => {
  const { staffUser } = await requireStaff(["ADMIN"]);
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = searchQuerySchema.safeParse(params);
  if (!parsed.success) {
    throw new DomainError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid query",
    );
  }

  const citations = await searchKnowledge(
    staffUser.clinicId,
    parsed.data.q,
    parsed.data.limit ?? 5,
  );
  return respondOk(requestId, citations);
});
