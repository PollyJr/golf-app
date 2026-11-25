import "server-only";

import type { ClubSession } from "../auth/session";
import { audit } from "../audit";
import { db, many, maybeOne, one, transaction } from "../db";
import { notFound } from "../errors";
import { publish, topics } from "../realtime/hub";
import { notifyClub } from "./notifications";
import { pickText, type Locale, type LocalizedText } from "@/lib/i18n/core";
import type { ContentKind, NewsItem } from "@/lib/types";
import type { NewsBody } from "@/lib/validation";

interface NewsRow {
  id: string;
  kind: ContentKind;
  title: LocalizedText;
  body: LocalizedText;
  pinned: boolean;
  published_at: Date | null;
  expires_at: Date | null;
  author_name: string | null;
  created_at: Date;
}

const NEWS_SELECT = `
  SELECT n.id, n.kind, n.title, n.body, n.pinned, n.published_at, n.expires_at, n.created_at,
         a.display_name AS author_name
    FROM content_items n
    LEFT JOIN admin_accounts a ON a.id = n.author_id`;

function toNews(row: NewsRow, locale: Locale): NewsItem {
  return {
    id: row.id,
    kind: row.kind,
    title: pickText(row.title, locale),
    body: pickText(row.body, locale),
    pinned: row.pinned,
    publishedAt: row.published_at?.toISOString() ?? null,
    expiresAt: row.expires_at?.toISOString() ?? null,
    authorName: row.author_name,
    createdAt: row.created_at.toISOString(),
  };
}

/** What members see: published and not expired, pinned items first. */
export async function listNews(
  clubId: string,
  locale: Locale,
  options: { kinds?: readonly ContentKind[]; limit?: number } = {},
): Promise<NewsItem[]> {
  const rows = await many<NewsRow>(
    `${NEWS_SELECT}
      WHERE n.club_id = $1 AND n.kind = ANY($2::content_kind[])
        AND n.published_at IS NOT NULL AND n.published_at <= now()
        AND (n.expires_at IS NULL OR n.expires_at > now())
      ORDER BY n.pinned DESC, n.published_at DESC
      LIMIT $3`,
    [clubId, options.kinds ?? ["news", "announcement"], options.limit ?? 30],
  );
  return rows.map((row) => toNews(row, locale));
}

export async function getNewsItem(clubId: string, id: string, locale: Locale, includeDrafts = false): Promise<NewsItem | null> {
  const row = await maybeOne<NewsRow>(
    `${NEWS_SELECT}
      WHERE n.club_id = $1 AND n.id = $2
        AND ($3 OR (n.published_at IS NOT NULL AND n.published_at <= now()
                    AND (n.expires_at IS NULL OR n.expires_at > now())))`,
    [clubId, id, includeDrafts],
  );
  return row ? toNews(row, locale) : null;
}

export async function listNewsForStaff(clubId: string, locale: Locale): Promise<NewsItem[]> {
  const rows = await many<NewsRow>(
    `${NEWS_SELECT} WHERE n.club_id = $1 ORDER BY n.pinned DESC, COALESCE(n.published_at, n.created_at) DESC LIMIT 200`,
    [clubId],
  );
  return rows.map((row) => toNews(row, locale));
}

export async function saveNewsItem(session: ClubSession, id: string | null, input: NewsBody): Promise<string> {
  const language = session.club.defaultLanguage;
  const clubId = session.clubId;

  return transaction(async (tx) => {
    let itemId = id;
    let announce = false;
    if (itemId) {
      const existing = await maybeOne<{ published_at: Date | null }>(
        "SELECT published_at FROM content_items WHERE id = $1 AND club_id = $2 FOR UPDATE",
        [itemId, clubId],
        tx,
      );
      if (!existing) throw notFound("NEWS_NOT_FOUND");
      announce = existing.published_at === null && input.published;
      await tx.query(
        `UPDATE content_items
            SET kind = $3,
                title = jsonb_build_object($4::text, $5::text),
                body = jsonb_build_object($4::text, $6::text),
                pinned = $7, expires_at = $8,
                published_at = CASE WHEN $9 THEN COALESCE(published_at, now()) ELSE NULL END,
                updated_at = now()
          WHERE id = $1 AND club_id = $2`,
        [itemId, clubId, input.kind, language, input.title, input.body, input.pinned, input.expiresAt, input.published],
      );
    } else {
      const created = await one<{ id: string }>(
        `INSERT INTO content_items (club_id, kind, title, body, pinned, expires_at, published_at, author_id)
         VALUES ($1, $2, jsonb_build_object($3::text, $4::text), jsonb_build_object($3::text, $5::text),
                 $6, $7, CASE WHEN $8 THEN now() END, $9)
         RETURNING id`,
        [clubId, input.kind, language, input.title, input.body, input.pinned, input.expiresAt, input.published, session.accountId],
        tx,
      );
      itemId = created.id;
      announce = input.published;
    }

    // House rules are reference material, not news: no notification.
    if (announce && input.kind !== "rules") {
      await notifyClub(tx, clubId, "news_published", { newsId: itemId, title: input.title });
    }
    await audit({ clubId, actor: session, action: id ? "news.updated" : "news.created", entityType: "news", entityId: itemId }, tx);
    await publish(tx, [topics.club(clubId)], "news");
    return itemId;
  });
}

export async function deleteNewsItem(session: ClubSession, id: string): Promise<void> {
  const deleted = await db.query("DELETE FROM content_items WHERE id = $1 AND club_id = $2", [id, session.clubId]);
  if (deleted.rowCount === 0) throw notFound("NEWS_NOT_FOUND");
  await audit({ clubId: session.clubId, actor: session, action: "news.deleted", entityType: "news", entityId: id });
  await publish(db, [topics.club(session.clubId)], "news");
}
