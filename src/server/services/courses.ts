import "server-only";

import type { ClubSession } from "../auth/session";
import { audit } from "../audit";
import { db, many, maybeOne, one, transaction, type Db } from "../db";
import { conflict, notFound } from "../errors";
import { publish, topics } from "../realtime/hub";
import type { HoleCount, HoleInfo } from "@/lib/golf/scoring";
import { pickText, type Locale, type LocalizedText } from "@/lib/i18n/core";
import type { CourseDto } from "@/lib/types";
import type { CourseBody } from "@/lib/validation";

interface CourseRow {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  hole_count: HoleCount;
  accent_color: string;
  active: boolean;
  tee_name: LocalizedText;
  holes: Array<{ number: number; par: number; distance: number; name: LocalizedText; tip: LocalizedText }> | null;
}

const COURSE_SELECT = `
  SELECT c.id, c.name, c.description, c.hole_count, c.accent_color, c.active, t.name AS tee_name,
         (SELECT json_agg(json_build_object('number', h.number, 'par', h.par, 'distance', h.distance_m,
                                            'name', h.name, 'tip', h.description) ORDER BY h.number)
            FROM holes h WHERE h.tee_set_id = t.id) AS holes
    FROM courses c
    JOIN tee_sets t ON t.course_id = c.id AND t.is_default`;

function toCourse(row: CourseRow, locale: Locale): CourseDto {
  const holes: HoleInfo[] = (row.holes ?? []).map((hole) => ({
    number: hole.number,
    par: hole.par,
    distance: hole.distance,
    name: pickText(hole.name, locale) || null,
    tip: pickText(hole.tip, locale) || null,
  }));
  return {
    id: row.id,
    name: pickText(row.name, locale),
    description: pickText(row.description, locale),
    holeCount: row.hole_count,
    accent: row.accent_color,
    tee: pickText(row.tee_name, locale, "Club"),
    par: holes.reduce((total, hole) => total + hole.par, 0),
    length: holes.reduce((total, hole) => total + hole.distance, 0),
    active: row.active,
    holes,
  };
}

export async function listCourses(clubId: string, locale: Locale, options: { includeArchived?: boolean } = {}): Promise<CourseDto[]> {
  const rows = await many<CourseRow>(
    `${COURSE_SELECT}
      WHERE c.club_id = $1 AND (c.active OR $2)
      ORDER BY c.active DESC, c.created_at`,
    [clubId, options.includeArchived ?? false],
  );
  return rows.map((row) => toCourse(row, locale));
}

export async function getCourse(clubId: string, courseId: string, locale: Locale, on: Db = db): Promise<CourseDto | null> {
  const row = await maybeOne<CourseRow>(`${COURSE_SELECT} WHERE c.club_id = $1 AND c.id = $2`, [clubId, courseId], on);
  return row ? toCourse(row, locale) : null;
}

/**
 * Creates a course, or replaces the layout of an existing one.
 *
 * Staff edit texts in the club's language only, so a save replaces the stored
 * text outright; other languages fall back to it instead of keeping a stale
 * translation of the old name.
 */
