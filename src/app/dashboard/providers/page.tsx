import { ProvidersManager } from "@/components/staff/providers-manager";
import { readStaffSession } from "@/modules/auth/authorize";
import { listProviders } from "@/modules/clinic/providers";

export default async function ProvidersPage() {
  const session = await readStaffSession();
  if (!session) return null;
  if (session.staffUser.role !== "ADMIN") {
    return (
      <p className="text-sm text-muted">
        Only clinic admins can manage providers.
      </p>
    );
  }

  const providers = await listProviders(session.staffUser.clinicId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
      <ProvidersManager
        providers={providers.map((provider) => ({
          id: provider.id,
          displayName: provider.displayName,
          active: provider.active,
        }))}
      />
    </div>
  );
}
