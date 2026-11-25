import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getNewsItem } from "@/server/services/news";

export default async function NewsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlayer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t, locale } = await getT();
  const item = await getNewsItem(session.clubId, id, locale);
  if (!item) notFound();

  return (
    <article className="mx-auto max-w-2xl">
      <Link href="/app/club" className="text-sm font-semibold text-ink-2 hover:text-ink">
        ← {t("app.club.backToClub")}
      </Link>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {item.kind === "announcement" ? <Badge tone="info">{t("app.club.announcement")}</Badge> : null}
        {item.kind === "rules" ? <Badge>{t("app.club.rules")}</Badge> : null}
        {item.publishedAt ? (
          <span className="text-[13px] text-ink-3">
            {t("app.club.postedOn", { date: formatDate(item.publishedAt, locale, session.club.timeZone) })}
            {item.authorName ? ` ${t("app.club.by", { name: item.authorName })}` : ""}
          </span>
        ) : null}
      </div>
      <h1 className="font-display mt-3 text-[clamp(1.9rem,6vw,2.8rem)] text-balance">{item.title}</h1>
      <div className="mt-6 text-base leading-relaxed whitespace-pre-line text-ink-2">{item.body}</div>
    </article>
  );
}
