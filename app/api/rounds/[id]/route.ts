import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { etagMatches, revisionEtag } from "@/lib/rounds-core";
import { getRoundForPlayer } from "@/lib/rounds";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]);
    const { id } = await params; z.string().uuid().parse(id);
    const round = await getRoundForPlayer(id, session.clubId!, session.accountId);
    if (!round) return NextResponse.json({ code: "ROUND_NOT_FOUND" }, { status: 404 });
    const etag = revisionEtag(round.revision);
    if (etagMatches(request.headers.get("if-none-match"), round.revision)) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-store" } });
    return NextResponse.json({ round }, { headers: { ETag: etag, "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
