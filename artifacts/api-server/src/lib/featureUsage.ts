import { and, eq, sql } from "drizzle-orm";
import {
  appSettingsTable,
  db,
  featureUsageHourlyTable,
  pool,
} from "@workspace/db";

export const FEATURE_USAGE_SETTING_KEY = "feature_usage_controls";

export const FEATURE_DEFINITIONS = [
  { key: "stories", label: "Stories", costSource: "configurable" },
  { key: "journals", label: "Journals", costSource: "configurable" },
  { key: "messaging", label: "Messages", costSource: "configurable" },
  { key: "campfire", label: "Campfire", costSource: "configurable" },
  { key: "books", label: "Books", costSource: "configurable" },
  { key: "discovery", label: "Discovery", costSource: "configurable" },
  { key: "outfits", label: "Outfits", costSource: "configurable" },
  { key: "gallery", label: "Gallery", costSource: "configurable" },
  { key: "uploads", label: "Media uploads", costSource: "configurable" },
  { key: "community", label: "Community", costSource: "configurable" },
  { key: "ai-assist", label: "Writing assistant", costSource: "configurable" },
  { key: "drift-ai", label: "Drift AI", costSource: "configurable" },
  { key: "image-generation", label: "Image generation", costSource: "recorded" },
] as const;

export type FeatureUsageKey = (typeof FEATURE_DEFINITIONS)[number]["key"];
export interface FeatureUsagePolicy {
  enabled: boolean;
  hourlyLimit: number | null;
  dailyLimit: number | null;
  dailyBudgetMicros: number | null;
  costPerActionMicros: number | null;
}
export type FeatureUsageControls = Record<FeatureUsageKey, FeatureUsagePolicy>;

const DEFAULT_POLICY: FeatureUsagePolicy = {
  enabled: true,
  hourlyLimit: null,
  dailyLimit: null,
  dailyBudgetMicros: null,
  costPerActionMicros: null,
};

let cachedControls: FeatureUsageControls | null = null;
let cacheExpiresAt = 0;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validNullableInteger(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

function normalizePolicy(value: unknown): FeatureUsagePolicy {
  const saved = isObject(value) ? value : {};
  return {
    enabled: typeof saved.enabled === "boolean" ? saved.enabled : DEFAULT_POLICY.enabled,
    hourlyLimit: validNullableInteger(saved.hourlyLimit, 1, 100_000),
    dailyLimit: validNullableInteger(saved.dailyLimit, 1, 1_000_000),
    dailyBudgetMicros: validNullableInteger(saved.dailyBudgetMicros, 1, 1_000_000_000_000),
    costPerActionMicros: validNullableInteger(saved.costPerActionMicros, 0, 10_000_000_000),
  };
}

export function normalizeFeatureUsageControls(value: unknown): FeatureUsageControls {
  const saved = isObject(value) ? value : {};
  return Object.fromEntries(
    FEATURE_DEFINITIONS.map(({ key }) => [key, normalizePolicy(saved[key])]),
  ) as FeatureUsageControls;
}

export async function getFeatureUsageControls(): Promise<FeatureUsageControls> {
  if (cachedControls && Date.now() < cacheExpiresAt) return cachedControls;

  const [setting] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, FEATURE_USAGE_SETTING_KEY))
    .limit(1);

  cachedControls = normalizeFeatureUsageControls(setting?.value);
  cacheExpiresAt = Date.now() + 5_000;
  return cachedControls;
}

export async function getFeatureUsagePolicy(
  featureKey: FeatureUsageKey,
): Promise<FeatureUsagePolicy> {
  const controls = await getFeatureUsageControls();
  return controls[featureKey];
}

export function clearFeatureUsageCache(): void {
  cachedControls = null;
  cacheExpiresAt = 0;
}

