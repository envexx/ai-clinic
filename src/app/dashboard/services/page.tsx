import { ServicesManager } from "@/components/staff/services-manager";
import { readStaffSession } from "@/modules/auth/authorize";
import { getClinicSettings } from "@/modules/clinic/clinic";
import { listProviders } from "@/modules/clinic/providers";
import { listServices } from "@/modules/clinic/services";

export default async function ServicesPage() {
  const session = await readStaffSession();
  if (!session) return null;
  if (session.staffUser.role !== "ADMIN") {
    return (
      <p className="text-sm text-muted-foreground">
        Only clinic admins can manage services.
      </p>
    );
  }

  const clinicId = session.staffUser.clinicId;
  const [services, providers, clinic] = await Promise.all([
    listServices(clinicId),
    listProviders(clinicId),
    getClinicSettings(clinicId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
      <ServicesManager
        currency={clinic.currency}
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          bufferMinutes: service.bufferMinutes,
          priceMinor: service.priceMinor,
          active: service.active,
          providerIds: service.providerServices.map((link) => link.providerId),
        }))}
        providers={providers.map((provider) => ({
          id: provider.id,
          displayName: provider.displayName,
          active: provider.active,
        }))}
      />
    </div>
  );
}
