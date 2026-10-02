import {
  assertSameOrigin,
  clientIp,
  parseJson,
  respondOk,
  withRoute,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/result";
import { handleChatMessage, getConversationHistory } from "@/modules/ai/chat";
import { chatInputSchema } from "@/modules/ai/validation";
import { requireGuestSession } from "@/modules/auth/authorize";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  const session = await requireGuestSession();
  const history = await getConversationHistory({
    id: session.id,
    clinicId: session.clinicId,
  });
  return respondOk(requestId, history);
});

export const POST = withRoute(async (req, { requestId }) => {
  assertSameOrigin(req);

  if (
    !rateLimit(`chat:${clientIp(req)}`, { limit: 30, windowMs: 60_000 })
  ) {
    throw new DomainError("RATE_LIMITED", "Too many messages", true);
  }

  const session = await requireGuestSession();
  const input = await parseJson(req, chatInputSchema);
  const reply = await handleChatMessage(
    { id: session.id, clinicId: session.clinicId },
    input,
  );
  return respondOk(requestId, reply);
});
