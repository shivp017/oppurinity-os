CREATE TABLE IF NOT EXISTS profile_preferences (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  target_titles TEXT[] NOT NULL DEFAULT '{}',
  preferred_kinds TEXT[] NOT NULL DEFAULT ARRAY['job', 'contract', 'client'],
  remote_only BOOLEAN NOT NULL DEFAULT FALSE,
  min_match_score INTEGER NOT NULL DEFAULT 0 CHECK (min_match_score BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO profile_preferences (profile_id, target_titles, preferred_kinds, remote_only, min_match_score)
SELECT id, ARRAY[role], ARRAY['job', 'contract', 'client'], FALSE, 0 FROM profiles
ON CONFLICT (profile_id) DO NOTHING;
