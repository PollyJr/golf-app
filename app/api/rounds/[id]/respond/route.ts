import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({ decision: z.enum(["accept", "decline"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]); await verifyMutation(request, session);
    const body = schema.parse(await request.json()); const { id } = await params; z.string().uuid().parse(id);
    const outcome = await withTransaction(async (client) => {
      const round = await client.query(`SELECT id FROM rounds WHERE id=$1 AND club_id=$2 AND status='inviting' FOR UPDATE`, [id, session.clubId]);
      if (!round.rowCount) return "ROUND_NOT_FOUND";
      const invitation = await client.query<{ id: string }>(
        `SELECT id FROM round_participants WHERE round_id=$1 AND club_id=$2 AND player_id=$3 AND invitation_status='pending' FOR UPDATE`,
        [id, session.clubId, session.accountId],
      );
      if (!invitation.rowCount) return "INVITATION_NOT_FOUND";
      if (body.decision === "accept") {
        await client.query(`UPDATE round_participants SET invitation_status='accepted',responded_at=now(),updated_at=now() WHERE id=$1 AND club_id=$2`, [invitation.rows[0].id, session.clubId]);
      } else {
        await client.query(`DELETE FROM round_participants WHERE id=$1 AND club_id=$2`, [invitation.rows[0].id, session.clubId]);
      }
      const pending = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM round_participants WHERE round_id=$1 AND club_id=$2 AND invitation_status='pending'`, [id, session.clubId]);
      const activated = pending.rows[0].count === 0;
      await client.query(`UPDATE rounds SET status=CASE WHEN $3 THEN 'active'::round_status ELSE status END,revision=revision+1 WHERE id=$1 AND club_id=$2`, [id, session.clubId, activated]);
      await client.query(
        `INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id)
         VALUES ($1,'player',$2,$3,'round',$4)`,
        [session.clubId, session.accountId, body.decision === "accept" ? "round.invitation_accepted" : "round.invitation_declined", id],
      );
      return activated ? "ACTIVE" : "WAITING";
    });
    if (outcome === "ROUND_NOT_FOUND") return NextResponse.json({ code: outcome }, { status: 404 });
    if (outcome === "INVITATION_NOT_FOUND") return NextResponse.json({ code: outcome }, { status: 409 });
    return NextResponse.json({ status: outcome === "ACTIVE" ? "active" : "inviting" });
  } catch (error) { return apiError(error); }
}
