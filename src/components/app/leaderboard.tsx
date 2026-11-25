"use client";

import { ArrowDown, ArrowUp, Minus, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ToPar } from "@/components/golf/score-mark";
import { useFormat, useT } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { Card, EmptyState } from "@/components/ui/card";
import { Segmented, Select } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatNumber, formatSigned } from "@/lib/format";
import type { HoleCount } from "@/lib/golf/scoring";
import { LEADERBOARD_CATEGORIES, PERIODS, type LeaderboardCategory, type LeaderboardEntry, type Period } from "@/lib/types";

interface LeaderboardProps {
  initial: LeaderboardEntry[];
  initialQuery: { period: Period; category: LeaderboardCategory; holes: HoleCount };
  courses: Array<{ id: string; name: string }>;
  meId: string;
}

const MINIMUM_FOR_AVERAGE: Record<Period, number> = { day: 1, week: 2, month: 3, year: 3, all: 3 };

/** The club ranking with its filters. Filters sit in one row above the list and scope everything below. */
export function Leaderboard({ initial, initialQuery, courses, meId }: LeaderboardProps) {
  const t = useT();
  const { locale } = useFormat();
  const [period, setPeriod] = useState<Period>(initialQuery.period);
  const [category, setCategory] = useState<LeaderboardCategory>(initialQuery.category);
  const [holes, setHoles] = useState<HoleCount>(initialQuery.holes);
  const [courseId, setCourseId] = useState("");
  const [entries, setEntries] = useState(initial);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    // The server already rendered the first view.
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ period, category, holes: String(holes) });
    if (courseId) params.set("course", courseId);
    api
      .get<{ entries: LeaderboardEntry[] }>(`/api/leaderboards?${params}`, { signal: controller.signal })
      .then((data) => {
        setEntries(data.entries);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, category, holes, courseId]);

  const mine = entries.find((entry) => entry.playerId === meId);

  function value(entry: LeaderboardEntry) {
    if (category === "average") return formatSigned(entry.value, locale);
    return formatNumber(entry.value, locale);
  }

  const valueLabel = {
    best: t("app.leaderboards.valueBest"),
    average: t("app.leaderboards.valueAverage"),
    rounds: t("app.leaderboards.valueRounds"),
    birdies: t("app.leaderboards.valueBirdies"),
  }[category];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Segmented
          label={t("app.leaderboards.period.label")}
          value={period}
          onChange={setPeriod}
          options={PERIODS.map((item) => ({ value: item, label: t(`app.leaderboards.period.${item}`) }))}
        />
        <Segmented
          label={t("app.leaderboards.category.label")}
          value={category}
          onChange={setCategory}
          size="sm"
          options={LEADERBOARD_CATEGORIES.map((item) => ({ value: item, label: t(`app.leaderboards.category.${item}`) }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label={t("app.leaderboards.holes")}
            value={String(holes) as "9" | "18"}
            onChange={(next) => setHoles(next === "18" ? 18 : 9)}
            size="sm"
            options={[
              { value: "9", label: t("common.holes", { count: 9 }) },
              { value: "18", label: t("common.holes", { count: 18 }) },
            ]}
          />
          {courses.length > 1 ? (
            <Select label={t("app.leaderboards.course")} value={courseId} onChange={(event) => setCourseId(event.target.value)} className="h-9 rounded-full">
              <option value="">{t("app.leaderboards.allCourses")}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
        {category === "average" ? (
          <p className="text-[13px] text-ink-3">{t("app.leaderboards.averageNote", { count: MINIMUM_FOR_AVERAGE[period] })}</p>
        ) : null}
      </div>

      <Card tone="brand" className="bg-ruled flex items-center gap-4">
        {mine ? (
          <>
            <span className="font-score text-5xl">#{mine.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="font-label text-[10.5px] text-accent">{t("app.leaderboards.yourPosition")}</p>
              <p className="mt-0.5 truncate text-sm opacity-80">
                {t("common.rounds", { count: mine.rounds })}
                {mine.courseName ? ` · ${mine.courseName}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-score text-4xl">{value(mine)}</p>
              {mine.toPar !== null ? <p className="font-score text-sm text-accent">{mine.toPar === 0 ? "E" : formatSigned(mine.toPar, locale, 0)}</p> : null}
            </div>
          </>
        ) : (
          <>
            <Trophy className="size-8 shrink-0 text-accent" />
            <p className="text-sm font-medium">{t("app.leaderboards.notRanked")}</p>
          </>
        )}
      </Card>

      {/* While refetching the previous list stays in place, dimmed: no layout jump. */}
      <div className={cn("transition-opacity", loading && "opacity-50")} aria-busy={loading}>
        {entries.length > 0 ? (
          <Card padding="none">
            <div className="font-label flex items-center gap-3 border-b border-line px-4 py-2.5 text-[10px] text-ink-3">
              <span className="w-8 text-center">#</span>
              <span className="flex-1">{t("common.players", { count: entries.length })}</span>
              <span>{valueLabel}</span>
            </div>
            <ol>
              {entries.map((entry) => (
                <li key={entry.playerId} className={cn("border-b border-line last:border-b-0", entry.playerId === meId && "bg-brand-soft")}>
                  <Link href={`/app/players/${entry.playerId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-well">
                    <span className={cn("font-score w-8 text-center text-xl", entry.rank === 1 ? "text-gold" : entry.rank <= 3 ? "text-ink" : "text-ink-3")}>
                      {entry.rank}
                    </span>
                    <Avatar name={entry.name} initials={entry.initials} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {entry.name}
                        {entry.playerId === meId ? <span className="font-label ml-2 text-[9.5px] text-brand-fg">{t("common.you")}</span> : null}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-ink-3">
                        <Movement movement={entry.movement} period={period} />
                        <span className="truncate">
                          {t("common.rounds", { count: entry.rounds })}
                          {entry.courseName ? ` · ${entry.courseName}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="font-score block text-2xl">{value(entry)}</span>
                      {entry.toPar !== null ? <ToPar value={entry.toPar} className="text-xs" /> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        ) : (
          <EmptyState icon={<Trophy className="size-5" />} title={t("app.leaderboards.empty")} description={t("app.leaderboards.emptyLead")} />
        )}
      </div>
    </div>
  );
}

/** Positions gained or lost against the previous period, with an icon as well as a colour. */
function Movement({ movement, period }: { movement: number | null; period: Period }) {
  const t = useT();
  if (period === "all") return null;
  if (movement === null) {
    return (
      <span className="inline-flex items-center gap-0.5 font-semibold text-info" title={t("app.leaderboards.fresh")}>
        <Sparkles className="size-3" />
        <span className="sr-only">{t("app.leaderboards.fresh")}</span>
      </span>
    );
  }
  if (movement === 0) {
    return (
      <span className="inline-flex items-center" title={t("app.leaderboards.same")}>
        <Minus className="size-3" />
        <span className="sr-only">{t("app.leaderboards.same")}</span>
      </span>
    );
  }
  const up = movement > 0;
  const label = up ? t("app.leaderboards.up", { count: movement }) : t("app.leaderboards.down", { count: Math.abs(movement) });
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold", up ? "text-under" : "text-over")} title={label}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(movement)}
      <span className="sr-only">{label}</span>
    </span>
  );
}
