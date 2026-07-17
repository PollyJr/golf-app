import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { etagMatches, revisionEtag } from "@/lib/rounds-core";
import { getPublicRound } from "@/lib/rounds";
import { sha256 } from "@/lib/security";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params; z.string().min(32).max(200).regex(/^[A-Za-z0-9_-]+$/).parse(token);
    const round = await getPublicRound(sha256(token));
    if (!round) return NextResponse.json({ code: "LINK_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "public, no-store" } });
    const etag = revisionEtag(round.revision);
    if (etagMatches(request.headers.get("if-none-match"), round.revision)) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "public, no-store" } });
    return NextResponse.json({ round }, { headers: { ETag: etag, "Cache-Control": "public, no-store" } });
  } catch (error) { return apiError(error); }
}