export async function saveCourse(session: ClubSession, courseId: string | null, input: CourseBody): Promise<string> {
  const language = session.club.defaultLanguage;
  const clubId = session.clubId;

  return transaction(async (tx) => {
    let id = courseId;
    let teeId: string;

    if (id) {
      const existing = await maybeOne<{ hole_count: number; tee_id: string }>(
        `SELECT c.hole_count, t.id AS tee_id
           FROM courses c JOIN tee_sets t ON t.course_id = c.id AND t.is_default
          WHERE c.id = $1 AND c.club_id = $2 FOR UPDATE OF c`,
        [id, clubId],
        tx,
      );
      if (!existing) throw notFound("COURSE_NOT_FOUND");
      if (existing.hole_count !== input.holeCount) {
        const used = await maybeOne("SELECT 1 FROM rounds WHERE course_id = $1 LIMIT 1", [id], tx);
        if (used) throw conflict("COURSE_HAS_ROUNDS");
      }
      teeId = existing.tee_id;
      await tx.query(
        `UPDATE courses
            SET name = jsonb_build_object($3::text, $4::text),
                description = jsonb_build_object($3::text, $5::text),
                hole_count = $6, accent_color = $7, updated_at = now()
          WHERE id = $1 AND club_id = $2`,
        [id, clubId, language, input.name, input.description, input.holeCount, input.accent],
      );
      await tx.query("UPDATE tee_sets SET name = jsonb_build_object($2::text, $3::text) WHERE id = $1", [
        teeId,
        language,
        input.teeName,
      ]);
      await tx.query("DELETE FROM holes WHERE tee_set_id = $1 AND number > $2", [teeId, input.holeCount]);
    } else {
      const course = await one<{ id: string }>(
        `INSERT INTO courses (club_id, name, description, hole_count, accent_color)
         VALUES ($1, jsonb_build_object($2::text, $3::text), jsonb_build_object($2::text, $4::text), $5, $6)
         RETURNING id`,
        [clubId, language, input.name, input.description, input.holeCount, input.accent],
        tx,
      );
      id = course.id;
      const tee = await one<{ id: string }>(
        `INSERT INTO tee_sets (club_id, course_id, name, color, is_default)
         VALUES ($1, $2, jsonb_build_object($3::text, $4::text), 'green', true)
         RETURNING id`,
        [clubId, id, language, input.teeName],
        tx,
      );
      teeId = tee.id;
    }

    for (const [index, hole] of input.holes.entries()) {
      await tx.query(
        `INSERT INTO holes (club_id, course_id, tee_set_id, number, par, distance_m, name, description)
         VALUES ($1, $2, $3, $4, $5, $6,
                 CASE WHEN $8::text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object($7::text, $8::text) END,
                 CASE WHEN $9::text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object($7::text, $9::text) END)
         ON CONFLICT (tee_set_id, number) DO UPDATE
           SET par = EXCLUDED.par, distance_m = EXCLUDED.distance_m,
               name = EXCLUDED.name, description = EXCLUDED.description`,
        [clubId, id, teeId, index + 1, hole.par, hole.distance, language, hole.name, hole.tip],
      );
    }

    await audit(
      { clubId, actor: session, action: courseId ? "course.updated" : "course.created", entityType: "course", entityId: id },
      tx,
    );
    await publish(tx, [topics.club(clubId)], "courses");
    return id;
  });
}

/** Archived courses keep their history but can no longer be played. */
export async function setCourseActive(session: ClubSession, courseId: string, active: boolean): Promise<void> {
  const updated = await db.query("UPDATE courses SET active = $3, updated_at = now() WHERE id = $1 AND club_id = $2", [
    courseId,
    session.clubId,
    active,
  ]);
  if (updated.rowCount === 0) throw notFound("COURSE_NOT_FOUND");
  await audit({ clubId: session.clubId, actor: session, action: active ? "course.restored" : "course.archived", entityType: "course", entityId: courseId });
}

/** Removes a course that has never been played; otherwise it must be archived. */
export async function deleteCourse(session: ClubSession, courseId: string): Promise<void> {
  await transaction(async (tx) => {
    const course = await maybeOne("SELECT 1 FROM courses WHERE id = $1 AND club_id = $2 FOR UPDATE", [courseId, session.clubId], tx);
    if (!course) throw notFound("COURSE_NOT_FOUND");
    const used = await maybeOne("SELECT 1 FROM rounds WHERE course_id = $1 LIMIT 1", [courseId], tx);
    if (used) throw conflict("COURSE_HAS_ROUNDS");
    await tx.query("UPDATE events SET course_id = NULL WHERE course_id = $1 AND club_id = $2", [courseId, session.clubId]);
    await tx.query("DELETE FROM courses WHERE id = $1 AND club_id = $2", [courseId, session.clubId]);
    await audit({ clubId: session.clubId, actor: session, action: "course.deleted", entityType: "course", entityId: courseId }, tx);
  });
}
