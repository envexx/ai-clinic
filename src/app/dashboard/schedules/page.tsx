import { SchedulesManager } from "@/components/staff/schedules-manager";
import { readStaffSession } from "@/modules/auth/authorize";
import { listProviders } from "@/modules/clinic/providers";
import {
  getProviderSchedule,
  listClinicHours,
} from "@/modules/clinic/schedules";

export default async function SchedulesPage() {
  const session = await readStaffSession();
  if (!session) return null;
  if (session.staffUser.role !== "ADMIN") {
    return (
      <p className="text-sm text-zinc-500">
        Only clinic admins can manage schedules.
      </p>
    );
  }

  const clinicId = session.staffUser.clinicId;
  const [providers, clinicHours] = await Promise.all([
    listProviders(clinicId),
    listClinicHours(clinicId),
  ]);

  const activeProviders = providers.filter((provider) => provider.active);
  const firstProvider = activeProviders[0];
  const schedule = firstProvider
    ? await getProviderSchedule(clinicId, firstProvider.id)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Schedules</h1>
      <SchedulesManager
        providers={activeProviders.map((provider) => ({
          id: provider.id,
          displayName: provider.displayName,
        }))}
        clinicHours={clinicHours.map((hour) => ({
          weekday: hour.weekday,
          localStart: hour.localStart,
          localEnd: hour.localEnd,
        }))}
        initialSchedule={
          firstProvider && schedule
            ? {
                providerId: firstProvider.id,
                workingHours: schedule.workingHours.map((hour) => ({
                  weekday: hour.weekday,
                  localStart: hour.localStart,
                  localEnd: hour.localEnd,
                })),
                exceptions: schedule.exceptions.map((exception) => ({
                  id: exception.id,
                  startsAt: exception.startsAt.toISOString(),
                  endsAt: exception.endsAt.toISOString(),
                  reason: exception.reason,
                })),
              }
            : null
        }
      />
    </div>
  );
}
