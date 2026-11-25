import { History } from "lucide-react";
import type { Metadata } from "next";
import { auditActionLabel } from "@/components/admin/labels";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { dayKey, formatLongDate, formatTime } from "@/lib/format";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listAuditLog, type AuditEntry } from "@/server/services/stats";

export const metadata: Metadata = { title: "Logboek" };

const LIMIT = 150;

export default async function AdminAuditPage() {
  const session = await requireStaff();
  const [{ locale, t }, entries] = await Promise.all([getT(), listAuditLog(session.clubId, { limit: LIMIT })]);
  const timeZone = session.club.timeZone;

  // Group by calendar day in the club's time zone, newest day first.
  const days: Array<{ key: string; entries: AuditEntry[] }> = [];
  for (const entry of entries) {
    const key = dayKey(entry.createdAt, timeZone);
    const last = days[days.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, entries: [entry] });
  }

  return (
    <>
      <PageHeader eyebrow={session.club.name} title={t("admin.audit.title")} description={t("admin.audit.lead", { count: LIMIT })} />

      {days.length === 0 ? (
        <EmptyState icon={<History className="size-5" />} title={t("admin.audit.empty")} description={t("admin.audit.emptyLead")} />
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.key}>
              <h2 className="font-label mb-2 text-[11px] text-ink-3">{formatLongDate(day.entries[0].createdAt, locale, timeZone)}</h2>
              <ol className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                {day.entries.map((entry) => (
                  <li key={entry.id} className="flex items-baseline gap-4 border-b border-line px-4 py-2.5 last:border-b-0 sm:px-5">
                    <time dateTime={entry.createdAt} className="tabular w-11 shrink-0 text-[13px] text-ink-3">
                      {formatTime(entry.createdAt, locale, timeZone)}
                    </time>
                    <p className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold">{auditActionLabel(t, entry.action)}</span>
                      <span className="text-ink-2"> · {entry.actorName ?? t("admin.audit.system")}</span>
                    </p>
                    {entry.actorRole ? <Badge className="hidden sm:inline-flex">{t(`admin.roles.${entry.actorRole}`)}</Badge> : null}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
