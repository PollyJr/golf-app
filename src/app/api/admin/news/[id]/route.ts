import { idParams, route } from "@/server/http/route";
import { deleteNewsItem, saveNewsItem } from "@/server/services/news";
import { newsSchema } from "@/lib/validation";

export const PUT = route({ access: "staff", params: idParams, body: newsSchema }, async ({ session, params, body }) => ({
  id: await saveNewsItem(session, params.id, body),
}));

export const DELETE = route({ access: "staff", params: idParams }, async ({ session, params }) => {
  await deleteNewsItem(session, params.id);
  return { ok: true };
});
