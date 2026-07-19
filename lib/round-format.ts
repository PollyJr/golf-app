import type { Hole } from "@/lib/types";

export type RoundHoleCount = 9 | 18;

export function sourceHoleNumber(roundHoleNumber: number, courseHoleCount: RoundHoleCount) {
  return ((roundHoleNumber - 1) % courseHoleCount) + 1;
}

export function expandCourseLayout(layout: Hole[], holeCount: RoundHoleCount): Hole[] {
  if (!layout.length) return [];
  return Array.from({ length: holeCount }, (_, index) => {
    const source = layout[index % layout.length];
    return { ...source, number: index + 1 };
  });
}

export function calculateRoundPar(layout: Pick<Hole, "par">[], holeCount: RoundHoleCount) {
  if (!layout.length) return 0;
  return Array.from({ length: holeCount }, (_, index) => layout[index % layout.length].par)
    .reduce((total, par) => total + par, 0);
}
