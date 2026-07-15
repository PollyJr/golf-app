import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { getCourses } from "@/lib/dal";
import { withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(150), description: z.string().max(2000).default(""),
  holeCount: z.union([z.literal(9), z.literal(18)]), teeName: z.string().trim().min(1).max(50).default("Club"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#c6f04d"),
  holes: z.array(z.object({ par: z.number().int().min(2).max(6), distance: z.number().int().positive().max(1000) })).min(9).max(18),
}).refine((value) => value.holes.length === value.holeCount, { message: "Hole layout must match holeCount" });

export async function GET() {
  try { const session = await requireApiSession(["player", "club_owner", "club_staff"]); return NextResponse.json({ courses: await getCourses(session.clubId!) }); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(["club_owner", "club_staff"]); await verifyMutation(request, session); const body = schema.parse(await request.json());
    const id = await withTransaction(async (client) => {
      const course = await client.query<{ id: string }>(`INSERT INTO courses(club_id,name,description,hole_count,accent_color) VALUES ($1,jsonb_build_object('nl',$2),jsonb_build_object('nl',$3),$4,$5) RETURNING id`, [session.clubId, body.name, body.description, body.holeCount, body.accentColor]);
      const tee = await client.query<{ id: string }>(`INSERT INTO tee_sets(club_id,course_id,name,color,is_default) VALUES ($1,$2,jsonb_build_object('nl',$3),'green',true) RETURNING id`, [session.clubId, course.rows[0].id, body.teeName]);
      for (const [index, hole] of body.holes.entries()) await client.query(`INSERT INTO holes(club_id,course_id,tee_set_id,number,par,distance_m) VALUES ($1,$2,$3,$4,$5,$6)`, [session.clubId, course.rows[0].id, tee.rows[0].id, index + 1, hole.par, hole.distance]);
      await client.query(`INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id) VALUES ($1,$2,$3,'course.created','course',$4)`, [session.clubId,session.role,session.accountId,course.rows[0].id]);
      return course.rows[0].id;
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
