import { AppointmentsManager } from "@/components/staff/appointments-manager";
import { readStaffSession } from "@/modules/auth/authorize";

export default async function AppointmentsPage() {
  const session = await readStaffSession();
  if (!session) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
      <AppointmentsManager />
    </div>
  );
}
