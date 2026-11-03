import { pool } from "@workspace/db";
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

type Owner = string | SQLWrapper;

/** Friends means a reciprocal connection, not a one-way follow. */
export function friendsSql(owner: Owner, viewer: string): SQL {
  return sql`(
    EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=${viewer} AND f.following_id=${owner})
    AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=${owner} AND f.following_id=${viewer})
    AND NOT EXISTS (SELECT 1 FROM blocks b
      WHERE (b.blocker_id=${owner} AND b.blocked_id=${viewer})
         OR (b.blocker_id=${viewer} AND b.blocked_id=${owner}))
  )`;
}

export async function areFriends(owner: string, viewer: string): Promise<boolean> {
  if (!viewer || owner === viewer) return false;
  const result = await pool.query(`SELECT (
    EXISTS (SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2)
    AND EXISTS (SELECT 1 FROM follows WHERE follower_id=$2 AND following_id=$1)
    AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1))
  ) AS allowed`, [owner, viewer]);
  return result.rows[0]?.allowed === true;
}

export function readableProfileSql(owner: Owner, viewer: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM character cv WHERE cv.user_id=${owner}
      AND cv.is_banned=false AND cv.is_hidden=false
      AND (${owner}=${viewer} OR cv.is_public=true OR ${friendsSql(owner, viewer)})
      AND NOT EXISTS (SELECT 1 FROM blocks b
        WHERE (b.blocker_id=${owner} AND b.blocked_id=${viewer})
           OR (b.blocker_id=${viewer} AND b.blocked_id=${owner}))
  )`;
}

/** Legacy non-public content remains owner-only; friends requires an explicit setting. */
export function readableContentSql(
  owner: Owner, viewer: string, visibility: SQLWrapper, publicFlag?: SQLWrapper,
): SQL {
  const publicContent = publicFlag ? sql`${publicFlag}=true` : sql`${visibility}='public'`;
  return sql`(${owner}=${viewer} OR (
    ${readableProfileSql(owner, viewer)}
    AND (${publicContent} OR (${visibility}='friends' AND ${friendsSql(owner, viewer)}))
  ))`;
}
