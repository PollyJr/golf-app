/**
 * Data shapes that cross the server/client boundary. Services produce them,
 * API routes return them, components consume them.
 */
import type { AchievementKey } from "./golf/achievements";
import type { HoleCount, HoleInfo, RoundFormat, Strokes } from "./golf/scoring";
import type { Locale } from "./i18n/core";

export type AccountRole = "platform_admin" | "club_owner" | "club_staff" | "player";
export type RoundStatus = "inviting" | "active" | "pending" | "approved" | "rejected";
export type InvitationStatus = "pending" | "accepted";
export type RegistrationStatus = "pending" | "approved" | "rejected";
export type SelfRegistration = "closed" | "approval" | "open";
export type ClubStatus = "trial" | "active" | "suspended";
export type EventKind = "tournament" | "clinic" | "social";
export type ContentKind = "news" | "announcement" | "rules";
export type EventRegistrationStatus = "registered" | "waitlisted" | "cancelled";

export const PERIODS = ["day", "week", "month", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const LEADERBOARD_CATEGORIES = ["best", "average", "rounds", "birdies"] as const;
export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number];

// ----------------------------------------------------------------- club --

export interface ClubBranding {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  primaryColor: string;
  accentColor: string;
  timeZone: string;
  defaultLanguage: Locale;
}

export interface ClubDetails extends ClubBranding {
  status: ClubStatus;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  openingHours: string | null;
  selfRegistration: SelfRegistration;
  autoApproveRounds: boolean;
}

export interface ClubAdminSettings extends ClubDetails {
  joinCode: string;
  boardToken: string;
}

// -------------------------------------------------------------- session --

export interface SessionUser {
  role: AccountRole;
  accountId: string;
  displayName: string;
  initials: string;
  /** Players only. */
  username: string | null;
  code: string | null;
  mustChangeSecret: boolean;
}

// ------------------------------------------------------------- courses --

export interface CourseDto {
  id: string;
  name: string;
  description: string;
  holeCount: HoleCount;
  accent: string;
  tee: string;
  par: number;
  length: number;
  active: boolean;
  holes: HoleInfo[];
}

export interface CourseRecord {
  courseId: string;
  courseName: string;
  holeCount: HoleCount;
  playerId: string;
  playerName: string;
  initials: string;
  strokes: number;
  toPar: number;
  completedAt: string;
  roundId: string;
}

// ------------------------------------------------------------- players --

export interface PlayerSummary {
  id: string;
  name: string;
  initials: string;
  username: string;
  clubIndex: number | null;
}

