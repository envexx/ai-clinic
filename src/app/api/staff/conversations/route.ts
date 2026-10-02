import { ConversationStatus } from "@/generated/prisma/enums";
import { respondOk, withRoute } from "@/lib/http";
import { DomainError } from "@/lib/result";
import { requireStaff } from "@/modules/auth/authorize";
import { listInbox } from "@/modules/conversations/staff";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (req, { requestId }) => {
  const { staffUser } = await requireStaff();

  const statusParam = req.nextUrl.searchParams.get("status");
  let status: ConversationStatus | undefined;
  if (statusParam) {
    if (!(statusParam in ConversationStatus)) {
      throw new DomainError("VALIDATION_ERROR", "Unknown conversation status");
    }
    status = statusParam as ConversationStatus;
  }

  const conversations = await listInbox(staffUser.clinicId, status);
  return respondOk(requestId, conversations);
});
