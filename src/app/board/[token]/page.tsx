import type { Metadata } from "next";
import { headers } from "next/headers";
import { BoardUnavailable } from "@/components/board/board-unavailable";
import { ClubBoard } from "@/components/board/club-board";
import { getT } from "@/server/i18n";
import { getBoard } from "@/server/services/board";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("board.title") };
}

/** The clubhouse screen: public, read-only, reachable only through its token. */
export default async function BoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { locale } = await getT();
  const board = TOKEN_PATTERN.test(token) ? await getBoard(token, locale) : null;
  if (!board) return <BoardUnavailable />;

  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").split(",")[0].trim();
  return <ClubBoard token={token} initial={board} host={host} />;
}