export interface AdminPlayer extends PlayerSummary {
  code: string;
  email: string | null;
  active: boolean;
  registrationStatus: RegistrationStatus;
  mustChangePin: boolean;
  locked: boolean;
  rounds: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface IssuedCredentials {
  id: string;
  name: string;
  code: string;
  username: string;
  pin: string;
}

// -------------------------------------------------------------- rounds --

export interface RoundParticipantDto {
  id: string;
  playerId: string | null;
  name: string;
  initials: string;
  guest: boolean;
  position: number;
  invitation: InvitationStatus;
  scores: Strokes[];
  putts: (number | null)[];
}

export interface RoundCourse {
  id: string;
  name: string;
  accent: string;
  tee: string;
  par: number;
  /** Expanded to the number of holes of the round. */
  holes: HoleInfo[];
}

/** One score as it was entered, for the "latest" feed of a live round. */
export interface RoundActivity {
  participantId: string;
  hole: number;
  strokes: number;
  par: number;
  at: string;
}

export interface RoundViewer {
  playerId: string;
  participantId: string | null;
  isStarter: boolean;
  invitation: InvitationStatus | null;
}

export interface RoundSnapshot {
  id: string;
  revision: number;
  status: RoundStatus;
  format: RoundFormat;
  trackPutts: boolean;
  holeCount: HoleCount;
  starterId: string;
  starterName: string;
  clubName: string;
  /** The club's colours, so public pages can wear them without a session. */
  theme: { primaryColor: string; accentColor: string };
  timeZone: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  rejectionReason: string | null;
  course: RoundCourse;
  event: { id: string; title: string } | null;
  participants: RoundParticipantDto[];
  /** Present for participants only; never part of the public snapshot. */
  viewer?: RoundViewer;
  shareToken?: string | null;
  /** Behind the "scan to join" QR code; participants only, while the round is open. */
  joinToken?: string | null;
  /** The most recently entered scores, newest first. */
  activity: RoundActivity[];
}

export interface ActiveRoundSummary {
  id: string;
  revision: number;
  status: "inviting" | "active";
  format: RoundFormat;
  courseName: string;
  holeCount: HoleCount;
  createdAt: string;
  starterName: string;
  isStarter: boolean;
  myInvitation: InvitationStatus;
  participants: Array<{ name: string; initials: string; guest: boolean; invitation: InvitationStatus }>;
  completedScores: number;
  totalScores: number;
}

export interface RoundHistoryItem {
  id: string;
  status: "pending" | "approved" | "rejected";
  format: RoundFormat;
  courseName: string;
  holeCount: HoleCount;
  completedAt: string;
  strokes: number;
  par: number;
  participantCount: number;
  eventTitle: string | null;
}

export interface AdminRoundRow {
  id: string;
  status: RoundStatus;
  format: RoundFormat;
  courseName: string;
  holeCount: HoleCount;
  createdAt: string;
  completedAt: string | null;
  starterName: string;
  eventTitle: string | null;
  participants: Array<{ name: string; initials: string; guest: boolean; strokes: number; par: number }>;
}

// -------------------------------------------------------- leaderboards --

export interface LeaderboardEntry {
  playerId: string;
  rank: number;
  name: string;
  initials: string;
  /** Primary value for the category: strokes, average, rounds or birdies. */
  value: number;
  /** Secondary: score to par for `best`, rounds for the others. */
  toPar: number | null;
  rounds: number;
  courseName: string | null;
  /** Positions gained (+) or lost (−) since the previous period; `null` when new. */
  movement: number | null;
}

export interface AceEntry {
  playerId: string;
  playerName: string;
  initials: string;
  courseName: string;
  hole: number;
  distance: number;
  completedAt: string;
  roundId: string;
}

// -------------------------------------------------------------- events --

export interface EventDto {
  id: string;
  title: string;
  description: string;
  kind: EventKind;
  startsAt: string;
  endsAt: string | null;
  registrationClosesAt: string | null;
  location: string | null;
  courseId: string | null;
  courseName: string | null;
  capacity: number | null;
  registered: number;
  waitlisted: number;
  leaderboardEnabled: boolean;
  published: boolean;
  /** The viewing player's own registration, if any. */
  myStatus: EventRegistrationStatus | null;
  registrationOpen: boolean;
}

export interface EventParticipant {
  playerId: string;
  name: string;
  initials: string;
  status: EventRegistrationStatus;
  registeredAt: string;
}

export interface EventLeaderboardRow {
  rank: number;
  playerId: string;
  name: string;
  initials: string;
  strokes: number;
  toPar: number;
  holeCount: HoleCount;
  provisional: boolean;
  roundId: string;
}

// ------------------------------------------------------------- content --

export interface NewsItem {
  id: string;
  kind: ContentKind;
  title: string;
  body: string;
  pinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  authorName: string | null;
  createdAt: string;
}

// -------------------------------------------------------- notifications --

export type NotificationKind =
  | "round_invite"
  | "round_joined"
  | "round_started"
  | "round_approved"
  | "round_rejected"
  | "achievement"
  | "event_published"
  | "event_promoted"
  | "news_published";

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  data: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export interface AchievementDto {
  key: AchievementKey;
  achievedAt: string;
  roundId: string | null;
}

// ------------------------------------------------------------- generic --

export interface ApiErrorBody {
  code: string;
  message?: string;
  fields?: Record<string, string[]>;
}
