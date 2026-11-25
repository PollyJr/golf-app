import { Clock, Flag, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventRegistration } from "@/components/app/event-registration";
import { DateTile } from "@/components/app/rows";
import { ToPar } from "@/components/golf/score-mark";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, Eyebrow, SectionHeading } from "@/components/ui/card";
import { formatDateTime, formatLongDate, formatTime } from "@/lib/format";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getEvent, getEventLeaderboard, listEventParticipants, listPlayableEvents } from "@/server/services/events";
import { NAV_BACK, NAV_FORWARD } from "@/components/motion/page-transition";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlayer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t, locale } = await getT();
  const timeZone = session.club.timeZone;
  const event = await getEvent(session.clubId, id, locale, { playerId: session.accountId });
  if (!event) notFound();

  const [participants, leaderboard, playable] = await Promise.all([
    listEventParticipants(session.clubId, id),
    event.leaderboardEnabled ? getEventLeaderboard(session.clubId, id) : Promise.resolve([]),
    event.leaderboardEnabled ? listPlayableEvents(session.clubId, locale) : Promise.resolve([]),
  ]);
  const registered = participants.filter((participant) => participant.status === "registered");
  const waitlisted = participants.filter((participant) => participant.status === "waitlisted");
  // A round can count for the event on the day(s) it takes place.
  const playableToday = playable.some((item) => item.id === event.id);

  return (
    <div className="flex flex-col gap-7">
      <Link href="/app/events" transitionTypes={NAV_BACK} className="text-sm font-semibold text-ink-2 hover:text-ink">
        ← {t("app.events.backToEvents")}
      </Link>

      <header className="flex items-start gap-4">
        <DateTile date={event.startsAt} locale={locale} timeZone={timeZone} className="w-16 py-3" />
        <div className="min-w-0">
          <Eyebrow>{t(`common.eventKind.${event.kind}`)}</Eyebrow>
          <h1 className="font-display mt-1.5 text-[clamp(1.8rem,6vw,2.7rem)] text-balance">{event.title}</h1>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          {event.description ? <p className="max-w-prose text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{event.description}</p> : null}

          {event.leaderboardEnabled ? (
            <section>
              <SectionHeading title={t("app.events.leaderboard")} />
              {leaderboard.length > 0 ? (
                <Card padding="none">
                  <ol>
                    {leaderboard.map((row) => (
                      <li key={row.playerId} className="border-b border-line last:border-b-0">
                        <Link href={`/app/players/${row.playerId}`} transitionTypes={NAV_FORWARD} className="flex items-center gap-3 px-4 py-3 hover:bg-well">
                          <span className={`font-score w-7 text-center text-xl ${row.rank === 1 ? "text-gold" : "text-ink-3"}`}>{row.rank}</span>
                          <Avatar name={row.name} initials={row.initials} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.name}</span>
                          {row.provisional ? <Badge tone="gold">{t("app.events.provisional")}</Badge> : null}
                          <span className="text-right">
                            <span className="font-score block text-2xl">{row.strokes}</span>
                            <ToPar value={row.toPar} className="text-xs" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </Card>
              ) : (
                <p className="text-sm text-ink-3">{t("app.events.leaderboardEmpty")}</p>
              )}
              {playableToday ? (
                <LinkButton href={`/app/play?event=${event.id}${event.courseId ? `&course=${event.courseId}` : ""}`} variant="accent" className="mt-4" icon={<Flag className="size-4" />}>
                  {t("app.events.playFor")}
                </LinkButton>
              ) : null}
            </section>
          ) : null}

          <section>
            <SectionHeading
              title={t("app.events.participants")}
              action={<span className="text-ink-3">{event.capacity !== null ? t("app.events.spots", { registered: event.registered, capacity: event.capacity }) : t("app.events.spotsOpen", { count: event.registered })}</span>}
            />
            {registered.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {registered.map((participant) => (
                  <li key={participant.playerId}>
                    <Link
                      href={`/app/players/${participant.playerId}`}
                      transitionTypes={NAV_FORWARD}
                      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3.5 pl-1 text-sm font-medium hover:bg-well"
                    >
                      <Avatar name={participant.name} initials={participant.initials} size="sm" />
                      {participant.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">{t("app.events.noParticipants")}</p>
            )}
            {waitlisted.length > 0 ? <p className="mt-3 text-[13px] text-ink-3">{t("app.events.waitlist", { count: waitlisted.length })}</p> : null}
          </section>
        </div>

        <aside className="order-first lg:order-none">
          <Card className="flex flex-col gap-4 lg:sticky lg:top-8">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <div>
                  <dt className="sr-only">{t("app.events.when")}</dt>
                  <dd className="font-semibold first-letter:uppercase">{formatLongDate(event.startsAt, locale, timeZone)}</dd>
                  <dd className="text-ink-3">
                    {formatTime(event.startsAt, locale, timeZone)}
                    {event.endsAt ? ` ${t("app.events.untilTime", { time: formatTime(event.endsAt, locale, timeZone) })}` : ""}
                  </dd>
                </div>
              </div>
              {event.location || event.courseName ? (
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" />
                  <div>
                    <dt className="sr-only">{t("app.events.where")}</dt>
                    <dd className="font-semibold">{event.location || event.courseName}</dd>
                    {event.location && event.courseName ? <dd className="text-ink-3">{event.courseName}</dd> : null}
                  </div>
                </div>
              ) : null}
              <div className="flex gap-3">
                <Users className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <div>
                  <dt className="sr-only">{t("app.events.participants")}</dt>
                  <dd className="font-semibold">
                    {event.capacity !== null ? t("app.events.spots", { registered: event.registered, capacity: event.capacity }) : t("app.events.spotsOpen", { count: event.registered })}
                  </dd>
                  {event.registrationClosesAt && event.registrationOpen ? (
                    <dd className="text-ink-3">{t("app.events.closesAt", { date: formatDateTime(event.registrationClosesAt, locale, timeZone) })}</dd>
                  ) : null}
                </div>
              </div>
            </dl>
            <EventRegistration event={event} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
