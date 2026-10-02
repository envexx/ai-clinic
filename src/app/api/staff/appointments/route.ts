import { AppointmentStatus } from "@/generated/prisma/enums";
import { respondOk, withRoute } from "@/lib/http";
import { DomainError } from "@/lib/result";
import { listClinicAppointments } from "@/modules/appointments/appointments";
import { requireStaff } from "@/modules/auth/authorize";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (req, { requestId }) => {
  const { staffUser } = await requireStaff();

  const statusParam = req.nextUrl.searchParams.get("status");
  let status: AppointmentStatus | undefined;
  if (statusParam) {
    if (!(statusParam in AppointmentStatus)) {
      throw new DomainError("VALIDATION_ERROR", "Unknown appointment status");
    }
    status = statusParam as AppointmentStatus;
  }

  const appointments = await listClinicAppointments(staffUser.clinicId, {
    status,
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });
  return respondOk(requestId, appointments);
});
