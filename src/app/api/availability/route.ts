import { z } from "zod";

import { clientIp, respondOk, withRoute } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/result";
import { getDefaultClinicId } from "@/modules/clinic/clinic";
import { getAvailableSlots } from "@/modules/scheduling/availability";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  serviceId: z.uuid(),
  providerId: z.uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const GET = withRoute(async (req, { requestId }) => {
  if (
    !rateLimit(`availability:${clientIp(req)}`, {
      limit: 120,
      windowMs: 60_000,
    })
  ) {
    throw new DomainError("RATE_LIMITED", "Too many requests", true);
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    throw new DomainError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid query",
    );
  }

  const clinicId = await getDefaultClinicId();
  const slots = await getAvailableSlots({ clinicId, ...parsed.data });
  return respondOk(requestId, slots);
});
