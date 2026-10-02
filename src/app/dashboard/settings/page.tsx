import { SettingsForm } from "@/components/staff/settings-form";
import { readStaffSession } from "@/modules/auth/authorize";
import { getClinicSettings } from "@/modules/clinic/clinic";

export default async function SettingsPage() {
  const session = await readStaffSession();
  if (!session) return null;
  if (session.staffUser.role !== "ADMIN") {
    return (
      <p className="text-sm text-muted-foreground">
        Only clinic admins can change settings.
      </p>
    );
  }

  const clinic = await getClinicSettings(session.staffUser.clinicId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <SettingsForm
        clinic={{
          name: clinic.name,
          timezone: clinic.timezone,
          currency: clinic.currency,
          slotGranularityMinutes: clinic.slotGranularityMinutes,
          bookingHorizonDays: clinic.bookingHorizonDays,
          minimumNoticeMinutes: clinic.minimumNoticeMinutes,
          selfServiceCutoffMinutes: clinic.selfServiceCutoffMinutes,
          pendingActionTtlMinutes: clinic.pendingActionTtlMinutes,
        }}
      />
    </div>
  );
}