export async function saveFeatureUsagePolicy(
  featureKey: FeatureUsageKey,
  policy: FeatureUsagePolicy,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('feature-usage-controls'))`);
    const [setting] = await tx
      .select({ value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, FEATURE_USAGE_SETTING_KEY))
      .limit(1);
    const controls = normalizeFeatureUsageControls(setting?.value);
    controls[featureKey] = policy;

    await tx
      .insert(appSettingsTable)
      .values({
        key: FEATURE_USAGE_SETTING_KEY,
        value: controls as never,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: controls as never, updatedAt: new Date() },
      });
  });
  clearFeatureUsageCache();
}

export type FeatureAdmission =
  | { allowed: true }
  | { allowed: false; status: 429 | 503; message: string; retryAfterSeconds?: number };

function startOfUtcHour(date: Date): Date {
  const result = new Date(date);
  result.setUTCMinutes(0, 0, 0);
  return result;
}

function startOfUtcDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function secondsUntil(date: Date, boundary: "hour" | "day"): number {
  const next = new Date(date);
  if (boundary === "hour") {
    next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
  } else {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
  }
  return Math.max(1, Math.ceil((next.getTime() - date.getTime()) / 1_000));
}

/**
 * Atomically admits and records one authenticated API request. The event stores
 * only user ID, feature, hour, counts, and an optional configured estimate.
 */
export async function admitAndRecordFeatureRequest(
  userId: string,
  featureKey: FeatureUsageKey,
  now = new Date(),
): Promise<FeatureAdmission> {
  const definition = FEATURE_DEFINITIONS.find((item) => item.key === featureKey);
  const policy = await getFeatureUsagePolicy(featureKey);

  if (!policy.enabled) {
    return { allowed: false, status: 503, message: "This feature is temporarily unavailable." };
  }
  if (definition?.costSource === "recorded") {
    return { allowed: false, status: 503, message: "This feature uses its own usage recorder." };
  }

  const hourStart = startOfUtcHour(now);
  const dayStart = startOfUtcDay(now);
  const costMicros = policy.costPerActionMicros ?? 0;

  return db.transaction(async (tx) => {
    // Serialize admissions for this feature so global daily budgets cannot be
    // overshot by concurrent requests on separate API instances.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${featureKey}), 0)`);

    const [usage] = await tx
      .select({
        userDailyActions: sql<number>`COALESCE(SUM(CASE WHEN ${featureUsageHourlyTable.userId} = ${userId} THEN ${featureUsageHourlyTable.actionCount} ELSE 0 END), 0)::int`,
        userHourlyActions: sql<number>`COALESCE(SUM(CASE WHEN ${featureUsageHourlyTable.userId} = ${userId} AND ${featureUsageHourlyTable.hourStart} = ${hourStart} THEN ${featureUsageHourlyTable.actionCount} ELSE 0 END), 0)::int`,
        dailyCostMicros: sql<string>`COALESCE(SUM(${featureUsageHourlyTable.estimatedCostMicros}), 0)::text`,
      })
      .from(featureUsageHourlyTable)
      .where(and(
        eq(featureUsageHourlyTable.featureKey, featureKey),
        sql`${featureUsageHourlyTable.hourStart} >= ${dayStart}`,
      ));

    const userDailyActions = Number(usage?.userDailyActions ?? 0);
    const userHourlyActions = Number(usage?.userHourlyActions ?? 0);
    const dailyCostMicros = Number(usage?.dailyCostMicros ?? 0);

    if (policy.hourlyLimit !== null && userHourlyActions >= policy.hourlyLimit) {
      return {
        allowed: false,
        status: 429,
        message: "This feature's hourly limit has been reached.",
        retryAfterSeconds: secondsUntil(now, "hour"),
      };
    }
    if (policy.dailyLimit !== null && userDailyActions >= policy.dailyLimit) {
      return {
        allowed: false,
        status: 429,
        message: "This feature's daily limit has been reached.",
        retryAfterSeconds: secondsUntil(now, "day"),
      };
    }
    if (
      policy.dailyBudgetMicros !== null &&
      dailyCostMicros + costMicros > policy.dailyBudgetMicros
    ) {
      return {
        allowed: false,
        status: 429,
        message: "This feature's daily estimated-cost budget has been reached.",
        retryAfterSeconds: secondsUntil(now, "day"),
      };
    }

    await tx
      .insert(featureUsageHourlyTable)
      .values({
        userId,
        featureKey,
        hourStart,
        actionCount: 1,
        pricedActionCount: policy.costPerActionMicros === null ? 0 : 1,
        unpricedActionCount: policy.costPerActionMicros === null ? 1 : 0,
        estimatedCostMicros: costMicros,
      })
      .onConflictDoUpdate({
        target: [
          featureUsageHourlyTable.userId,
          featureUsageHourlyTable.featureKey,
          featureUsageHourlyTable.hourStart,
        ],
        set: {
          actionCount: sql`${featureUsageHourlyTable.actionCount} + 1`,
          pricedActionCount: sql`${featureUsageHourlyTable.pricedActionCount} + ${policy.costPerActionMicros === null ? 0 : 1}`,
          unpricedActionCount: sql`${featureUsageHourlyTable.unpricedActionCount} + ${policy.costPerActionMicros === null ? 1 : 0}`,
          estimatedCostMicros: sql`${featureUsageHourlyTable.estimatedCostMicros} + ${costMicros}`,
        },
      });

    return { allowed: true };
  });
}

