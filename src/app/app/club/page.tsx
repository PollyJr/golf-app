import { Clock, Globe, LandPlot, Mail, MapPin, Newspaper, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { NewsRow } from "@/components/app/rows";
import { Card, EmptyState, PageHeader, SectionHeading } from "@/components/ui/card";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getClubDetails } from "@/server/services/clubs";
import { listCourses } from "@/server/services/courses";
import { listNews } from "@/server/services/news";
import { NAV_FORWARD } from "@/components/motion/page-transition";

export const metadata: Metadata = { title: "Club" };

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <span className="mt-0.5 text-ink-3">{icon}</span>
      <div className="min-w-0">
        <dt className="font-label text-[10px] text-ink-3">{label}</dt>
        <dd className="mt-0.5 text-sm break-words whitespace-pre-line">{children}</dd>
      </div>
    </div>
  );
}

export default async function ClubPage() {
  const session = await requirePlayer();
  const { t, locale } = await getT();
  const [club, news, rules, courses] = await Promise.all([
    getClubDetails(session.clubId),
    listNews(session.clubId, locale, { limit: 20 }),
    listNews(session.clubId, locale, { kinds: ["rules"], limit: 5 }),
    listCourses(session.clubId, locale),
  ]);
  const format = { t, locale, timeZone: session.club.timeZone };
  const website = club?.website ? (/^https?:\/\//i.test(club.website) ? club.website : `https://${club.website}`) : null;

  return (
    <>
      <PageHeader eyebrow={t("app.club.eyebrow")} title={session.club.name} description={club?.tagline ?? undefined} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section>
          <SectionHeading title={t("app.club.news")} />
          {news.length > 0 ? (
            <ul className="stagger-children flex flex-col gap-2.5">
              {news.map((item) => (
                <li key={item.id}>
                  <NewsRow item={item} {...format} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Newspaper className="size-5" />} title={t("app.club.noNews")} description={t("app.club.noNewsLead")} />
          )}

          <div className="mt-8">
            <SectionHeading title={t("app.club.rules")} />
            {rules.length > 0 ? (
              <div className="stagger-children flex flex-col gap-2.5">
                {rules.map((rule) => (
                  <details key={rule.id} className="group rounded-card border border-line bg-surface shadow-card">
                    <summary className="flex items-center justify-between gap-3 px-4 py-3.5 font-semibold">
                      {rule.title}
                      <span className="text-ink-3 transition group-open:rotate-45" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="border-t border-line px-4 py-4 text-sm leading-relaxed whitespace-pre-line text-ink-2">{rule.body}</p>
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-3">{t("app.club.noRules")}</p>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section>
            <SectionHeading title={t("app.club.info")} />
            <Card padding="none">
              <dl className="divide-y divide-line px-4">
                {club?.address ? (
                  <InfoRow icon={<MapPin className="size-4" />} label={t("app.club.address")}>
                    {club.address}
                  </InfoRow>
                ) : null}
                {club?.openingHours ? (
                  <InfoRow icon={<Clock className="size-4" />} label={t("app.club.hours")}>
                    {club.openingHours}
                  </InfoRow>
                ) : null}
                {club?.phone ? (
                  <InfoRow icon={<Phone className="size-4" />} label={t("app.club.phone")}>
                    <a href={`tel:${club.phone.replace(/[^+\d]/g, "")}`} className="font-semibold text-brand-fg underline-offset-4 hover:underline">
                      {club.phone}
                    </a>
                  </InfoRow>
                ) : null}
                {club?.contactEmail ? (
                  <InfoRow icon={<Mail className="size-4" />} label={t("app.club.email")}>
                    <a href={`mailto:${club.contactEmail}`} className="font-semibold text-brand-fg underline-offset-4 hover:underline">
                      {club.contactEmail}
                    </a>
                  </InfoRow>
                ) : null}
                {website ? (
                  <InfoRow icon={<Globe className="size-4" />} label={t("app.club.website")}>
                    <a href={website} target="_blank" rel="noreferrer" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
                      {club?.website}
                    </a>
                  </InfoRow>
                ) : null}
              </dl>
            </Card>
          </section>

          <section>
            <SectionHeading
              title={t("app.club.courses")}
              action={
                <Link href="/app/courses" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
                  {t("common.viewAll")}
                </Link>
              }
            />
            <Card padding="none" className="divide-y divide-line">
              {courses.map((course) => (
                <Link key={course.id} href={`/app/courses/${course.id}`} transitionTypes={NAV_FORWARD} className="flex items-center gap-3 px-4 py-3 hover:bg-well">
                  <LandPlot className="size-4 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{course.name}</span>
                  <span className="text-xs text-ink-3">
                    {t("common.holes", { count: course.holeCount })} · {t("common.par")} {course.par}
                  </span>
                </Link>
              ))}
            </Card>
          </section>

          <Link href="/app/events" className="rounded-card border border-line bg-surface px-4 py-3.5 text-sm font-semibold shadow-card hover:border-line-strong">
            {t("app.events.title")} →
          </Link>
        </aside>
      </div>
    </>
  );
}
