import {
  ArrowDownToLine,
  Award,
  Bird,
  CalendarCheck,
  Crown,
  Equal,
  Flag,
  Flame,
  Lock,
  Medal,
  Milestone,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import { ACHIEVEMENT_KEYS, ACHIEVEMENT_TIERS, type AchievementKey, type AchievementTier } from "@/lib/golf/achievements";
import type { Locale } from "@/lib/i18n/core";
import type { AppTranslate } from "@/lib/i18n/dictionaries";
import type { AchievementDto } from "@/lib/types";

const ICONS: Record<AchievementKey, LucideIcon> = {
  first_round: Flag,
  rounds_10: Medal,
  rounds_25: Medal,
  rounds_50: Award,
  rounds_100: Crown,
  first_birdie: Bird,
  ace: Target,
  level_par: Equal,
  under_par: ArrowDownToLine,
  bogey_free: ShieldCheck,
  birdie_streak: Flame,
  full_eighteen: Milestone,
  flight_winner: Trophy,
  social: Users,
  regular: CalendarCheck,
};

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

/** Earned in the last week: it still gleams. */
function isRecent(achievedAt: string): boolean {
  return Date.now() - new Date(achievedAt).getTime() < RECENT_MS;
}

const TIER_STYLE: Record<AchievementTier, string> = {
  bronze: "bg-over-soft text-over",
  silver: "bg-info-soft text-info",
  gold: "bg-gold-soft text-gold",
};

interface AchievementGridProps {
  earned: AchievementDto[];
  t: AppTranslate;
  locale: Locale;
  timeZone: string;
  /** Hide what has not been earned, e.g. on someone else's profile. */
  earnedOnly?: boolean;
}

export function AchievementGrid({ earned, t, locale, timeZone, earnedOnly }: AchievementGridProps) {
  const byKey = new Map(earned.map((achievement) => [achievement.key, achievement]));
  const keys = ACHIEVEMENT_KEYS.filter((key) => !earnedOnly || byKey.has(key));
  // Earned first, in the order they were achieved; the rest in catalogue order.
  const ordered = [...keys].sort((left, right) => Number(byKey.has(right)) - Number(byKey.has(left)));

  return (
    <ul className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ordered.map((key) => {
        const achievement = byKey.get(key);
        const Icon = ICONS[key];
        return (
          <li
            key={key}
            className={cn(
              "flex flex-col items-center rounded-card border p-4 text-center transition duration-300",
              achievement ? "border-line bg-surface shadow-card hover:-translate-y-0.5 hover:shadow-pop" : "border-dashed border-line-strong opacity-60",
              achievement && isRecent(achievement.achievedAt) && "shine border-gold/40",
            )}
          >
            <span
              className={cn(
                "grid size-12 place-items-center rounded-full transition-transform duration-500 ease-(--ease-spring)",
                achievement ? `${TIER_STYLE[ACHIEVEMENT_TIERS[key]]} hover:scale-110 hover:-rotate-6` : "bg-well text-ink-3",
              )}
            >
              {achievement ? <Icon className="size-6" /> : <Lock className="size-5" />}
            </span>
            <p className="mt-3 text-sm font-bold text-balance">{t(`app.achievements.${key}.title`)}</p>
            <p className="mt-1 text-xs text-pretty text-ink-3">{t(`app.achievements.${key}.description`)}</p>
            <p className="font-label mt-2 text-[9.5px] text-ink-3">
              {achievement ? formatShortDate(achievement.achievedAt, locale, timeZone) : t("app.stats.locked")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
