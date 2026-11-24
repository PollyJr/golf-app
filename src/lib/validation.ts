/**
 * Input rules shared by the browser (for immediate feedback) and the API
 * routes (for enforcement).
 */
import { z } from "zod";
import { MAX_FLIGHT_SIZE, MAX_PUTTS, MAX_STROKES, MIN_STROKES } from "./golf/scoring";
import { LOCALES } from "./i18n/core";
import { LEADERBOARD_CATEGORIES, PERIODS } from "./types";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const PIN_PATTERN = /^\d{4,12}$/;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const MIN_PASSWORD_LENGTH = 12;

/** `Sanne de Vries` + `FW-K7M2QX` → `sannedevries-m2qx` */
export function usernameFromName(displayName: string, suffix: string): string {
  const base =
    displayName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 22) || "speler";
  const tail = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-4).padStart(4, "0");
  return `${base}-${tail}`;
}

/** A username suggestion while typing a name: `Sanne de Vries` → `sanne.devries`. */
export function suggestUsername(displayName: string): string {
  const parts = displayName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  if (parts.length === 0) return "";
  const [first, ...rest] = parts;
  return (rest.length > 0 ? `${first}.${rest.join("")}` : first).slice(0, 30);
}

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);
const optionalEmail = z
  .union([z.email().max(254), z.literal("")])
  .nullish()
  .transform((value) => value || null);

export const pinSchema = z.string().regex(PIN_PATTERN);
export const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(256);
export const localeSchema = z.enum(LOCALES);
export const holeCountSchema = z.union([z.literal(9), z.literal(18)]);
export const formatSchema = z.enum(["stroke", "stableford", "match"]);

// ----------------------------------------------------------------- auth --

export const playerLoginSchema = z.object({
  identifier: trimmed(3, 64),
  pin: pinSchema,
});

export const adminLoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
});

export const registrationSchema = z.object({
  joinCode: trimmed(4, 32),
  displayName: trimmed(2, 80),
  username: z.string().trim().toLowerCase().regex(USERNAME_PATTERN),
  pin: pinSchema,
  email: optionalEmail,
});

export const profileSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("username"), username: trimmed(3, 30) }),
  z.object({ action: z.literal("pin"), currentPin: pinSchema, newPin: pinSchema }),
  z.object({ action: z.literal("language"), language: localeSchema }),
]);

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
});

// --------------------------------------------------------------- rounds --

export const createRoundSchema = z
  .object({
    clientId: z.uuid(),
    courseId: z.uuid(),
    holeCount: holeCountSchema,
    format: formatSchema.default("stroke"),
    trackPutts: z.boolean().default(false),
    playerIds: z.array(z.uuid()).max(MAX_FLIGHT_SIZE - 1).default([]),
    guests: z.array(trimmed(1, 60)).max(MAX_FLIGHT_SIZE - 1).default([]),
    eventId: z.uuid().nullish().transform((value) => value ?? null),
  })
  .refine((value) => 1 + value.playerIds.length + value.guests.length <= MAX_FLIGHT_SIZE, {
    path: ["playerIds"],
    message: "FLIGHT_FULL",
  });

export const scoreSchema = z.object({
  participantId: z.uuid(),
  hole: z.number().int().min(1).max(18),
  strokes: z.number().int().min(MIN_STROKES).max(MAX_STROKES).nullable(),
  putts: z.number().int().min(0).max(MAX_PUTTS).nullable().optional(),
});

export const invitationResponseSchema = z.object({ decision: z.enum(["accept", "decline"]) });

export const lobbyActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remove"), participantId: z.uuid() }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("leave") }),
]);

export const reviewSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    reason: optionalText(500),
  })
  .refine((value) => value.decision !== "rejected" || Boolean(value.reason), {
    path: ["reason"],
    message: "REASON_REQUIRED",
  });

export const bulkApproveSchema = z.object({ roundIds: z.array(z.uuid()).min(1).max(200) });

