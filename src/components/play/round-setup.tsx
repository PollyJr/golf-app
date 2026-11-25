"use client";

import { Check, Flag, Plus, Search, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useErrorMessage, useT } from "@/components/providers";
import { useOverview } from "@/components/shell/overview";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { FormError, Segmented, SelectField, Switch } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatClubIndex } from "@/lib/golf/club-index";
import { MAX_FLIGHT_SIZE, type HoleCount, type RoundFormat } from "@/lib/golf/scoring";
import type { CourseDto, PlayerSummary } from "@/lib/types";

interface RoundSetupProps {
  me: PlayerSummary;
  courses: CourseDto[];
  recentPartners: PlayerSummary[];
  events: Array<{ id: string; title: string; courseId: string | null }>;
  preselect: { courseId?: string; partner?: PlayerSummary | null; eventId?: string };
}

const SEARCH_DEBOUNCE_MS = 220;

export function RoundSetup({ me, courses, recentPartners, events, preselect }: RoundSetupProps) {
  const t = useT();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { overview } = useOverview();

  const initialCourse = courses.find((course) => course.id === preselect.courseId) ?? courses[0];
  const [courseId, setCourseId] = useState(initialCourse?.id ?? "");
  const [holeCount, setHoleCount] = useState<HoleCount>(initialCourse?.holeCount ?? 9);
  const [format, setFormat] = useState<RoundFormat>("stroke");
  const [trackPutts, setTrackPutts] = useState(false);
  const [eventId, setEventId] = useState(preselect.eventId ?? "");
  const [members, setMembers] = useState<PlayerSummary[]>(preselect.partner ? [preselect.partner] : []);
  const [guests, setGuests] = useState<string[]>([]);
  const [guestName, setGuestName] = useState("");
  const [query, setQuery] = useState("");
  // The players found for a given search term; stale once the term changes.
  const [found, setFound] = useState<{ term: string; players: PlayerSummary[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // One id per page view: a retried request can never create a second round.
  const clientId = useRef<string>("");

  const course = courses.find((item) => item.id === courseId);
  const flightSize = 1 + members.length + guests.length;
  const full = flightSize >= MAX_FLIGHT_SIZE;
  const matchProblem = format === "match" && flightSize !== 2;
  const playableEvents = events.filter((event) => event.courseId === null || event.courseId === courseId);
  const activeRound = overview.rounds.find((round) => round.status === "active" && round.myInvitation === "accepted");

  const term = query.trim();
  const searchable = term.length >= 2;
  const results = searchable && found?.term === term ? found.players : [];
  const searching = searchable && found?.term !== term;

  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const data = await api.get<{ players: PlayerSummary[] }>(`/api/players/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        setFound({ term, players: data.players });
      } catch {
        if (!controller.signal.aborted) setFound({ term, players: [] });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, searchable]);

  function addMember(player: PlayerSummary) {
    if (full || members.some((member) => member.id === player.id)) return;
    setMembers((current) => [...current, player]);
    setQuery("");
  }

  function addGuest(event: FormEvent) {
    event.preventDefault();
    const name = guestName.trim();
    if (!name || full) return;
    setGuests((current) => [...current, name.slice(0, 60)]);
    setGuestName("");
  }

  async function start() {
    if (!course || matchProblem) return;
    setBusy(true);
    setError("");
    clientId.current ||= crypto.randomUUID();
    try {
      const result = await api.post<{ id: string }>("/api/rounds", {
        clientId: clientId.current,
        courseId: course.id,
        holeCount,
        format,
        trackPutts,
        playerIds: members.map((member) => member.id),
        guests,
        eventId: playableEvents.some((event) => event.id === eventId) ? eventId : null,
      });
      router.push(`/app/play/${result.id}`);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  if (courses.length === 0) {
    return (
      <>
        <PageHeader eyebrow={t("play.setup.eyebrow")} title={t("play.setup.title")} />
        <EmptyState icon={<Flag className="size-5" />} title={t("play.setup.noCourses")} />
      </>
    );
  }

  const suggestions = recentPartners.filter((partner) => !members.some((member) => member.id === partner.id));

  return (
    <>
      <PageHeader eyebrow={t("play.setup.eyebrow")} title={t("play.setup.title")} />

      {activeRound ? (
        <Link
          href={`/app/play/${activeRound.id}`}
          className="mb-6 flex items-center justify-between gap-3 rounded-card border border-under/40 bg-under-soft px-4 py-3 text-sm font-semibold text-under"
        >
          {t("play.setup.activeBanner")}
          <span className="underline underline-offset-4">{t("play.setup.activeContinue")}</span>
        </Link>
      ) : null}

      <div className="flex flex-col gap-8">
        {/* ------------------------------------------------------------ course */}
        <section>
          <h2 className="font-label mb-3 text-[11px] text-ink-3">1 · {t("play.setup.courseHeading")}</h2>
          <div role="radiogroup" aria-label={t("play.setup.courseHeading")} className="grid gap-2.5 sm:grid-cols-2">
            {courses.map((item) => {
              const selected = item.id === courseId;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setCourseId(item.id);
                    setHoleCount(item.holeCount);
                  }}
                  className={cn(
                    "flex items-center gap-4 rounded-card border bg-surface p-4 text-left shadow-card transition active:scale-[0.99]",
                    selected ? "border-brand-fg ring-2 ring-brand-fg/20" : "border-line hover:border-line-strong",
                  )}
                >
                  <span className="font-score grid size-12 shrink-0 place-items-center rounded-full text-xl text-[#10291d]" style={{ backgroundColor: item.accent }}>
                    {item.holeCount}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{item.name}</span>
                    <span className="block text-[13px] text-ink-3">
                      {t("common.holes", { count: item.holeCount })} · {t("play.setup.courseMeta", { par: item.par, length: item.length })}
                    </span>
                  </span>
                  {selected ? <Check className="size-5 shrink-0 text-brand-fg" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* ------------------------------------------------------------- round */}
        <section>
          <h2 className="font-label mb-3 text-[11px] text-ink-3">2 · {t("play.setup.roundHeading")}</h2>
          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t("play.setup.holesLabel")}</p>
                {course && holeCount !== course.holeCount ? (
                  <p className="mt-0.5 text-[13px] text-ink-3">{holeCount > course.holeCount ? t("play.setup.twiceRound") : t("play.setup.firstNine")}</p>
                ) : null}
              </div>
              <Segmented
                label={t("play.setup.holesLabel")}
                value={String(holeCount) as "9" | "18"}
                onChange={(value) => setHoleCount(value === "18" ? 18 : 9)}
                options={[
                  { value: "9", label: "9" },
                  { value: "18", label: "18" },
                ]}
              />
            </div>
            <div className="border-t border-line pt-5">
              <p className="mb-2.5 text-sm font-semibold">{t("play.setup.formatLabel")}</p>
              <Segmented
                label={t("play.setup.formatLabel")}
                value={format}
                onChange={setFormat}
                options={[
                  { value: "stroke", label: t("common.format.stroke") },
                  { value: "stableford", label: t("common.format.stableford") },
                  { value: "match", label: t("common.format.match") },
                ]}
              />
              <p className="mt-2.5 text-[13px] text-ink-3">{t(`common.formatHint.${format}`)}</p>
            </div>
            <Switch
              className="border-t border-line pt-5"
              checked={trackPutts}
              onChange={setTrackPutts}
              label={t("play.setup.putts")}
              description={t("play.setup.puttsHint")}
            />
            {playableEvents.length > 0 ? (
              <SelectField className="border-t border-line pt-5" label={t("play.setup.eventLabel")} value={eventId} onChange={(event) => setEventId(event.target.value)}>
                <option value="">{t("play.setup.eventNone")}</option>
                {playableEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </SelectField>
            ) : null}
          </Card>
        </section>

        {/* ------------------------------------------------------------ flight */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-label text-[11px] text-ink-3">3 · {t("play.setup.flightHeading")}</h2>
            <Badge tone={full ? "gold" : "neutral"}>{t("play.setup.flightCount", { count: flightSize })}</Badge>
          </div>
          <Card padding="none" className="divide-y divide-line">
            <div className="flex items-center gap-3 px-4 py-3">
              <Avatar name={me.name} initials={me.initials} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{me.name}</p>
                <p className="text-[13px] text-ink-3">
                  {t("common.you")} · {t("common.clubIndex")} {formatClubIndex(me.clubIndex)}
                </p>
              </div>
            </div>
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={member.name} initials={member.initials} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{member.name}</p>
                  <p className="truncate text-[13px] text-ink-3">@{member.username}</p>
                </div>
                <button
                  type="button"
                  aria-label={`${t("common.remove")}: ${member.name}`}
                  onClick={() => setMembers((current) => current.filter((item) => item.id !== member.id))}
                  className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {guests.map((guest, index) => (
              <div key={`${guest}-${index}`} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={guest} initials={guest.slice(0, 1).toUpperCase()} guest />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{guest}</p>
                  <p className="text-[13px] text-ink-3">{t("common.guest")}</p>
                </div>
                <button
                  type="button"
                  aria-label={`${t("common.remove")}: ${guest}`}
                  onClick={() => setGuests((current) => current.filter((_, position) => position !== index))}
                  className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}

            {!full ? (
              <div className="flex flex-col gap-4 p-4">
                <div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t("play.setup.searchPlaceholder")}
                      aria-label={t("play.setup.searchPlaceholder")}
                      autoComplete="off"
                      className="h-12 w-full rounded-control border border-line-strong bg-surface pr-3 pl-10 text-[15px] placeholder:text-ink-3 focus:border-brand-fg focus:ring-3 focus:ring-brand-fg/15 focus:outline-none"
                    />
                  </div>
                  {searchable ? (
                    <ul className="mt-2 flex flex-col gap-1" aria-live="polite">
                      {results
                        .filter((player) => !members.some((member) => member.id === player.id))
                        .map((player) => (
                          <li key={player.id}>
                            <button
                              type="button"
                              onClick={() => addMember(player)}
                              className="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-well"
                            >
                              <Avatar name={player.name} initials={player.initials} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{player.name}</span>
                                <span className="block truncate text-xs text-ink-3">@{player.username}</span>
                              </span>
                              <Plus className="size-4 text-brand-fg" />
                            </button>
                          </li>
                        ))}
                      {results.length === 0 ? (
                        <li className="px-2 py-2 text-sm text-ink-3">{searching ? t("play.setup.searching") : t("play.setup.noResults")}</li>
                      ) : null}
                    </ul>
                  ) : suggestions.length > 0 ? (
                    <div className="mt-3">
                      <p className="font-label mb-2 text-[10px] text-ink-3">{t("play.setup.recent")}</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((partner) => (
                          <button
                            key={partner.id}
                            type="button"
                            onClick={() => addMember(partner)}
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm font-medium hover:bg-well"
                          >
                            <Avatar name={partner.name} initials={partner.initials} size="xs" />
                            {partner.name.split(/\s+/)[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <form onSubmit={addGuest} className="flex gap-2 border-t border-line pt-4">
                  <input
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    placeholder={t("play.setup.guestPlaceholder")}
                    aria-label={t("play.setup.guestPlaceholder")}
                    maxLength={60}
                    className="h-11 min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-3.5 text-[15px] placeholder:text-ink-3 focus:border-brand-fg focus:ring-3 focus:ring-brand-fg/15 focus:outline-none"
                  />
                  <Button type="submit" variant="secondary" disabled={!guestName.trim()} icon={<UserPlus className="size-4" />}>
                    {t("play.setup.addGuest")}
                  </Button>
                </form>
              </div>
            ) : null}
          </Card>
          <p className="mt-2.5 text-[13px] text-ink-3">
            {members.length > 0 ? t("play.setup.invitedNote") : null} {guests.length > 0 ? t("play.setup.guestNote") : null}
          </p>
        </section>

        <div className="sticky bottom-24 z-10 flex flex-col gap-2 lg:bottom-6">
          <FormError>{error || (matchProblem ? t("common.errors.MATCH_NEEDS_TWO") : "")}</FormError>
          <Button variant="accent" size="lg" block loading={busy} disabled={!course || matchProblem} onClick={() => void start()} icon={<Flag className="size-[1.1rem]" />} className="shadow-pop">
            {members.length > 0 ? t("play.setup.invite") : t("play.setup.start")}
          </Button>
        </div>
      </div>
    </>
  );
}
