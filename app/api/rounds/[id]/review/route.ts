import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({ decision: z.enum(["approved", "rejected"]), reason: z.string().trim().max(500).optional() }).refine((value) => value.decision !== "rejected" || Boolean(value.reason), { message: "A rejection reason is required" });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["club_owner", "club_staff"]); await verifyMutation(request, session); const body = schema.parse(await request.json()); const { id } = await params; z.string().uuid().parse(id);
    const updated = await withTransaction(async (client) => { const round = await client.query(`UPDATE rounds SET status=$1, reviewed_at=now(), reviewed_by=$2, rejection_reason=$3 WHERE id=$4 AND club_id=$5 AND status='pending' RETURNING id`, [body.decision, session.accountId, body.reason || null, id, session.clubId]); if (!round.rowCount) return false; await client.query(`INSERT INTO round_reviews(round_id,club_id,reviewer_id,decision,reason) VALUES ($1,$2,$3,$4,$5)`, [id,session.clubId,session.accountId,body.decision,body.reason || null]); await client.query(`INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id) VALUES ($1,$2,$3,$4,'round',$5)`, [session.clubId,session.role,session.accountId,`round.${body.decision}`,id]); return true; });
    if (!updated) return NextResponse.json({ code: "ROUND_NOT_FOUND" }, { status: 404 }); return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
