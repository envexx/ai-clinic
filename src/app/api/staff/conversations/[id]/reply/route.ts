import { assertSameOrigin, parseJson, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { getConversationDetail, staffReply } from "@/modules/conversations/staff";
import { replySchema } from "@/modules/conversations/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const POST = withRoute(
  async (req, { requestId, params }: { requestId: string } & Context) => {
    assertSameOrigin(req);
    const { staffUser } = await requireStaff();
    const { id } = await params;
    const input = await parseJson(req, replySchema);
    await staffReply(
      { id: staffUser.id, clinicId: staffUser.clinicId, role: staffUser.role },
      id,
      input.content,
    );
    const detail = await getConversationDetail(staffUser.clinicId, id);
    return respondOk(requestId, detail);
  },
);
