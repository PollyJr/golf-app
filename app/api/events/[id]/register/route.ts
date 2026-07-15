import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]);
    await verifyMutation(request, session);
    const { id } = await params;
    z.string().uuid().parse(id);
    const registered = await withTransaction(async (client) => {
      const event = await client.query<{ capacity: number | null }>(
        `SELECT capacity FROM events WHERE id=$1 AND club_id=$2 AND published AND starts_at>now()
          AND (registration_closes_at IS NULL OR registration_closes_at>now()) FOR UPDATE`, [id, session.clubId],
      );
      if (!event.rowCount) return null;
      const count = await client.query<{ registered: number }>(
        `SELECT count(*)::int AS registered FROM event_registrations WHERE event_id=$1 AND club_id=$2 AND status='registered'`, [id, session.clubId],
      );
      if (event.rows[0].capacity && count.rows[0].registered >= event.rows[0].capacity) return false;
      await client.query(
        `INSERT INTO event_registrations(event_id,club_id,player_id,status) VALUES ($1,$2,$3,'registered')
         ON CONFLICT (event_id,player_id) DO UPDATE SET status='registered'`, [id, session.clubId, session.accountId],
      );
      return true;
    });
    if (registered === null) return NextResponse.json({ code: "EVENT_NOT_FOUND" }, { status: 404 });
    if (!registered) return NextResponse.json({ code: "EVENT_FULL" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
