-- Add the guide tutorial authoring and attendee progress model.
-- Intentionally not applied by the agent; apply only after production backup/recovery is verified.

CREATE TABLE IF NOT EXISTS guide_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  topic text,
  visibility text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'draft',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guide_tutorials_guide_created_idx
  ON guide_tutorials (guide_id, created_at);

ALTER TABLE guide_sessions
  ADD COLUMN IF NOT EXISTS tutorial_id uuid;

ALTER TABLE guide_session_attendees
  ADD COLUMN IF NOT EXISTS tutorial_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tutorial_completed_at timestamptz;
