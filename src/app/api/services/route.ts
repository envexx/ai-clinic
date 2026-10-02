import { prisma } from "@/lib/db";
import { respondOk, withRoute } from "@/lib/http";
import { getDefaultClinicId } from "@/modules/clinic/clinic";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_req, { requestId }) => {
  const clinicId = await getDefaultClinicId();
  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { currency: true },
  });
  const services = await prisma.service.findMany({
    where: { clinicId, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      bufferMinutes: true,
      priceMinor: true,
    },
  });

  return respondOk(
    requestId,
    services.map((service) => ({ ...service, currency: clinic.currency })),
  );
});
