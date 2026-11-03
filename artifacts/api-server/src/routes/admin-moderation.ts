import { Router, type IRouter, type Request, type Response } from "express";
import {
  pool,
  type ModerationSnapshot,
} from "@workspace/db";
import {
  CreateAdminModerationActionBody,
  GetAdminModerationQueueQueryParams,
  GetAdminModerationRecordsQueryParams,
  GetAdminModerationReportsQueryParams,
  UpdateAdminModerationReportStatusBody,
} from "@workspace/api-zod";
import { getUserId, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

type TargetType =
  | "story"
  | "image"
  | "video"
  | "outfit"
  | "sticker"
  | "comment"
  | "message"
  | "campfire_message"
  | "manga_generation"
  | "user";

type ContentSnapshot = {
  row: Record<string, unknown>;
  contentType: string;
  title: string;
  preview: string;
  targetUserId: string | null;
  userName: string | null;
  username: string | null;
};

type DbClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  release(): void;
};

const targetJoins = `
  LEFT JOIN stories s
    ON b.target_type IN ('story', 'video', 'image') AND s.id::text = b.target_id
  LEFT JOIN outfits o
    ON b.target_type = 'outfit' AND o.id::text = b.target_id
  LEFT JOIN book_comments bc
    ON b.target_type = 'comment' AND bc.id::text = b.target_id
  LEFT JOIN content_comments cc
    ON b.target_type = 'comment' AND cc.id::text = b.target_id
  LEFT JOIN chapters ch ON ch.id = bc.chapter_id
  LEFT JOIN books bk ON bk.id = ch.book_id
  LEFT JOIN messages dm
    ON b.target_type = 'message' AND dm.id::text = b.target_id
  LEFT JOIN campfire_messages cm
    ON b.target_type = 'campfire_message' AND cm.id::text = b.target_id
  LEFT JOIN campfire_rooms cr ON cr.id = cm.room_id
  LEFT JOIN sticker_reactions sr
    ON b.target_type = 'sticker' AND sr.id::text = b.target_id
  LEFT JOIN manga_generations mg
    ON b.target_type = 'manga_generation' AND mg.id::text = b.target_id
  LEFT JOIN uploaded_images ui
    ON b.target_type = 'image' AND ui.path = b.target_id
  LEFT JOIN "character" target_user ON target_user.user_id = CASE
    WHEN b.target_type = 'user' THEN b.target_id
    WHEN b.target_type IN ('story', 'video', 'image') THEN COALESCE(s.user_id, ui.user_id)
    WHEN b.target_type = 'outfit' THEN o.user_id
    WHEN b.target_type = 'comment' THEN COALESCE(cc.user_id, bc.user_id)
    WHEN b.target_type = 'message' THEN dm.from_user_id
    WHEN b.target_type = 'campfire_message' THEN cm.user_id
    WHEN b.target_type = 'sticker' THEN sr.from_user_id
    WHEN b.target_type = 'manga_generation' THEN mg.user_id
    ELSE NULL
  END
`;

const targetFields = `
  CASE
    WHEN b.target_type IN ('story', 'video', 'image') AND s.content_type = 'video' THEN 'Video'
    WHEN b.target_type = 'video' THEN 'Video'
    WHEN b.target_type = 'image' OR b.target_type = 'manga_generation' THEN 'Image'
    WHEN b.target_type = 'outfit' THEN 'Outfit'
    WHEN b.target_type = 'sticker' THEN 'Sticker'
    WHEN b.target_type = 'comment' THEN 'Comment'
    WHEN b.target_type IN ('message', 'campfire_message') THEN 'Chat/Message'
    WHEN b.target_type = 'user' THEN 'User'
    ELSE 'Story'
  END AS content_type,
  COALESCE(
    NULLIF(s.chapter_title, ''),
    NULLIF(o.name, ''),
    NULLIF(cr.name, ''),
    NULLIF(bk.title, ''),
    CASE WHEN b.target_type = 'comment' THEN 'Comment' END,
    CASE WHEN b.target_type = 'message' THEN 'Direct message' END,
    CASE WHEN b.target_type = 'campfire_message' THEN 'Campfire message' END,
    CASE WHEN b.target_type = 'sticker' THEN 'Sticker reaction' END,
    CASE WHEN b.target_type = 'manga_generation' THEN 'Generated image' END,
    NULLIF(target_user.name, ''),
    'Reported content'
  ) AS title,
  COALESCE(
    NULLIF(s.description, ''),
    NULLIF(s.panels->0->>'text', ''),
    NULLIF(s.pages->0->'panels'->0->>'text', ''),
    CASE WHEN s.content_type = 'video' THEN 'Video attachment' END,
    NULLIF(o.description, ''),
    NULLIF(o.story, ''),
    NULLIF(cc.content, ''),
    NULLIF(bc.content, ''),
    NULLIF(dm.content, ''),
    NULLIF(cm.content, ''),
    CASE WHEN sr.id IS NOT NULL THEN 'Sticker: ' || sr.sticker_type END,
    NULLIF(mg.prompt, ''),
    NULLIF(target_user.bio, ''),
    CASE WHEN ui.path IS NOT NULL THEN 'Uploaded image attachment' END,
    'Content preview is unavailable.'
  ) AS preview,
  target_user.user_id AS target_user_id,
  target_user.name AS user_name,
  target_user.username AS username
`;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? new Date(0).toISOString() : parsed.toISOString();
}

