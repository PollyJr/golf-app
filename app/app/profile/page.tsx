import { Award, Clock3, Trophy } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function ProfilePage() {
  const session = await requireSession(["player"]);
  const stats = await query<{ rounds: number; best: number | null }>(`SELECT count(*)::int AS rounds, min(rp.total_strokes-rp.total_par)::int AS best FROM round_participants rp JOIN rounds r ON r.id=rp.round_id AND r.club_id=$2 WHERE rp.player_id=$1 AND rp.club_id=$2 AND r.status='approved'`, [session.accountId,session.clubId]);
  const row=stats.rows[0] || {rounds:0,best:null};
  return <div className="page"><div className="profile-hero"><span className="avatar profile-avatar">{session.initials}</span><div><div className="eyebrow light"><span/> beveiligd spelersaccount</div><h1>{session.displayName}</h1><p>{session.clubName} · {session.code}</p></div></div><div className="profile-stats"><div className="card"><Trophy/><span><strong>{row.best === null ? "—" : row.best > 0 ? `+${row.best}` : row.best}</strong><small>Beste ronde</small></span></div><div className="card"><Award/><span><strong>{session.initials}</strong><small>Speler</small></span></div><div className="card"><Clock3/><span><strong>{row.rounds}</strong><small>Goedgekeurde rondes</small></span></div></div></div>;
}
