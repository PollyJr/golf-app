import type { Metadata } from "next";
import { NewsManager } from "@/components/admin/news-manager";
import { PageHeader } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listNewsForStaff } from "@/server/services/news";

export const metadata: Metadata = { title: "Nieuws" };

export default async function AdminNewsPage() {
  const session = await requireStaff();
  // Texts are written and edited in the club's own language.
  const [{ t }, items] = await Promise.all([getT(), listNewsForStaff(session.clubId, session.club.defaultLanguage)]);

  return (
    <>
      <PageHeader eyebrow={session.club.name} title={t("admin.news.title")} description={t("admin.news.lead")} />
      <NewsManager items={items} />
    </>
  );
}
