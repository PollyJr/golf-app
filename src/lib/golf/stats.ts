/**
 * Player statistics, aggregated from approved rounds. Pure, so the same code
 * serves a player's own statistics page and the public member profile.
 */
import { differential } from "./club-index";
import { emptyDistribution, scoreKind, type ScoreDistribution, type Strokes } from "./scoring";

export interface StatRound {
  roundId: string;
  completedAt: Date;
  courseId: string;
  courseName: string;
  /** Holes of the round (9 or 18). */
  holeCount: number;
  /** Holes of the course; a 9-hole course played twice gives an 18-hole round. */
  courseHoleCount: number;
  scores: readonly Strokes[];
  pars: readonly number[];
  putts: readonly (number | null)[];
}

export interface TrendPoint {
  roundId: string;
  completedAt: string;
  courseName: string;
  holeCount: number;
  strokes: number;
  toPar: number;
  /** Strokes over par normalised to nine holes, so 9 and 18 hole rounds compare. */
  per9: number;
}

export interface HoleAverage {
  hole: number;
  par: number;
  rounds: number;
  average: number;
  best: number;
  /** Average strokes relative to par; the highest value is the player's hardest hole. */
  toPar: number;
}

export interface CourseStats {
  courseId: string;
  courseName: string;
  rounds: number;
  best: { strokes: number; toPar: number; holeCount: number; roundId: string } | null;
  holes: HoleAverage[];
}

export interface PlayerStats {
  rounds: number;
  holes: number;
  /** Average strokes over par per nine holes. */
  averagePer9: number | null;
  best: TrendPoint | null;
  distribution: ScoreDistribution;
  /** Share of holes played at par or better, 0–1. */
  parOrBetterRate: number | null;
  averagePutts: number | null;
  puttHoles: number;
  /** Most recent last. */
  trend: TrendPoint[];
  /** Difference between the average of the last five rounds and the five before; negative is improving. */
  form: number | null;
  courses: CourseStats[];
  lastPlayedAt: string | null;
}

const TREND_LENGTH = 20;
const FORM_WINDOW = 5;

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function summarizeRounds(input: readonly StatRound[]): PlayerStats {
  const rounds = [...input].sort((left, right) => left.completedAt.getTime() - right.completedAt.getTime());
  const distribution = emptyDistribution();
  const points: TrendPoint[] = [];
  let holes = 0;
  let parOrBetter = 0;
  let puttTotal = 0;
  let puttHoles = 0;

  const perCourse = new Map<
    string,
    { name: string; rounds: number; best: CourseStats["best"]; holes: Map<number, { par: number; values: number[] }> }
  >();

  for (const round of rounds) {
    let strokes = 0;
    let par = 0;
    let played = 0;
    const course =
      perCourse.get(round.courseId) ?? { name: round.courseName, rounds: 0, best: null, holes: new Map() };

    round.scores.forEach((value, index) => {
      if (value === null) return;
      const holePar = round.pars[index] ?? 3;
      strokes += value;
      par += holePar;
      played += 1;
      distribution[scoreKind(value, holePar)] += 1;
      if (value <= holePar) parOrBetter += 1;

      const putts = round.putts[index] ?? null;
      if (putts !== null) {
        puttTotal += putts;
        puttHoles += 1;
      }

      // Per-hole averages are keyed on the physical hole, so the second loop
      // of a 9-hole course counts towards the same hole.
      const physicalHole = (index % round.courseHoleCount) + 1;
      const hole = course.holes.get(physicalHole) ?? { par: holePar, values: [] };
      hole.values.push(value);
      course.holes.set(physicalHole, hole);
    });

    if (played === 0) continue;
    holes += played;
    const complete = played === round.holeCount;
    const point: TrendPoint = {
      roundId: round.roundId,
      completedAt: round.completedAt.toISOString(),
      courseName: round.courseName,
      holeCount: round.holeCount,
      strokes,
      toPar: strokes - par,
      per9: differential({ strokes, par, holeCount: played }),
    };
    if (complete) {
      points.push(point);
      course.rounds += 1;
      const better =
        course.best === null ||
        point.per9 < differential({ strokes: course.best.strokes, par: course.best.strokes - course.best.toPar, holeCount: course.best.holeCount });
      if (better) course.best = { strokes, toPar: point.toPar, holeCount: round.holeCount, roundId: round.roundId };
    }
    perCourse.set(round.courseId, course);
  }

  const per9Values = points.map((point) => point.per9);
  const recent = average(per9Values.slice(-FORM_WINDOW));
  const before = average(per9Values.slice(-FORM_WINDOW * 2, -FORM_WINDOW));
  const best = points.reduce<TrendPoint | null>(
    (current, point) => (current === null || point.per9 < current.per9 ? point : current),
    null,
  );

  const courses: CourseStats[] = [...perCourse.entries()]
    .map(([courseId, course]) => ({
      courseId,
      courseName: course.name,
      rounds: course.rounds,
      best: course.best,
      holes: [...course.holes.entries()]
        .sort(([left], [right]) => left - right)
        .map(([hole, data]) => {
          const mean = data.values.reduce((total, value) => total + value, 0) / data.values.length;
          return {
            hole,
            par: data.par,
            rounds: data.values.length,
            average: mean,
            best: Math.min(...data.values),
            toPar: mean - data.par,
          };
        }),
    }))
    .sort((left, right) => right.rounds - left.rounds);

  return {
    rounds: points.length,
    holes,
    averagePer9: average(per9Values),
    best,
    distribution,
    parOrBetterRate: holes === 0 ? null : parOrBetter / holes,
    averagePutts: puttHoles === 0 ? null : puttTotal / puttHoles,
    puttHoles,
    trend: points.slice(-TREND_LENGTH),
    form: recent !== null && before !== null && per9Values.length >= FORM_WINDOW * 2 ? recent - before : null,
    courses,
    lastPlayedAt: rounds.length > 0 ? rounds[rounds.length - 1].completedAt.toISOString() : null,
  };
}
