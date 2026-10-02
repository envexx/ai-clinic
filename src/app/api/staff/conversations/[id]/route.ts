import { respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { getConversationDetail } from "@/modules/conversations/staff";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = withRoute(
  async (_req, { requestId, params }: { requestId: string } & Context) => {
    const { staffUser } = await requireStaff();
    const { id } = await params;
    const detail = await getConversationDetail(staffUser.clinicId, id);
    return respondOk(requestId, detail);
  },
);