export const leaderboardQuerySchema = z.object({
  period: z.enum(PERIODS).default("month"),
  holes: z.enum(["9", "18"]).default("9"),
  category: z.enum(LEADERBOARD_CATEGORIES).default("best"),
  course: z.uuid().optional(),
});

// ---------------------------------------------------------------- staff --

export const newPlayerSchema = z.object({
  displayName: trimmed(2, 80),
  email: optionalEmail,
});

export const bulkPlayersSchema = z.object({
  names: z.array(trimmed(2, 80)).min(1).max(100),
});

export const playerActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), displayName: trimmed(2, 80), email: optionalEmail }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("reset-pin") }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
]);

export const courseSchema = z
  .object({
    name: trimmed(2, 120),
    description: z.string().trim().max(2000).default(""),
    holeCount: holeCountSchema,
    teeName: trimmed(1, 40).default("Club"),
    accent: z.string().regex(HEX_COLOR_PATTERN).default("#c9f04b"),
    holes: z
      .array(
        z.object({
          par: z.number().int().min(2).max(6),
          distance: z.number().int().min(1).max(999),
          name: optionalText(60),
          tip: optionalText(400),
        }),
      )
      .min(9)
      .max(18),
  })
  .refine((value) => value.holes.length === value.holeCount, { path: ["holes"], message: "HOLES_MISMATCH" });

export const eventSchema = z
  .object({
    title: trimmed(2, 120),
    description: z.string().trim().max(4000).default(""),
    kind: z.enum(["tournament", "clinic", "social"]).default("tournament"),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().nullish().transform((value) => value ?? null),
    registrationClosesAt: z.iso.datetime().nullish().transform((value) => value ?? null),
    location: optionalText(120),
    courseId: z.uuid().nullish().transform((value) => value ?? null),
    capacity: z.number().int().min(1).max(5000).nullish().transform((value) => value ?? null),
    leaderboardEnabled: z.boolean().default(false),
    published: z.boolean().default(false),
  })
  .refine((value) => !value.endsAt || value.endsAt >= value.startsAt, { path: ["endsAt"], message: "ENDS_BEFORE_START" });

export const newsSchema = z.object({
  kind: z.enum(["news", "announcement", "rules"]).default("news"),
  title: trimmed(2, 140),
  body: trimmed(1, 8000),
  pinned: z.boolean().default(false),
  published: z.boolean().default(true),
  expiresAt: z.iso.datetime().nullish().transform((value) => value ?? null),
});

export const clubSettingsSchema = z.object({
  name: trimmed(2, 100),
  tagline: optionalText(140),
  primaryColor: z.string().regex(HEX_COLOR_PATTERN),
  accentColor: z.string().regex(HEX_COLOR_PATTERN),
  contactEmail: optionalEmail,
  phone: optionalText(40),
  address: optionalText(200),
  website: optionalText(200),
  openingHours: optionalText(600),
  defaultLanguage: localeSchema,
  selfRegistration: z.enum(["closed", "approval", "open"]),
  autoApproveRounds: z.boolean(),
});

export const settingsActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), settings: clubSettingsSchema }),
  z.object({ action: z.literal("regenerate-join-code") }),
  z.object({ action: z.literal("regenerate-board-token") }),
]);

export const newStaffSchema = z.object({
  displayName: trimmed(2, 80),
  email: z.email().max(254),
  role: z.enum(["club_owner", "club_staff"]).default("club_staff"),
});

export const staffActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("reset-password") }),
  z.object({ action: z.literal("role"), role: z.enum(["club_owner", "club_staff"]) }),
]);

export const newClubSchema = z.object({
  name: trimmed(2, 100),
  ownerName: trimmed(2, 80),
  ownerEmail: z.email().max(254),
});

export const clubStatusSchema = z.object({ status: z.enum(["trial", "active", "suspended"]) });

export type CreateRoundBody = z.infer<typeof createRoundSchema>;
export type CourseBody = z.infer<typeof courseSchema>;
export type EventBody = z.infer<typeof eventSchema>;
export type NewsBody = z.infer<typeof newsSchema>;
export type ClubSettingsBody = z.infer<typeof clubSettingsSchema>;
