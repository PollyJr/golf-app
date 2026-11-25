import type { Metadata } from "next";
import { NotificationList } from "@/components/app/notification-list";
import { PageHeader } from "@/components/ui/card";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Meldingen" };

export default async function NotificationsPage() {
  const session = await requirePlayer();
  const { t } = await getT();
  const notifications = await listNotifications(session.clubId, session.accountId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("app.notifications.title")} />
      <NotificationList initial={notifications} />
    </div>
  );
}
