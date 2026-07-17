export type Language = "nl" | "en";
export type Period = "day" | "week" | "month" | "year";
export type RoundStatus = "inviting" | "active" | "pending" | "approved" | "rejected";
export type InvitationStatus = "pending" | "accepted";

export interface Hole { number: number; par: number; distance: number; name?: string }
export interface Course {
  id: string; name: string; holes: 9 | 18; accent: string; description: string;
  tee: string; totalPar: number; layout: Hole[];
}
export interface Player { id: string; name: string; initials: string; username: string; code: string; rounds: number }
export interface HoleScore { hole: number; strokes: number | null }
export interface RoundParticipant { playerId?: string; name: string; guest: boolean; scores: HoleScore[] }
export interface GolfRound {
  id: string; courseId: string; tee: string; createdAt: string; completedAt?: string;
  status: RoundStatus; participants: RoundParticipant[];
}
export interface LiveRoundParticipant {
  id: string; playerId: string; name: string; initials: string; position: number;
  invitationStatus: InvitationStatus; totalStrokes: number; totalPar: number; scores: Array<number | null>;
}
export interface LiveRoundSnapshot {
  id: string; revision: number; status: RoundStatus; starterPlayerId: string; isStarter: boolean;
  createdAt: string; completedAt: string | null;
  course: Course;
  participants: LiveRoundParticipant[];
  completedScores: number; totalScores: number;
}
export interface ActiveRoundSummary {
  id: string; revision: number; status: "inviting" | "active"; myInvitationStatus: InvitationStatus;
  courseName: string; holeCount: 9 | 18;
  createdAt: string; starterName: string; participantNames: string[];
  participantInitials: string[]; pendingInvitations: number; completedScores: number; totalScores: number;
}
export interface RoundResultSummary {
  id: string; status: "pending" | "approved" | "rejected"; courseName: string;
  holeCount: 9 | 18; completedAt: string; totalStrokes: number; totalPar: number;
  participantCount: number; winnerName: string; myRank: number;
}
export interface PublicRoundParticipant {
  position: number; name: string; initials: string; totalStrokes: number;
  totalPar: number; scores: Array<number | null>;
}
export interface PublicRoundSnapshot {
  revision: number; status: RoundStatus; clubName: string; createdAt: string;
  completedAt: string | null; course: Omit<Course, "id">;
  participants: PublicRoundParticipant[]; completedScores: number; totalScores: number;
}
export interface EventItem {
  id: string; title: string; date: string; time: string; courseId: string;
  description: string; capacity: number; registered: number; joined?: boolean; featured?: boolean;
}
export interface LeaderboardEntry {
  id: string; rank: number; name: string; initials: string; score: number; toPar: number;
  course: string; rounds: number; movement: number;
}
