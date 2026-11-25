import type { Metadata } from "next";
import { DetailRow } from "@/components/admin/common";
import { AccountPasswordForm } from "@/components/admin/password-form";
import { Card, PageHeader, SectionHeading } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getAdminProfile } from "@/server/services/staff";

export const metadata: Metadata = { title: "Mijn account" };

export default async function AdminAccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const session = await requireStaff({ allowPasswordChange: true });
  const [{ t }, profile, { welcome }] = await Promise.all([getT(), getAdminProfile(session), searchParams]);
  const oneTime = session.user.mustChangeSecret;
  const greeting = oneTime || welcome === "1";

  return (
    <>
      <PageHeader
        eyebrow={session.club.name}
        title={greeting && oneTime ? t("admin.account.welcomeTitle") : t("admin.account.title")}
        description={greeting && oneTime ? t("admin.account.welcomeLead") : t("admin.account.lead")}
      />
      <div className="grid grid-cols-1 max-w-4xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <Card padding="lg">
          <SectionHeading title={t("admin.account.passwordHeading")} />
          <p className="-mt-1 mb-5 text-sm text-ink-2">{t("admin.account.passwordLead")}</p>
          <AccountPasswordForm oneTime={oneTime} />
        </Card>
        <Card>
          <SectionHeading title={t("admin.account.signedInAs")} />
          <dl>
            <DetailRow label={t("admin.staff.name")}>{profile.name}</DetailRow>
            <DetailRow label={t("admin.staff.email")}>{profile.email}</DetailRow>
            <DetailRow label={t("admin.staff.role")}>
              {t(session.role === "club_owner" ? "admin.roles.club_owner" : "admin.roles.club_staff")}
            </DetailRow>
          </dl>
        </Card>
      </div>
    </>
  );
}