function snapshotFromContent(content: ContentSnapshot): ModerationSnapshot {
  return {
    row: content.row,
    contentType: content.contentType,
    title: content.title,
    preview: content.preview,
    userName: content.userName,
    username: content.username,
  };
}

async function findContent(
  client: DbClient,
  targetType: TargetType,
  targetId: string,
): Promise<ContentSnapshot | null> {
  let query: string;
  switch (targetType) {
    case "story":
    case "video":
    case "image":
      query = `
        SELECT to_jsonb(s) AS row,
          CASE WHEN s.content_type = 'video' THEN 'Video' ELSE 'Story' END AS content_type,
          s.chapter_title AS title,
          COALESCE(NULLIF(s.description, ''), NULLIF(s.panels->0->>'text', ''),
            NULLIF(s.pages->0->'panels'->0->>'text', ''),
            CASE WHEN s.content_type = 'video' THEN 'Video attachment' ELSE 'Story content' END) AS preview,
          s.user_id AS target_user_id, c.name AS user_name, c.username
        FROM stories s LEFT JOIN "character" c ON c.user_id = s.user_id
        WHERE s.id::text = $1 LIMIT 1
      `;
      break;
    case "outfit":
      query = `
        SELECT to_jsonb(o) AS row, 'Outfit' AS content_type, o.name AS title,
          COALESCE(NULLIF(o.description, ''), NULLIF(o.story, ''), 'Outfit image') AS preview,
          o.user_id AS target_user_id, c.name AS user_name, c.username
        FROM outfits o LEFT JOIN "character" c ON c.user_id = o.user_id
        WHERE o.id::text = $1 LIMIT 1
      `;
      break;
    case "comment":
      query = `
        SELECT to_jsonb(cc) AS row, 'Comment' AS content_type, 'Comment' AS title,
          cc.content AS preview, cc.user_id AS target_user_id, c.name AS user_name, c.username
        FROM content_comments cc
        LEFT JOIN "character" c ON c.user_id = cc.user_id
        WHERE cc.id::text = $1
        UNION ALL
        SELECT to_jsonb(bc) AS row, 'Comment' AS content_type,
          COALESCE(NULLIF(b.title, ''), 'Book comment') AS title,
          bc.content AS preview, bc.user_id AS target_user_id, c.name AS user_name, c.username
        FROM book_comments bc
        LEFT JOIN chapters ch ON ch.id = bc.chapter_id
        LEFT JOIN books b ON b.id = ch.book_id
        LEFT JOIN "character" c ON c.user_id = bc.user_id
        WHERE bc.id::text = $1
        LIMIT 1
      `;
      break;
    case "message":
      query = `
        SELECT to_jsonb(m) AS row, 'Chat/Message' AS content_type, 'Direct message' AS title,
          COALESCE(m.content, 'Message content is unavailable.') AS preview,
          m.from_user_id AS target_user_id, c.name AS user_name, c.username
        FROM messages m LEFT JOIN "character" c ON c.user_id = m.from_user_id
        WHERE m.id::text = $1 LIMIT 1
      `;
      break;
    case "campfire_message":
      query = `
        SELECT to_jsonb(m) AS row, 'Chat/Message' AS content_type,
          COALESCE(r.name, 'Campfire message') AS title,
          COALESCE(m.content, 'Message content is unavailable.') AS preview,
          m.user_id AS target_user_id, c.name AS user_name, c.username
        FROM campfire_messages m
        LEFT JOIN campfire_rooms r ON r.id = m.room_id
        LEFT JOIN "character" c ON c.user_id = m.user_id
        WHERE m.id::text = $1 LIMIT 1
      `;
      break;
    case "sticker":
      query = `
        SELECT to_jsonb(s) AS row, 'Sticker' AS content_type, 'Sticker reaction' AS title,
          'Sticker: ' || s.sticker_type AS preview,
          s.from_user_id AS target_user_id, c.name AS user_name, c.username
        FROM sticker_reactions s LEFT JOIN "character" c ON c.user_id = s.from_user_id
        WHERE s.id::text = $1 LIMIT 1
      `;
      break;
    case "manga_generation":
      query = `
        SELECT to_jsonb(m) AS row, 'Image' AS content_type, 'Generated image' AS title,
          COALESCE(NULLIF(m.prompt, ''), 'Generated image') AS preview,
          m.user_id AS target_user_id, c.name AS user_name, c.username
        FROM manga_generations m LEFT JOIN "character" c ON c.user_id = m.user_id
        WHERE m.id::text = $1 LIMIT 1
      `;
      break;
    case "user":
      query = `
        SELECT jsonb_build_object('user_id', c.user_id, 'name', c.name,
          'username', c.username, 'bio', c.bio) AS row,
          'User' AS content_type, c.name AS title,
          COALESCE(NULLIF(c.bio, ''), 'User profile') AS preview,
          c.user_id AS target_user_id, c.name AS user_name, c.username
        FROM "character" c WHERE c.user_id = $1 LIMIT 1
      `;
      break;
  }

  if (targetType === "image") {
    const storyMatch = await client.query(query, [targetId]);
    if (storyMatch.rows[0]) return normalizeContentRow(storyMatch.rows[0]);
    const image = await client.query(
      `SELECT jsonb_build_object('path', ui.path, 'user_id', ui.user_id,
          'byte_size', ui.byte_size, 'created_at', ui.created_at) AS row,
        'Image' AS content_type, 'Uploaded image' AS title,
        'Uploaded image attachment' AS preview,
        ui.user_id AS target_user_id, c.name AS user_name, c.username
       FROM uploaded_images ui LEFT JOIN "character" c ON c.user_id = ui.user_id
       WHERE ui.path = $1 LIMIT 1`,
      [targetId],
    );
    return image.rows[0] ? normalizeContentRow(image.rows[0]) : null;
  }

  const result = await client.query(query, [targetId]);
  return result.rows[0] ? normalizeContentRow(result.rows[0]) : null;
}