type NumericRow = Record<string, string | number | null>;
const asNumber = (value: string | number | null | undefined) => Number(value ?? 0);

export async function getFeatureUsageOverview(days: number) {
  const now = new Date();
  const from = startOfUtcDay(now);
  from.setUTCDate(from.getUTCDate() - days + 1);
  const todayStart = startOfUtcDay(now);
  const controls = await getFeatureUsageControls();

  const [
    dailyGenericResult,
    dailyMangaResult,
    featureGenericResult,
    featureMangaResult,
    userGenericResult,
    userMangaResult,
    activeByDayResult,
    activeTotalResult,
    lifetimeMangaUsersResult,
  ] = await Promise.all([
    pool.query<NumericRow>(
      `SELECT to_char(date_trunc('day', hour_start AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
              SUM(action_count)::int AS actions,
              SUM(estimated_cost_micros)::bigint AS cost,
              SUM(priced_action_count)::int AS priced,
              SUM(unpriced_action_count)::int AS unpriced
         FROM feature_usage_hourly
        WHERE hour_start >= $1
        GROUP BY date_trunc('day', hour_start AT TIME ZONE 'UTC')`,
      [from],
    ),
    pool.query<NumericRow>(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS actions,
              SUM(estimated_cost_micros)::bigint AS cost
         FROM manga_generations
        WHERE created_at >= $1
        GROUP BY date_trunc('day', created_at AT TIME ZONE 'UTC')`,
      [from],
    ),
    pool.query<NumericRow>(
      `SELECT feature_key,
              SUM(action_count)::int AS actions,
              COUNT(DISTINCT user_id)::int AS active_users,
              SUM(estimated_cost_micros)::bigint AS cost,
              SUM(priced_action_count)::int AS priced,
              SUM(unpriced_action_count)::int AS unpriced,
              SUM(estimated_cost_micros) FILTER (WHERE hour_start >= $2)::bigint AS today_cost
         FROM feature_usage_hourly
        WHERE hour_start >= $1
        GROUP BY feature_key`,
      [from, todayStart],
    ),
    pool.query<NumericRow>(
      `SELECT COUNT(*)::int AS actions,
              COUNT(DISTINCT user_id)::int AS active_users,
              SUM(estimated_cost_micros)::bigint AS cost,
              SUM(estimated_cost_micros) FILTER (WHERE created_at >= $2)::bigint AS today_cost,
              COUNT(provider_cost_micros)::int AS usage_priced,
              COUNT(*) FILTER (WHERE status = 'success' AND provider_cost_micros IS NULL)::int AS usage_unpriced,
              SUM(provider_cost_micros)::bigint AS provider_usage_cost,
              SUM(provider_cost_micros) FILTER (WHERE created_at >= $2)::bigint AS today_provider_usage_cost
         FROM manga_generations
        WHERE created_at >= $1`,
      [from, todayStart],
    ),
    pool.query<NumericRow>(
      `SELECT user_id, SUM(action_count)::int AS actions
         FROM feature_usage_hourly
        WHERE hour_start >= $1
        GROUP BY user_id`,
      [from],
    ),
    pool.query<NumericRow>(
      `SELECT user_id, COUNT(*)::int AS actions
         FROM manga_generations
        WHERE created_at >= $1
        GROUP BY user_id`,
      [from],
    ),
    pool.query<NumericRow>(
      `SELECT day, COUNT(DISTINCT user_id)::int AS active_users
         FROM (
           SELECT date_trunc('day', hour_start AT TIME ZONE 'UTC') AS day, user_id
             FROM feature_usage_hourly
            WHERE hour_start >= $1
           UNION ALL
           SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, user_id
             FROM manga_generations
            WHERE created_at >= $1
         ) activity
        GROUP BY day`,
      [from],
    ),
    pool.query<NumericRow>(
      `SELECT COUNT(DISTINCT user_id)::int AS active_users
         FROM (
           SELECT user_id FROM feature_usage_hourly WHERE hour_start >= $1
           UNION
           SELECT user_id FROM manga_generations WHERE created_at >= $1
         ) activity`,
      [from],
    ),
    pool.query<NumericRow>(
      `SELECT mg.user_id,
              COALESCE(NULLIF(c.username, ''), NULLIF(c.name, ''), mg.user_id) AS name,
              COUNT(*)::int AS attempts,
              COUNT(*) FILTER (WHERE mg.status = 'success')::int AS successful,
              COUNT(*) FILTER (WHERE mg.status = 'failed')::int AS failed,
              COUNT(*) FILTER (WHERE mg.status NOT IN ('success', 'failed'))::int AS pending,
              SUM(mg.estimated_cost_micros)::bigint AS estimated_cost_micros,
              COUNT(mg.provider_cost_micros)::int AS usage_priced_attempts,
              COUNT(*) FILTER (WHERE mg.status = 'success' AND mg.provider_cost_micros IS NULL)::int AS usage_unpriced_successes,
              SUM(mg.provider_cost_micros)::bigint AS provider_usage_cost_micros
         FROM manga_generations mg
         LEFT JOIN character c ON c.user_id = mg.user_id
        GROUP BY mg.user_id, c.username, c.name
        ORDER BY COUNT(*) DESC, mg.user_id ASC`,
    ),
  ]);

  const daily = new Map<string, {
    date: string;
    actions: number;
    activeUsers: number;
    estimatedCostMicros: number;
    pricedActions: number;
    unpricedActions: number;
  }>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    daily.set(key, {
      date: key,
      actions: 0,
      activeUsers: 0,
      estimatedCostMicros: 0,
      pricedActions: 0,
      unpricedActions: 0,
    });
  }
  const dailyGeneric = new Map(dailyGenericResult.rows.map((row) => [String(row.day), row]));
  const dailyManga = new Map(dailyMangaResult.rows.map((row) => [String(row.day), row]));
  const activeByDay = new Map(activeByDayResult.rows.map((row) => [
    String(row.day).slice(0, 10),
    asNumber(row.active_users),
  ]));
  for (const [date, entry] of daily) {
    const generic = dailyGeneric.get(date);
    const manga = dailyManga.get(date);
    const mangaActions = asNumber(manga?.actions);
    entry.actions = asNumber(generic?.actions) + mangaActions;
    entry.estimatedCostMicros = asNumber(generic?.cost) + asNumber(manga?.cost);
    entry.pricedActions = asNumber(generic?.priced) + mangaActions;
    entry.unpricedActions = asNumber(generic?.unpriced);
    entry.activeUsers = activeByDay.get(date) ?? 0;
  }

  const genericByFeature = new Map(
    featureGenericResult.rows.map((row) => [String(row.feature_key), row]),
  );
  const mangaAggregate = featureMangaResult.rows[0];
  const features = FEATURE_DEFINITIONS.map((definition) => {
    const row = genericByFeature.get(definition.key);
    const isRecorded = definition.costSource === "recorded";
    const actions = isRecorded
      ? asNumber(mangaAggregate?.actions)
      : asNumber(row?.actions);
    const cost = isRecorded
      ? asNumber(mangaAggregate?.cost)
      : asNumber(row?.cost);
    const pricedActions = isRecorded
      ? actions
      : asNumber(row?.priced);
    const unpricedActions = isRecorded ? 0 : asNumber(row?.unpriced);

    return {
      featureKey: definition.key,
      label: definition.label,
      costSource: definition.costSource,
      actions,
      activeUsers: isRecorded
        ? asNumber(mangaAggregate?.active_users)
        : asNumber(row?.active_users),
      estimatedCostMicros: cost,
      pricedActions,
      unpricedActions,
      providerUsageCostMicros: isRecorded ? asNumber(mangaAggregate?.provider_usage_cost) : 0,
      providerPricedActions: isRecorded ? asNumber(mangaAggregate?.usage_priced) : 0,
      providerUnpricedActions: isRecorded ? asNumber(mangaAggregate?.usage_unpriced) : 0,
      currentDailySpendMicros: isRecorded
        ? asNumber(mangaAggregate?.today_cost)
        : asNumber(row?.today_cost),
      currentDailyProviderUsageCostMicros: isRecorded
        ? asNumber(mangaAggregate?.today_provider_usage_cost)
        : 0,
      policy: controls[definition.key],
    };
  });

  const totals = [...daily.values()].reduce((result, row) => ({
    actions: result.actions + row.actions,
    estimatedCostMicros: result.estimatedCostMicros + row.estimatedCostMicros,
    pricedActions: result.pricedActions + row.pricedActions,
    unpricedActions: result.unpricedActions + row.unpricedActions,
  }), { actions: 0, estimatedCostMicros: 0, pricedActions: 0, unpricedActions: 0 });
  const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
  const projectedMonthlyCostMicros = Math.round(totals.estimatedCostMicros / days * daysInMonth);

  const userActions = new Map<string, number>();
  for (const row of [...userGenericResult.rows, ...userMangaResult.rows]) {
    const userId = String(row.user_id);
    userActions.set(userId, (userActions.get(userId) ?? 0) + asNumber(row.actions));
  }
  const topUserIds = [...userActions.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10);
  const names = topUserIds.length
    ? await pool.query<{ user_id: string; name: string }>(
      "SELECT user_id, name FROM character WHERE user_id = ANY($1::text[])",
      [topUserIds.map(([userId]) => userId)],
    )
    : { rows: [] };
  const userNames = new Map(names.rows.map((row) => [row.user_id, row.name]));
  const activeUsers = asNumber(activeTotalResult.rows[0]?.active_users);

  return {
    periodDays: days,
    totals: {
      ...totals,
      activeUsers,
      projectedMonthlyCostMicros,
    },
    daily: [...daily.values()],
    features,
    topUsers: topUserIds.map(([userId, actions]) => ({
      userId,
      name: userNames.get(userId) ?? "Unknown user",
      actions,
    })),
    mangaGenerationUsers: lifetimeMangaUsersResult.rows.map((row) => ({
      userId: String(row.user_id),
      name: String(row.name ?? "Unknown user"),
      attempts: asNumber(row.attempts),
      successful: asNumber(row.successful),
      failed: asNumber(row.failed),
      pending: asNumber(row.pending),
      estimatedCostMicros: asNumber(row.estimated_cost_micros),
      usagePricedAttempts: asNumber(row.usage_priced_attempts),
      usageUnpricedSuccesses: asNumber(row.usage_unpriced_successes),
      providerUsageCostMicros: row.provider_usage_cost_micros == null
        ? null
        : asNumber(row.provider_usage_cost_micros),
    })),
  };
}

export function isFeatureUsageKey(value: string): value is FeatureUsageKey {
  return FEATURE_DEFINITIONS.some((item) => item.key === value);
}