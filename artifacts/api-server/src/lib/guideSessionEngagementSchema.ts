import { pool } from "@workspace/db";

let checkedAt = 0;
let ready = false;
const CACHE_MS = 30_000;

export async function hasGuideSessionEngagementSchema(): Promise<boolean> {
  if (Date.now() - checkedAt < CACHE_MS) return ready;
  const result = await pool.query(
    `SELECT
       to_regclass('public.guide_session_polls') IS NOT NULL AS polls,
       to_regclass('public.guide_session_poll_votes') IS NOT NULL AS votes,
       to_regclass('public.guide_session_questions') IS NOT NULL AS questions,
       to_regclass('public.guide_session_recaps') IS NOT NULL AS recaps`,
  );
  const row = result.rows[0];
  ready = !!(row?.polls && row?.votes && row?.questions && row?.recaps);
  checkedAt = Date.now();
  return ready;
}

let interactionsCheckedAt = 0;
let interactionsReady = false;

export async function hasGuideSessionInteractionsSchema(): Promise<boolean> {
  if (Date.now() - interactionsCheckedAt < CACHE_MS) return interactionsReady;
  const result = await pool.query(
    `SELECT
       to_regclass('public.guide_session_activities') IS NOT NULL AS activities,
       to_regclass('public.guide_session_activity_responses') IS NOT NULL AS responses,
       to_regclass('public.guide_session_question_votes') IS NOT NULL AS question_votes`,
  );
  const row = result.rows[0];
  interactionsReady = !!(row?.activities && row?.responses && row?.question_votes);
  interactionsCheckedAt = Date.now();
  return interactionsReady;
}
