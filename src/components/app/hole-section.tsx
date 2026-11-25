"use client";

import { useState } from "react";
import { HoleBars } from "@/components/charts/hole-bars";
import { useFormat, useT } from "@/components/providers";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { formatNumber, formatSigned } from "@/lib/format";
import { formatToPar } from "@/lib/golf/scoring";
import type { CourseStats } from "@/lib/golf/stats";

/** Per-hole averages for one course at a time: the chart, and the same numbers as a table. */
export function HoleSection({ courses }: { courses: CourseStats[] }) {
  const t = useT();
  const { locale } = useFormat();
  const playable = courses.filter((course) => course.holes.length > 0);
  const [courseId, setCourseId] = useState(playable[0]?.courseId ?? "");
  const course = playable.find((item) => item.courseId === courseId) ?? playable[0];
  if (!course) return null;

  const hardest = course.holes.reduce((worst, hole) => (hole.toPar > worst.toPar ? hole : worst), course.holes[0]);
  const easiest = course.holes.reduce((best, hole) => (hole.toPar < best.toPar ? hole : best), course.holes[0]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{course.courseName}</p>
          {course.best ? (
            <p className="text-[13px] text-ink-3">{t("app.stats.courseBest", { strokes: course.best.strokes, toPar: formatToPar(course.best.toPar) })}</p>
          ) : null}
        </div>
        {playable.length > 1 ? (
          <Select label={t("app.stats.course")} value={course.courseId} onChange={(event) => setCourseId(event.target.value)}>
            {playable.map((item) => (
              <option key={item.courseId} value={item.courseId}>
                {item.courseName}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <HoleBars holes={course.holes} label={`${t("app.stats.holesHeading")}: ${course.courseName}`} />

      <div className="mt-4 overflow-x-auto">
        <table className="tabular w-full text-sm">
          <thead>
            <tr className="font-label text-[10px] text-ink-3">
              <th scope="col" className="py-2 text-left font-[inherit]">{t("common.hole")}</th>
              <th scope="col" className="py-2 text-right font-[inherit]">{t("common.par")}</th>
              <th scope="col" className="py-2 text-right font-[inherit]">{t("app.stats.holeAverage")}</th>
              <th scope="col" className="py-2 text-right font-[inherit]">{t("app.stats.holeBest")}</th>
              <th scope="col" className="py-2 text-right font-[inherit]">{t("app.stats.holeTimes")}</th>
            </tr>
          </thead>
          <tbody>
            {course.holes.map((hole) => (
              <tr key={hole.hole} className="border-t border-line">
                <th scope="row" className="py-2 text-left font-semibold">
                  {hole.hole}
                  {hole === hardest && hole.toPar > 0 ? <span className="font-label ml-2 text-[9.5px] text-over">{t("app.stats.hardest")}</span> : null}
                  {hole === easiest && hole !== hardest ? <span className="font-label ml-2 text-[9.5px] text-under">{t("app.stats.easiest")}</span> : null}
                </th>
                <td className="py-2 text-right text-ink-3">{hole.par}</td>
                <td className="py-2 text-right">
                  <span className="font-semibold">{formatNumber(hole.average, locale, 1)}</span>{" "}
                  <span className={cn("text-xs", hole.toPar > 0.05 ? "text-over" : hole.toPar < -0.05 ? "text-under" : "text-ink-3")}>{formatSigned(hole.toPar, locale)}</span>
                </td>
                <td className="py-2 text-right">{hole.best}</td>
                <td className="py-2 text-right text-ink-3">{hole.rounds}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
