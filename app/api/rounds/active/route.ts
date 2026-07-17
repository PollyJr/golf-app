import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { revisionEtag } from "@/lib/rounds-core";
import { getActiveRounds } from "@/lib/rounds";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(["player"]);
    const rounds = await getActiveRounds(session.clubId!, session.accountId);
    const revision = rounds.reduce((total, round) => total + round.revision, 0) + rounds.length;
    const etag = revisionEtag(revision);
    if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-store" } });
    return NextResponse.json({ rounds }, { headers: { ETag: etag, "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
