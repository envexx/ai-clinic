import { prisma } from "@/lib/db";
import { respondOk, withRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  await prisma.$queryRaw`SELECT 1`;
  return respondOk(requestId, { status: "ok", db: "up" });
});
