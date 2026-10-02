import { InboxManager } from "@/components/staff/inbox-manager";
import { readStaffSession } from "@/modules/auth/authorize";

export default async function InboxPage() {
  const session = await readStaffSession();
  if (!session) return null;

  return (
    <InboxManager
      staffId={session.staffUser.id}
      staffRole={session.staffUser.role}
      staffEmail={session.staffUser.email}
    />
  );
}
