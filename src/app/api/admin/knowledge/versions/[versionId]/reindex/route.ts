import { assertSameOrigin, respondOk, withRoute } from "@/lib/http";
import { requireStaff } from "@/modules/auth/authorize";
import { reindexVersion } from "@/modules/knowledge/knowledge";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ versionId: string }> };

export const POST = withRoute(
  async (req, { requestId, params }: { requestId: string } & Context) => {
    assertSameOrigin(req);
    const { staffUser } = await requireStaff(["ADMIN"]);
    const { versionId } = await params;
    await reindexVersion(staffUser.clinicId, versionId);
    return respondOk(requestId, { versionId, status: "READY" });
  },
);
