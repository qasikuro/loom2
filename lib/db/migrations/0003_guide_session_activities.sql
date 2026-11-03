-- Persist live guide activities, participant responses, and question upvotes.
CREATE TABLE IF NOT EXISTS guide_session_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  guide_id text NOT NULL,
  title text NOT NULL,
  prompt text NOT NULL,
  kind text NOT NULL,
  resource_url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS guide_session_activities_session_created_idx
  ON guide_session_activities (session_id, created_at);

CREATE TABLE IF NOT EXISTS guide_session_activity_responses (
  activity_id uuid NOT NULL,
  user_id text NOT NULL,
  response text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS guide_session_question_votes (
  question_id uuid NOT NULL,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);
