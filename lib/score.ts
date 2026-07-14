import type { HoleScore, LeaderboardEntry } from "./types";

export function scoreToPar(scores: HoleScore[], pars: number[]) {
  return scores.reduce((total, item, index) => total + (item.strokes == null ? 0 : item.strokes - pars[index]), 0);
}

export function totalStrokes(scores: HoleScore[]) {
  return scores.reduce((total, item) => total + (item.strokes ?? 0), 0);
}

export function formatToPar(value: number) { return value === 0 ? "E" : value > 0 ? `+${value}` : String(value); }

export function rankBestRounds(entries: Omit<LeaderboardEntry,"rank">[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a,b)=>a.toPar-b.toPar || a.score-b.score);
  return sorted.map((entry,index)=>({ ...entry, rank:index > 0 && entry.toPar===sorted[index-1].toPar ? (index > 1 && sorted[index-2].toPar===entry.toPar ? index-1 : index) : index+1 }));
}
