import { ChevronRight, ClipboardCheck, Download } from "lucide-react";
import type { Metadata } from "next";
import { RoundCard } from "@/components/admin/round-card";
import { RoundReviewQueue } from "@/components/admin/round-review";
import { TabLinks } from "@/components/admin/tab-links";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import type { RoundStatus } from "@/lib/types";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { countPendingRounds, listRoundsForStaff } from "@/server/services/rounds";
import { NAV_FORWARD } from "@/components/motion/page-transition";

export const metadata: Metadata = { title: "Rondes" };

const TABS = ["pending", "approved", "rejected", "active", "all"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminRoundsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await requireStaff();
  const { status } = await searchParams;
  const tab: Tab = TABS.find((value) => value === status) ?? "pending";
  const filter: RoundStatus | null = tab === "all" ? null : tab;
  const { locale, t } = await getT();
  const [rounds, pendingCount] = await Promise.all([
    listRoundsForStaff(session.clubId, locale, { status: filter, limit: 200 }),
    countPendingRounds(session.clubId),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={session.club.name}
        title={t("admin.rounds.title")}
        description={t("admin.rounds.lead")}
        actions={
          <LinkButton variant="secondary" href="/api/admin/rounds/export" download icon={<Download className="size-4" />}>
            {t("admin.rounds.export")}
          </LinkButton>
        }
      />

      <TabLinks
        label={t("admin.rounds.tabs.label")}
        className="mb-5"
        tabs={TABS.map((value) => ({
          href: value === "pending" ? "/admin/rounds" : `/admin/rounds?status=${value}`,
          label: t(`admin.rounds.tabs.${value}`),
          active: value === tab,
          count: value === "pending" ? pendingCount : undefined,
        }))}
      />

      {rounds.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-5" />}
          title={tab === "pending" ? t("admin.rounds.emptyPending") : t("admin.rounds.empty")}
          description={tab === "pending" ? t("admin.rounds.emptyPendingLead") : t("admin.rounds.emptyLead")}
        />
      ) : tab === "pending" ? (
        <RoundReviewQueue rounds={rounds} />
      ) : (
        <ul className="stagger-children grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rounds.map((round) => (
            <li key={round.id}>
              <RoundCard
                round={round}
                t={t}
                locale={locale}
                timeZone={session.club.timeZone}
                showStatus={tab === "all"}
                actions={
                  <LinkButton variant="ghost" size="sm" href={`/admin/rounds/${round.id}`} transitionTypes={NAV_FORWARD}>
                    {t("admin.rounds.view")}
                    <ChevronRight className="size-4" />
                  </LinkButton>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
