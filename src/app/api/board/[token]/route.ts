import { notFound } from "@/server/errors";
import { route, tokenParams } from "@/server/http/route";
import { getLocale } from "@/server/i18n";
import { getBoard } from "@/server/services/board";

export const GET = route({ access: "public", params: tokenParams }, async ({ params }) => {
  const board = await getBoard(params.token, await getLocale());
  if (!board) throw notFound("BOARD_NOT_FOUND");
  return { board };
});
