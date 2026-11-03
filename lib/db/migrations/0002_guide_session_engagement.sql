-- Persist host polls, participant questions, and end-of-session recaps.
CREATE TABLE IF NOT EXISTS guide_session_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  created_by text NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS guide_session_polls_session_created_idx
  ON guide_session_polls (session_id, created_at);

CREATE TABLE IF NOT EXISTS guide_session_poll_votes (
  poll_id uuid NOT NULL,
  user_id text NOT NULL,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS guide_session_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id text NOT NULL,
  question text NOT NULL,
  answer text,
  answered_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
CREATE INDEX IF NOT EXISTS guide_session_questions_session_created_idx
  ON guide_session_questions (session_id, created_at);

CREATE TABLE IF NOT EXISTS guide_session_recaps (
  session_id uuid PRIMARY KEY,
  guide_id text NOT NULL,
  summary text NOT NULL,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
