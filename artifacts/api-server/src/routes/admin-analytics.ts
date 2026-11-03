import { GetAdminAnalyticsQueryParams, GetAdminAnalyticsResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

type AggregateRow = Record<string, string | number | null>;
const numberValue = (value: string | number | null | undefined) => Number(value ?? 0);

router.get("/admin/analytics", requireAdmin, async (req: Request, res: Response) => {
  const query = GetAdminAnalyticsQueryParams.safeParse(req.query);
  if (!query.success || !Number.isInteger(query.data.days)) {
    res.status(400).json({ error: "days must be between 1 and 90" });
    return;
  }

  const days = query.data.days;
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  try {
    const [summaryResult, dailyResult, featureResult, topContentResult] = await Promise.all([
      pool.query<AggregateRow>(
        `SELECT
           (SELECT COUNT(*)::int FROM character) AS total_users,
           (SELECT COUNT(DISTINCT user_id)::int
              FROM (
                SELECT user_id FROM feature_usage_hourly WHERE hour_start >= $1 AND hour_start < $2
                UNION
                SELECT user_id FROM manga_generations WHERE created_at >= $1 AND created_at < $2
              ) tracked) AS active_users,
           (SELECT COUNT(*)::int FROM stories WHERE created_at >= $1 AND created_at < $2) AS stories_created,
           (SELECT COUNT(*)::int FROM stories
             WHERE created_at >= $1 AND created_at < $2 AND is_public = TRUE AND is_hidden = FALSE) AS stories_published,
           (SELECT COUNT(*)::int FROM manga_generations WHERE created_at >= $1 AND created_at < $2) AS ai_generations,
           ((SELECT COUNT(*)::int FROM messages
              WHERE created_at >= $1 AND created_at < $2 AND deleted_at IS NULL)
            + (SELECT COUNT(*)::int FROM campfire_messages WHERE created_at >= $1 AND created_at < $2)) AS messages,
           (SELECT COUNT(*)::int FROM reports WHERE created_at >= $1 AND created_at < $2) AS reports,
           (SELECT COUNT(*)::int FROM story_witnesses WHERE witnessed_at >= $1 AND witnessed_at < $2) AS stories_viewed,
           (SELECT COUNT(*)::int FROM story_likes WHERE liked_at >= $1 AND liked_at < $2) AS likes,
           (SELECT COUNT(*)::int FROM book_comments WHERE created_at >= $1 AND created_at < $2) AS comments,
           (SELECT COUNT(*)::int FROM books WHERE created_at >= $1 AND created_at < $2) AS manga_created,
           (SELECT COUNT(*)::int FROM uploaded_images WHERE created_at >= $1 AND created_at < $2) AS images_uploaded`,
        [start, end],
      ),
      pool.query<AggregateRow>(
        `WITH activity AS (
           SELECT (hour_start AT TIME ZONE 'UTC')::date AS day, user_id
             FROM feature_usage_hourly
            WHERE hour_start >= $3 AND hour_start < $4
           UNION
           SELECT (created_at AT TIME ZONE 'UTC')::date AS day, user_id
             FROM manga_generations
            WHERE created_at >= $3 AND created_at < $4
         ),
         active_by_day AS (
           SELECT day, COUNT(DISTINCT user_id)::int AS active_users
             FROM activity GROUP BY day
         ),
         stories_by_day AS (
           SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS stories_created
             FROM stories
            WHERE created_at >= $3 AND created_at < $4
            GROUP BY (created_at AT TIME ZONE 'UTC')::date
         )
         SELECT to_char(calendar.day, 'YYYY-MM-DD') AS date,
                COALESCE(active_by_day.active_users, 0)::int AS active_users,
                COALESCE(stories_by_day.stories_created, 0)::int AS stories_created
           FROM generate_series($1::date, ($2::date - 1), interval '1 day') AS calendar(day)
           LEFT JOIN active_by_day ON active_by_day.day = calendar.day::date
           LEFT JOIN stories_by_day ON stories_by_day.day = calendar.day::date
          ORDER BY calendar.day`,
        [startDate, endDate, start, end],
      ),
      pool.query<AggregateRow>(
        `SELECT
           (SELECT COUNT(DISTINCT user_id)::int FROM feature_usage_hourly
             WHERE feature_key = 'discovery' AND hour_start >= $1 AND hour_start < $2) AS discover,
           (SELECT COUNT(DISTINCT user_id)::int
              FROM (
                SELECT user_id FROM feature_usage_hourly
                 WHERE feature_key IN ('stories', 'books') AND hour_start >= $1 AND hour_start < $2
                UNION
                SELECT user_id FROM manga_generations WHERE created_at >= $1 AND created_at < $2
              ) creators) AS story_creator,
           (SELECT COUNT(DISTINCT user_id)::int
              FROM (
                SELECT user_id FROM feature_usage_hourly
                 WHERE feature_key IN ('ai-assist', 'drift-ai', 'image-generation') AND hour_start >= $1 AND hour_start < $2
                UNION
                SELECT user_id FROM manga_generations WHERE created_at >= $1 AND created_at < $2
              ) ai_users) AS ai_generation,
           (SELECT COUNT(DISTINCT user_id)::int
              FROM feature_usage_hourly
             WHERE feature_key IN ('messaging', 'campfire') AND hour_start >= $1 AND hour_start < $2) AS chat`,
        [start, end],
      ),
      pool.query<AggregateRow>(
        `SELECT 'story:' || id::text AS id, 'story'::text AS content_type,
                chapter_title AS title, witnessed_count::int AS views
           FROM stories
          WHERE is_public = TRUE AND is_hidden = FALSE AND witnessed_count > 0
         UNION ALL
         SELECT 'book:' || books.id::text AS id, 'book'::text AS content_type,
                books.title AS title, COALESCE(SUM(chapters.read_count), 0)::int AS views
           FROM books
           LEFT JOIN chapters ON chapters.book_id = books.id AND chapters.status = 'published'
          WHERE books.visibility = 'public'
          GROUP BY books.id
         HAVING COALESCE(SUM(chapters.read_count), 0) > 0
          ORDER BY views DESC, title ASC
          LIMIT 10`,
      ),
    ]);

    const summary = summaryResult.rows[0];
    const featureCounts = featureResult.rows[0];
    const daily = dailyResult.rows.map((row) => ({
      date: String(row.date),
      activeUsers: numberValue(row.active_users),
      storiesCreated: numberValue(row.stories_created),
    }));
    const averageDailyActiveUsers = daily.length
      ? Math.round(daily.reduce((total, row) => total + row.activeUsers, 0) / daily.length)
      : 0;

    const payload = GetAdminAnalyticsResponse.parse({
      periodDays: days,
      metrics: {
        totalUsers: numberValue(summary?.total_users),
        newUsers: null,
        activeUsers: numberValue(summary?.active_users),
        averageDailyActiveUsers,
        storiesCreated: numberValue(summary?.stories_created),
        storiesPublished: numberValue(summary?.stories_published),
        aiGenerations: numberValue(summary?.ai_generations),
        messages: numberValue(summary?.messages),
        reports: numberValue(summary?.reports),
        storiesViewed: numberValue(summary?.stories_viewed),
        likes: numberValue(summary?.likes),
        comments: numberValue(summary?.comments),
        shares: null,
        mangaCreated: numberValue(summary?.manga_created),
        imagesUploaded: numberValue(summary?.images_uploaded),
        videoUploads: null,
      },
      daily,
      features: {
        discover: numberValue(featureCounts?.discover),
        storyCreator: numberValue(featureCounts?.story_creator),
        aiGeneration: numberValue(featureCounts?.ai_generation),
        friends: null,
        chat: numberValue(featureCounts?.chat),
        search: null,
      },
      topContent: topContentResult.rows.map((row) => ({
        id: String(row.id),
        contentType: row.content_type === "book" ? "book" : "story",
        title: String(row.title ?? "Untitled story"),
        views: numberValue(row.views),
      })),
    });

    res.set("Cache-Control", "no-store").json({
      ...payload,
      daily: payload.daily.map(({ date, ...row }) => ({
        ...row,
        date: date.toISOString().slice(0, 10),
      })),
    });
  } catch (error) {
    req.log.error({ err: error, days }, "admin analytics GET failed");
    res.status(500).json({ error: "Could not load admin analytics" });
  }
});

export default router;
