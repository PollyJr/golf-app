import { NextResponse } from "next/server";
import { destroySession, getSession, verifyMutation } from "@/lib/auth";
import { apiError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (session) await verifyMutation(request, session);
    const response = NextResponse.json({ ok: true });
    await destroySession(response);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
