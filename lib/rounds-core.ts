import type { LiveRoundParticipant } from "@/lib/types";

export function completedScoreCount(participants: Pick<LiveRoundParticipant, "scores">[]) {
  return participants.reduce((total, participant) => total + participant.scores.filter((score) => score !== null).length, 0);
}

export function roundIsComplete(participants: Pick<LiveRoundParticipant, "scores">[], holeCount: number) {
  return participants.length > 0 && participants.every((participant) => participant.scores.length === holeCount && participant.scores.every((score) => score !== null));
}

export function shareExpiry(completedAt: Date) {
  return new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
}

export function revisionEtag(revision: number) {
  return `\"round-${revision}\"`;
}

export function etagMatches(header: string | null, revision: number) {
  return header?.split(",").map((value) => value.trim()).includes(revisionEtag(revision)) ?? false;
}
