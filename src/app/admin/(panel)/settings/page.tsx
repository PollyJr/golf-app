import type { Metadata } from "next";
import { AccessLinkCard, SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getClubAdminSettings } from "@/server/services/clubs";

export const metadata: Metadata = { title: "Instellingen" };

export default async function AdminSettingsPage() {
  const session = await requireStaff({ ownerOnly: true });
  const [{ t }, settings] = await Promise.all([getT(), getClubAdminSettings(session.clubId)]);

  return (
    <>
      <PageHeader eyebrow={session.club.name} title={t("admin.settings.title")} description={t("admin.settings.lead")} />
      <div className="flex flex-col gap-6">
        <SettingsForm settings={settings} />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Keyed on the secret, so a regenerated code replaces the card. */}
          <AccessLinkCard
            key={settings.joinCode}
            kind="join"
            path={`/join/${settings.joinCode}`}
            code={settings.joinCode}
            note={settings.selfRegistration === "closed" ? t("admin.settings.join.closedNote") : undefined}
          />
          <AccessLinkCard key={settings.boardToken} kind="board" path={`/board/${settings.boardToken}`} />
        </div>
      </div>
    </>
  );
}
