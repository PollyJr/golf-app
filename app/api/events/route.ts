import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { getEvents } from "@/lib/dal";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({ title: z.string().trim().min(2).max(150), description: z.string().max(5000).default(""), startsAt: z.string().datetime(), endsAt: z.string().datetime().optional(), courseId: z.string().uuid().optional(), capacity: z.number().int().positive().max(10000).optional(), published: z.boolean().default(false) });
export async function GET() {
  try { const session = await requireApiSession(["player", "club_owner", "club_staff"]); return NextResponse.json({ events: await getEvents(session.clubId!, session.role === "player" ? session.accountId : undefined) }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const session = await requireApiSession(["club_owner", "club_staff"]); await verifyMutation(request, session); const body = schema.parse(await request.json());
    if (body.courseId) { const course = await query("SELECT 1 FROM courses WHERE id = $1 AND club_id = $2", [body.courseId, session.clubId]); if (!course.rowCount) return NextResponse.json({ code: "COURSE_NOT_FOUND" }, { status: 404 }); }
    const result = await query<{ id: string }>(`INSERT INTO events(club_id, course_id, title, description, starts_at, ends_at, capacity, published) VALUES ($1,$2,jsonb_build_object('nl',$3),jsonb_build_object('nl',$4),$5,$6,$7,$8) RETURNING id`, [session.clubId, body.courseId || null, body.title, body.description, body.startsAt, body.endsAt || null, body.capacity || null, body.published]);
    await query(`INSERT INTO audit_log(club_id, actor_role, actor_id, action, entity_type, entity_id) VALUES ($1,$2,$3,'event.created','event',$4)`, [session.clubId, session.role, session.accountId, result.rows[0].id]);
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
