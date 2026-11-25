import { NextResponse } from "next/server";
import { route } from "@/server/http/route";
import { saveNewsItem } from "@/server/services/news";
import { newsSchema } from "@/lib/validation";

export const POST = route({ access: "staff", body: newsSchema }, async ({ session, body }) =>
  NextResponse.json({ id: await saveNewsItem(session, null, body) }, { status: 201 }),
);
