import type { LiveRoundParticipant } from "@/lib/types";

export interface RankedResult extends LiveRoundParticipant {
  rank: number;
  scoreToPar: number;
}

export function rankRoundParticipants(participants: LiveRoundParticipant[]): RankedResult[] {
  const ordered = [...participants].sort((left, right) =>
    (left.totalStrokes - left.totalPar) - (right.totalStrokes - right.totalPar)
    || left.totalStrokes - right.totalStrokes
    || left.position - right.position,
  );
  let currentRank = 0;
  return ordered.map((participant, index) => {
    const scoreToPar = participant.totalStrokes - participant.totalPar;
    const previous = index > 0 ? ordered[index - 1] : null;
    const tied = previous && previous.totalStrokes - previous.totalPar === scoreToPar && previous.totalStrokes === participant.totalStrokes;
    if (!tied) currentRank = index + 1;
    return { ...participant, rank: currentRank, scoreToPar };
  });
}

export function formatToPar(score: number) {
  return score === 0 ? "E" : score > 0 ? `+${score}` : String(score);
}