function normalizeContentRow(row: Record<string, unknown>): ContentSnapshot {
  return {
    row: (row.row && typeof row.row === "object" ? row.row : {}) as Record<string, unknown>,
    contentType: asString(row.content_type, "Content"),
    title: asString(row.title, "Reported content"),
    preview: asString(row.preview, "Content preview is unavailable."),
    targetUserId: nullableString(row.target_user_id),
    userName: nullableString(row.user_name),
    username: nullableString(row.username),
  };
}

async function logAction(
  client: DbClient,
  adminId: string,
  action: string,
  targetType: TargetType,
  targetId: string,
  targetUserId: string | null,
  reason: string,
  snapshot: ModerationSnapshot,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO moderation_logs
      (admin_id, action, target_type, target_id, target_user_id, reason, snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id`,
    [adminId, action, targetType, targetId, targetUserId, reason, JSON.stringify(snapshot)],
  );
  return result.rows[0].id;
}

async function resolveActiveReports(
  client: DbClient,
  adminId: string,
  targetType: TargetType,
  targetId: string,
): Promise<void> {
  await client.query(
    `UPDATE reports SET status = 'resolved', resolved_by_id = $3, resolved_at = NOW()
     WHERE target_type = $1 AND target_id = $2 AND status IN ('pending', 'reviewing')`,
    [targetType, targetId, adminId],
  );
}

function contentSnapshotFromRecord(record: Record<string, unknown>): ModerationSnapshot {
  return record as ModerationSnapshot;
}

async function latestActiveHide(
  client: DbClient,
  targetType: TargetType,
  targetId: string,
): Promise<{ id: string; target_user_id: string | null; snapshot: ModerationSnapshot } | null> {
  const result = await client.query<{
    id: string;
    target_user_id: string | null;
    snapshot: ModerationSnapshot;
  }>(
    `SELECT h.id, h.target_user_id, h.snapshot
     FROM moderation_logs h
     WHERE h.target_type = $1 AND h.target_id = $2 AND h.action = 'hide'
       AND NOT EXISTS (
         SELECT 1 FROM moderation_logs later
         WHERE later.target_type = h.target_type AND later.target_id = h.target_id
           AND later.created_at > h.created_at
           AND later.action IN ('restore', 'remove', 'keep', 'ai_override_keep', 'ai_override_remove')
       )
     ORDER BY h.created_at DESC LIMIT 1`,
    [targetType, targetId],
  );
  return result.rows[0] ?? null;
}

async function restoreHiddenContent(
  client: DbClient,
  targetType: TargetType,
  targetId: string,
  snapshot: ModerationSnapshot,
): Promise<void> {
  const row = snapshot.row as Record<string, unknown> | undefined;
  const values = row ?? {};
  const jsonText = (key: string) => nullableString(values[key]);

  if (targetType === "story" || targetType === "video" || targetType === "image") {
    const changed = await client.query(
      `UPDATE stories SET is_hidden = false WHERE id::text = $1 RETURNING id`,
      [targetId],
    );
    if (changed.rowCount) return;
    if (!row?.id || !values.content_type) {
      throw Object.assign(new Error("This hidden image is not attached to a restorable story."), { status: 400 });
    }
    await client.query(
      `INSERT INTO stories (id, user_id, chapter_title, description, mood, location, is_public,
        is_hidden, witnessed_count, saved_count, panels, page_layout_key, pages, witness_milestones,
        resonated_count, like_count, date, created_at, content_type, video_uri, thumbnail_uri, music)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10::jsonb,$11,$12::jsonb,$13::jsonb,
        $14,$15,$16,$17,$18,$19,$20,$21::jsonb)`,
      [
        values.id, values.user_id, values.chapter_title, values.description, values.mood, values.location,
        values.is_public, values.witnessed_count, values.saved_count, JSON.stringify(values.panels ?? []),
        values.page_layout_key, values.pages == null ? null : JSON.stringify(values.pages),
        JSON.stringify(values.witness_milestones ?? []), values.resonated_count, values.like_count,
        values.date, values.created_at, values.content_type, values.video_uri, values.thumbnail_uri,
        values.music == null ? null : JSON.stringify(values.music),
      ],
    );
    return;
  }

  if (targetType === "outfit") {
    const changed = await client.query(
      `UPDATE outfits SET is_hidden = false WHERE id::text = $1 RETURNING id`,
      [targetId],
    );
    if (changed.rowCount) return;
    if (!row?.id) throw Object.assign(new Error("The hidden outfit cannot be restored."), { status: 400 });
    await client.query(
      `INSERT INTO outfits (id, user_id, name, description, story, image_uri, tags, music,
        is_public, is_hidden, date, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,false,$10,$11)`,
      [
        values.id, values.user_id, values.name, values.description, values.story, values.image_uri,
        JSON.stringify(values.tags ?? []), values.music == null ? null : JSON.stringify(values.music),
        values.is_public, values.date, values.created_at,
      ],
    );
    return;
  }

  if (targetType === "message") {
    await client.query(
      `UPDATE messages SET deleted_at = $2, deleted_for = $3 WHERE id::text = $1`,
      [targetId, values.deleted_at ?? null, values.deleted_for ?? null],
    );
    return;
  }

  if (targetType === "campfire_message") {
    const expiresAt = jsonText("expires_at");
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      throw Object.assign(new Error("This Campfire message has expired and cannot be restored."), { status: 400 });
    }
    if (!row?.id) throw Object.assign(new Error("The hidden message cannot be restored."), { status: 400 });
    await client.query(
      `INSERT INTO campfire_messages (id, room_id, user_id, author_name, content, expression, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [values.id, values.room_id, values.user_id, values.author_name, values.content,
        values.expression, values.created_at, values.expires_at],
    );
    return;
  }

  if (targetType === "comment") {
    if (!row?.id) throw Object.assign(new Error("The hidden comment cannot be restored."), { status: 400 });
    const current = await client.query(
      `UPDATE content_comments SET is_hidden = false WHERE id::text = $1 RETURNING id`,
      [targetId],
    );
    if (current.rowCount) return;
    const legacy = await client.query(
      `UPDATE book_comments SET is_hidden = false WHERE id::text = $1 RETURNING id`,
      [targetId],
    );
    if (legacy.rowCount) return;
    if (values.content_type && values.content_id) {
      await client.query(
        `INSERT INTO content_comments
          (id, content_type, content_id, user_id, parent_id, content, kindness_tag,
           creator_reaction, like_count, is_hidden, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [values.id, values.content_type, values.content_id, values.user_id, values.parent_id ?? null,
          values.content, values.kindness_tag ?? null, values.creator_reaction ?? null,
          values.like_count ?? 0, values.created_at, values.updated_at],
      );
      return;
    }
    await client.query(
      `INSERT INTO book_comments (id, chapter_id, user_id, parent_id, content, like_count, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [values.id, values.chapter_id, values.user_id, values.parent_id, values.content,
        values.like_count, values.created_at, values.updated_at],
    );
    return;
  }

  if (targetType === "sticker") {
    if (!row?.id) throw Object.assign(new Error("The hidden sticker cannot be restored."), { status: 400 });
    await client.query(
      `INSERT INTO sticker_reactions (id, from_user_id, to_user_id, story_id, sticker_type, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [values.id, values.from_user_id, values.to_user_id, values.story_id, values.sticker_type, values.created_at],
    );
    return;
  }

  if (targetType === "manga_generation") {
    if (!row?.id) throw Object.assign(new Error("The hidden image cannot be restored."), { status: 400 });
    await client.query(
      `INSERT INTO manga_generations
        (id, request_id, user_id, style, prompt, image_uri, image_count, original_sizes, compressed_sizes,
         model, quality, output_size, status, estimated_cost_micros, error_code, created_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [values.id, values.request_id, values.user_id, values.style, values.prompt, values.image_uri,
        values.image_count, JSON.stringify(values.original_sizes ?? []), JSON.stringify(values.compressed_sizes ?? []),
        values.model, values.quality, values.output_size, values.status, values.estimated_cost_micros,
        values.error_code, values.created_at, values.completed_at],
    );
    return;
  }

  throw Object.assign(new Error("This target type cannot be restored."), { status: 400 });
}

async function applyContentAction(
  client: DbClient,
  action: string,
  targetType: TargetType,
  targetId: string,
  snapshot: ContentSnapshot,
): Promise<void> {
  if (action === "keep" || action === "ai_override_keep") return;
  const isRemove = action === "remove" || action === "ai_override_remove";
  const softOrHardAction = isRemove ? "remove" : "hide";
  const row = snapshot.row;

  if (targetType === "story" || targetType === "video" ||
      (targetType === "image" && typeof row.id === "string" && typeof row.content_type === "string")) {
    if (isRemove) {
      await client.query(`DELETE FROM story_saves WHERE story_id::text = $1`, [targetId]);
      await client.query(`DELETE FROM story_likes WHERE story_id::text = $1`, [targetId]);
      await client.query(`DELETE FROM story_witnesses WHERE story_id::text = $1`, [targetId]);
      await client.query(`DELETE FROM sticker_reactions WHERE story_id::text = $1`, [targetId]);
      await client.query(`DELETE FROM stories WHERE id::text = $1`, [targetId]);
    } else {
      const result = await client.query(
        `UPDATE stories SET is_hidden = true WHERE id::text = $1 RETURNING id`,
        [targetId],
      );
      if (!result.rowCount) throw Object.assign(new Error("This story or video cannot be hidden."), { status: 404 });
    }
    return;
  }
  if (targetType === "outfit") {
    if (isRemove) await client.query(`DELETE FROM outfits WHERE id::text = $1`, [targetId]);
    else await client.query(`UPDATE outfits SET is_hidden = true WHERE id::text = $1`, [targetId]);
    return;
  }
  if (targetType === "message") {
    await client.query(
      `UPDATE messages SET deleted_at = NOW(), deleted_for = 'both' WHERE id::text = $1`,
      [targetId],
    );
    return;
  }
  if (targetType === "campfire_message") {
    await client.query(`DELETE FROM campfire_messages WHERE id::text = $1`, [targetId]);
    return;
  }
  if (targetType === "comment") {
    if (isRemove) {
      await client.query(`DELETE FROM comment_likes WHERE comment_id::text = $1`, [targetId]);
      await client.query(`DELETE FROM content_comment_likes WHERE comment_id::text = $1`, [targetId]);
      await client.query(`DELETE FROM content_comments WHERE id::text = $1`, [targetId]);
      await client.query(`DELETE FROM book_comments WHERE id::text = $1`, [targetId]);
    } else {
      await client.query(`UPDATE content_comments SET is_hidden = true WHERE id::text = $1`, [targetId]);
      await client.query(`UPDATE book_comments SET is_hidden = true WHERE id::text = $1`, [targetId]);
    }
    return;
  }
  if (targetType === "sticker") {
    await client.query(`DELETE FROM sticker_reactions WHERE id::text = $1`, [targetId]);
    return;
  }
  if (targetType === "manga_generation") {
    await client.query(`DELETE FROM manga_generations WHERE id::text = $1`, [targetId]);
    return;
  }
  if (targetType === "image") {
    throw Object.assign(
      new Error("Moderate this image through its parent story or outfit; standalone image removal is not supported."),
      { status: 400 },
    );
  }
  throw Object.assign(new Error(`Cannot ${softOrHardAction} this target type.`), { status: 400 });
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

router.get("/admin/moderation/queue", requireAdmin, async (req: Request, res: Response) => {
  const parsed = GetAdminModerationQueueQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid moderation queue query." });
  const { filter, q, limit, offset } = parsed.data;
  if (filter === "ai_flagged") return res.json({ items: [], total: 0, aiAvailable: false });
  const values: unknown[] = [];
  const where: string[] = [];
  if (filter === "high") where.push("b.report_count >= 3");
  if (filter === "new") where.push("b.last_reported_at >= NOW() - INTERVAL '24 hours'");
  if (q?.trim()) {
    values.push(`%${escapeLike(q.trim())}%`);
    where.push(`(
      b.target_id ILIKE $${values.length} OR b.title ILIKE $${values.length}
      OR b.preview ILIKE $${values.length} OR COALESCE(b.user_name, '') ILIKE $${values.length}
      OR COALESCE(b.username, '') ILIKE $${values.length}
       OR EXISTS (
        SELECT 1 FROM unnest(b.report_reasons) AS reasons(value)
        WHERE reasons.value ILIKE $${values.length}
      )
    )`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const baseCte = `
    WITH grouped AS (
      SELECT target_type, target_id, COUNT(*)::int AS report_count,
        ARRAY_AGG(DISTINCT reason) AS report_reasons,
        BOOL_OR(status = 'reviewing') AS is_reviewing,
        MAX(created_at) AS last_reported_at
      FROM reports
      WHERE status IN ('pending', 'reviewing')
      GROUP BY target_type, target_id
    ),
    b AS (SELECT * FROM grouped)
  `;
  try {
    const countValues = [...values];
    const countQuery = await pool.query<{ total: string }>(
      `${baseCte}
       SELECT COUNT(*)::text AS total
       FROM b
       ${targetJoins}
       ${whereSql}`,
      countValues,
    );
    values.push(limit, offset);
    const result = await pool.query<Record<string, unknown>>(
      `${baseCte}
       SELECT b.target_type, b.target_id, b.report_count, b.report_reasons,
         b.is_reviewing, b.last_reported_at, ${targetFields}
       FROM b
       ${targetJoins}
       ${whereSql}
       ORDER BY (b.report_count >= 3) DESC, b.last_reported_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    const items = result.rows.map((row) => ({
      id: `${asString(row.target_type)}:${asString(row.target_id)}`,
      targetType: asString(row.target_type, "story"),
      targetId: asString(row.target_id),
      contentType: asString(row.content_type, "Content"),
      title: asString(row.title, "Reported content"),
      preview: asString(row.preview, "Content preview is unavailable."),
      targetUserId: nullableString(row.target_user_id),
      userName: nullableString(row.user_name),
      username: nullableString(row.username),
      reportCount: Number(row.report_count ?? 0),
      reportReasons: Array.isArray(row.report_reasons) ? row.report_reasons.map(String) : [],
      priority: Number(row.report_count ?? 0) >= 3 ? "high" : "normal",
      status: row.is_reviewing ? "reviewing" : "open",
      source: "report",
      aiCategory: null,
      aiConfidence: null,
      createdAt: isoDate(row.last_reported_at),
    }));
    return res.json({ items, total: Number(countQuery.rows[0]?.total ?? 0), aiAvailable: false });
  } catch (err) {
    req.log.error({ err }, "Admin moderation queue failed");
    return res.status(500).json({ error: "Could not load the moderation queue." });
  }
});

router.get("/admin/moderation/reports", requireAdmin, async (req: Request, res: Response) => {
  const parsed = GetAdminModerationReportsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid moderation reports query." });
  const { status, q, limit, offset } = parsed.data;
  const values: unknown[] = [];
  const filters: string[] = [];
  if (status !== "all") {
    const dbStatus = status === "open" ? "pending" : status;
    values.push(dbStatus);
    filters.push(`b.status = $${values.length}`);
  }
  if (q?.trim()) {
    values.push(`%${escapeLike(q.trim())}%`);
    filters.push(`(
      b.reason ILIKE $${values.length} OR b.details ILIKE $${values.length}
      OR b.target_id ILIKE $${values.length} OR b.title ILIKE $${values.length}
      OR b.preview ILIKE $${values.length} OR COALESCE(b.user_name, '') ILIKE $${values.length}
      OR COALESCE(b.reporter_name, '') ILIKE $${values.length}
      OR COALESCE(b.reporter_username, '') ILIKE $${values.length}
    )`);
  }
  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  try {
    const countResult = await pool.query<{ total: string }>(
      `WITH report_rows AS (
         SELECT r.*, reporter.name AS reporter_name, reporter.username AS reporter_username
         FROM reports r
         LEFT JOIN "character" reporter ON reporter.user_id = r.reporter_id
       ),
       b AS (SELECT * FROM report_rows)
       SELECT COUNT(*)::text AS total
       FROM b
       ${targetJoins}
       ${whereSql}`,
      values,
    );
    const listValues = [...values, limit, offset];
    const result = await pool.query<Record<string, unknown>>(
      `WITH report_rows AS (
         SELECT r.*, reporter.name AS reporter_name, reporter.username AS reporter_username
         FROM reports r
         LEFT JOIN "character" reporter ON reporter.user_id = r.reporter_id
       ),
       b AS (SELECT * FROM report_rows)
       SELECT b.id, b.reporter_id, b.reporter_name, b.target_type, b.target_id,
         b.reason, b.details, b.status, b.resolved_by_id, b.resolved_at, b.created_at,
         b.reporter_username, ${targetFields}
       FROM b
       ${targetJoins}
       ${whereSql}
       ORDER BY b.created_at DESC
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues,
    );
    const reports = result.rows.map((row) => ({
      id: asString(row.id),
      reporterId: asString(row.reporter_id),
      reporterName: nullableString(row.reporter_name),
      targetType: asString(row.target_type, "story"),
      targetId: asString(row.target_id),
      contentType: asString(row.content_type, "Content"),
      title: asString(row.title, "Reported content"),
      preview: asString(row.preview, "Content preview is unavailable."),
      targetUserId: nullableString(row.target_user_id),
      userName: nullableString(row.user_name),
      username: nullableString(row.username),
      reason: asString(row.reason),
      details: asString(row.details),
      status: asString(row.status) === "pending" ? "open" : asString(row.status),
      resolvedById: nullableString(row.resolved_by_id),
      resolvedAt: row.resolved_at ? isoDate(row.resolved_at) : null,
      createdAt: isoDate(row.created_at),
    }));
    return res.json({ reports, total: Number(countResult.rows[0]?.total ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Admin moderation reports failed");
    return res.status(500).json({ error: "Could not load moderation reports." });
  }
});

router.put("/admin/moderation/reports/:id/status", requireAdmin, async (req: Request, res: Response) => {
  const idParsed = UpdateAdminModerationReportStatusBody.safeParse(req.body);
  const id = String(req.params.id ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: "Invalid report ID." });
  }
  if (!idParsed.success) return res.status(400).json({ error: "Invalid report status." });
  const adminId = getUserId(req);
  const client = await pool.connect() as unknown as DbClient;
  try {
    await client.query("BEGIN");
    const result = await client.query<Record<string, unknown>>(
      `SELECT * FROM reports WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const report = result.rows[0];
    if (!report) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Report not found." });
    }
    const targetType = asString(report.target_type) as TargetType;
    const targetId = asString(report.target_id);
    const content = await findContent(client, targetType, targetId);
    const reason = idParsed.data.reason?.trim() || `Report marked ${idParsed.data.status}.`;
    const statusUpdate = await client.query(
      `UPDATE reports SET status = $2,
        resolved_by_id = CASE WHEN $2 IN ('resolved', 'dismissed') THEN $3 ELSE NULL END,
        resolved_at = CASE WHEN $2 IN ('resolved', 'dismissed') THEN NOW() ELSE NULL END
       WHERE id = $1`,
      [id, idParsed.data.status, adminId],
    );
    const actionId = await logAction(
      client,
      adminId,
      `report_${idParsed.data.status}`,
      targetType,
      targetId,
      content?.targetUserId ?? null,
      reason,
      {
        ...(content ? snapshotFromContent(content) : {}),
        reportId: id,
        reportReason: asString(report.reason),
        reportDetails: asString(report.details),
      },
    );
    await client.query("COMMIT");
    void statusUpdate;
    return res.json({ ok: true, actionId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err }, "Admin moderation report status update failed");
    return res.status(500).json({ error: "Could not update this report." });
  } finally {
    client.release();
  }
});

router.post("/admin/moderation/actions", requireAdmin, async (req: Request, res: Response) => {
  const parsed = CreateAdminModerationActionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid moderation action." });
  const input = parsed.data;
  const adminId = getUserId(req);
  const targetType = input.targetType as TargetType;
  const client = await pool.connect() as unknown as DbClient;
  try {
    await client.query("BEGIN");
    const content = await findContent(client, targetType, input.targetId);
    const userAction = ["warn_user", "suspend_user", "ban_user"].includes(input.action);
    const hiddenEvent = input.action === "restore"
      ? await latestActiveHide(client, targetType, input.targetId)
      : null;
    const hasLegacyHiddenState = Boolean(
      content && (content.row.is_hidden === true) &&
      ["story", "video", "image", "outfit"].includes(targetType),
    );
    if (!content && !userAction && !hiddenEvent) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Moderation target not found." });
    }
    if (input.action === "restore" && !hiddenEvent && !hasLegacyHiddenState) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No restorable hidden content was found." });
    }
    const targetUserId = input.targetUserId ?? content?.targetUserId ??
      (targetType === "user" ? input.targetId : null);
    if (userAction && !targetUserId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "A user must be attached to this action." });
    }
    if (userAction && targetUserId === adminId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "You cannot moderate your own account." });
    }

    let snapshot: ModerationSnapshot = content ? snapshotFromContent(content) : {
      contentType: "User",
      title: "User account",
      preview: "Account moderation action",
    };
    if (input.action === "restore") {
      if (hiddenEvent) {
        snapshot = contentSnapshotFromRecord(hiddenEvent.snapshot);
        await restoreHiddenContent(client, targetType, input.targetId, snapshot);
      } else if (targetType === "outfit") {
        await client.query(`UPDATE outfits SET is_hidden = false WHERE id::text = $1`, [input.targetId]);
      } else {
        await client.query(`UPDATE stories SET is_hidden = false WHERE id::text = $1`, [input.targetId]);
      }
    } else if (input.action === "review") {
      await client.query(
        `UPDATE reports SET status = 'reviewing', resolved_by_id = NULL, resolved_at = NULL
         WHERE target_type = $1 AND target_id = $2 AND status IN ('pending', 'reviewing')`,
        [targetType, input.targetId],
      );
    } else if (userAction) {
      const user = await client.query<{ name: string }>(
        `SELECT name FROM "character" WHERE user_id = $1 FOR UPDATE`,
        [targetUserId],
      );
      if (!user.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found." });
      }
      snapshot = {
        ...snapshot,
        targetUserId,
        userName: user.rows[0].name,
      };
      if (input.action === "warn_user") {
        await client.query(
          `INSERT INTO notifications (user_id, actor_id, actor_name, type, ref_id, title, is_read)
           VALUES ($1, $2, 'Storigam Moderation', 'moderation_warning', $3, $4, false)`,
          [targetUserId, adminId, input.targetId, `A moderator sent you a warning: ${input.reason.trim()}`],
        );
      } else if (input.action === "suspend_user") {
        const days = input.suspensionDays ?? 7;
        await client.query(
          `UPDATE "character" SET suspended_until = NOW() + ($2::int * INTERVAL '1 day')
           WHERE user_id = $1`,
          [targetUserId, days],
        );
      } else if (input.action === "ban_user") {
        await client.query(
          `UPDATE "character" SET is_banned = true, suspended_until = NULL WHERE user_id = $1`,
          [targetUserId],
        );
      }
    } else {
      if (input.action === "ai_override_keep" || input.action === "ai_override_remove") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "No AI moderation source is connected, so there is no AI decision to override." });
      }
      if (!content) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Moderation target not found." });
      }
      await applyContentAction(client, input.action, targetType, input.targetId, content);
      if ((input.action === "hide" || input.action === "remove") && targetUserId) {
        const removed = input.action === "remove";
        const label = content.contentType.toLowerCase();
        await client.query(
          `INSERT INTO notifications (user_id, actor_id, actor_name, type, ref_id, title, is_read)
           VALUES ($1, $2, 'Storigam Moderation', $3, $4, $5, false)`,
          [
            targetUserId,
            adminId,
            removed ? "content_removed" : "content_hidden",
            input.targetId,
            removed
              ? `Your ${label} was removed by a moderator: ${input.reason.trim()}`
              : `Your ${label} was hidden by a moderator: ${input.reason.trim()}`,
          ],
        );
      }
    }

    if (["keep", "hide", "remove", "warn_user", "suspend_user", "ban_user",
      "ai_override_keep", "ai_override_remove"].includes(input.action)) {
      await resolveActiveReports(client, adminId, targetType, input.targetId);
    }
    const actionId = await logAction(
      client,
      adminId,
      input.action,
      targetType,
      input.targetId,
      targetUserId,
      input.reason.trim(),
      snapshot,
    );
    await client.query("COMMIT");
    return res.json({ ok: true, actionId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    const status = (err as { status?: number }).status ?? 500;
    if (status >= 500) req.log.error({ err }, "Admin moderation action failed");
    return res.status(status).json({
      error: status >= 500 ? "Could not apply this moderation action." : (err as Error).message,
    });
  } finally {
    client.release();
  }
});

router.get("/admin/moderation/records", requireAdmin, async (req: Request, res: Response) => {
  const parsed = GetAdminModerationRecordsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid moderation records query." });
  const { kind, q, limit, offset } = parsed.data;
  if (kind === "ai") return res.json({ kind, records: [], total: 0, sourceAvailable: false });
  const values: unknown[] = [];
  let sourceSql: string;
  if (kind === "hidden") {
    sourceSql = `
      WITH active_hidden AS (
        SELECT s.id::text AS id, COALESCE(h.admin_id, 'system') AS admin_id, admin.name AS admin_name,
          'currently_hidden'::text AS action,
          CASE WHEN s.content_type = 'video' THEN 'video' ELSE 'story' END AS target_type,
          s.id::text AS target_id,
          s.user_id AS target_user_id,
          CASE WHEN s.content_type = 'video' THEN 'Video' ELSE 'Story' END AS content_type,
          s.chapter_title AS title,
          COALESCE(NULLIF(s.description, ''), NULLIF(s.panels->0->>'text', ''), 'Hidden story') AS preview,
          COALESCE(h.reason, 'Hidden before moderation history was enabled.') AS reason,
          NULL::text AS ai_category, NULL::numeric AS ai_confidence, COALESCE(h.created_at, s.created_at) AS created_at
        FROM stories s
        LEFT JOIN LATERAL (
          SELECT l.admin_id, l.reason, l.created_at
          FROM moderation_logs l
          WHERE l.target_type IN ('story', 'video', 'image') AND l.target_id = s.id::text AND l.action = 'hide'
            AND NOT EXISTS (
              SELECT 1 FROM moderation_logs later
              WHERE later.target_type = l.target_type AND later.target_id = l.target_id
                AND later.created_at > l.created_at
                AND later.action IN ('restore', 'remove', 'keep', 'ai_override_keep', 'ai_override_remove')
            )
          ORDER BY l.created_at DESC
          LIMIT 1
        ) h ON true
        LEFT JOIN "character" admin ON admin.user_id = h.admin_id
        WHERE s.is_hidden = true
        UNION ALL
        SELECT o.id::text, COALESCE(h.admin_id, 'system'), admin.name, 'currently_hidden', 'outfit', o.id::text,
          o.user_id, 'Outfit', o.name,
          COALESCE(NULLIF(o.description, ''), NULLIF(o.story, ''), 'Hidden outfit'),
          COALESCE(h.reason, 'Hidden before moderation history was enabled.'), NULL, NULL, COALESCE(h.created_at, o.created_at)
        FROM outfits o
        LEFT JOIN LATERAL (
          SELECT l.admin_id, l.reason, l.created_at
          FROM moderation_logs l
          WHERE l.target_type = 'outfit' AND l.target_id = o.id::text AND l.action = 'hide'
            AND NOT EXISTS (
              SELECT 1 FROM moderation_logs later
              WHERE later.target_type = l.target_type AND later.target_id = l.target_id
                AND later.created_at > l.created_at
                AND later.action IN ('restore', 'remove', 'keep', 'ai_override_keep', 'ai_override_remove')
            )
          ORDER BY l.created_at DESC
          LIMIT 1
        ) h ON true
        LEFT JOIN "character" admin ON admin.user_id = h.admin_id
        WHERE o.is_hidden = true
        UNION ALL
        SELECT h.id::text, h.admin_id, admin.name, h.action, h.target_type, h.target_id,
          h.target_user_id, COALESCE(h.snapshot->>'contentType', 'Content'),
          COALESCE(h.snapshot->>'title', 'Hidden content'),
          COALESCE(h.snapshot->>'preview', 'Content preview is unavailable.'),
          h.reason, h.snapshot->>'category', NULLIF(h.snapshot->>'confidence', '')::numeric, h.created_at
        FROM moderation_logs h LEFT JOIN "character" admin ON admin.user_id = h.admin_id
        WHERE h.action = 'hide' AND h.target_type NOT IN ('story', 'video', 'image', 'outfit')
          AND NOT EXISTS (
            SELECT 1 FROM moderation_logs later
            WHERE later.target_type = h.target_type AND later.target_id = h.target_id
              AND later.created_at > h.created_at
              AND later.action IN ('restore', 'remove', 'keep', 'ai_override_keep', 'ai_override_remove')
          )
      )
      SELECT * FROM active_hidden
    `;
  } else if (kind === "removed") {
    sourceSql = `
      SELECT l.id::text AS id, l.admin_id, admin.name AS admin_name, l.action,
        l.target_type, l.target_id, l.target_user_id,
        COALESCE(l.snapshot->>'contentType', 'Content') AS content_type,
        COALESCE(l.snapshot->>'title', 'Removed content') AS title,
        COALESCE(l.snapshot->>'preview', 'Content preview is unavailable.') AS preview,
        l.reason, l.snapshot->>'category' AS ai_category,
        NULLIF(l.snapshot->>'confidence', '')::numeric AS ai_confidence, l.created_at
      FROM moderation_logs l
      LEFT JOIN "character" admin ON admin.user_id = l.admin_id
      WHERE l.action IN ('remove', 'ai_override_remove')
    `;
  } else {
    sourceSql = `
      SELECT l.id::text AS id, l.admin_id, admin.name AS admin_name, l.action,
        l.target_type, l.target_id, l.target_user_id,
        COALESCE(l.snapshot->>'contentType', 'Content') AS content_type,
        COALESCE(l.snapshot->>'title', 'Moderation action') AS title,
        COALESCE(l.snapshot->>'preview', 'Content preview is unavailable.') AS preview,
        l.reason, l.snapshot->>'category' AS ai_category,
        NULLIF(l.snapshot->>'confidence', '')::numeric AS ai_confidence, l.created_at
      FROM moderation_logs l
      LEFT JOIN "character" admin ON admin.user_id = l.admin_id
    `;
  }

  const qClause = q?.trim()
    ? (() => {
        values.push(`%${escapeLike(q.trim())}%`);
        return `WHERE (source.title ILIKE $${values.length} OR source.preview ILIKE $${values.length}
          OR source.reason ILIKE $${values.length} OR source.target_id ILIKE $${values.length}
          OR COALESCE(source.admin_name, '') ILIKE $${values.length})`;
      })()
    : "";
  try {
    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM (${sourceSql}) source ${qClause}`,
      values,
    );
    values.push(limit, offset);
    const result = await pool.query<Record<string, unknown>>(
      `SELECT * FROM (${sourceSql}) source ${qClause}
       ORDER BY source.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    const records = result.rows.map((row) => ({
      id: asString(row.id),
      adminId: asString(row.admin_id, "system"),
      adminName: nullableString(row.admin_name),
      action: asString(row.action),
      targetType: asString(row.target_type, "story"),
      targetId: asString(row.target_id),
      targetUserId: nullableString(row.target_user_id),
      contentType: asString(row.content_type, "Content"),
      title: asString(row.title, "Moderation action"),
      preview: asString(row.preview, "Content preview is unavailable."),
      reason: asString(row.reason),
      aiCategory: nullableString(row.ai_category),
      aiConfidence: row.ai_confidence == null ? null : Number(row.ai_confidence),
      createdAt: isoDate(row.created_at),
    }));
    return res.json({
      kind,
      records,
      total: Number(countResult.rows[0]?.total ?? 0),
      sourceAvailable: true,
    });
  } catch (err) {
    req.log.error({ err }, "Admin moderation records failed");
    return res.status(500).json({ error: "Could not load moderation history." });
  }
});

export default router;
