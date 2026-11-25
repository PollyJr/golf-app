import type { Metadata } from "next";
import { StaffManager } from "@/components/admin/staff-manager";
import { PageHeader } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listStaff } from "@/server/services/staff";

export const metadata: Metadata = { title: "Team" };

export default async function AdminStaffPage() {
  const session = await requireStaff({ ownerOnly: true });
  const [{ t }, staff] = await Promise.all([getT(), listStaff(session)]);

  return (
    <>
      <PageHeader eyebrow={session.club.name} title={t("admin.staff.title")} description={t("admin.staff.lead")} />
      <StaffManager staff={staff} clubName={session.club.name} />
    </>
  );
}
