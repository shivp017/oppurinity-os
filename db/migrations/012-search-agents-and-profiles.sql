CREATE TABLE IF NOT EXISTS search_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  connector_type TEXT NOT NULL CHECK (connector_type IN ('GREENHOUSE', 'ASHBY', 'LEVER')),
  board_token TEXT NOT NULL,
  query_params JSONB NOT NULL DEFAULT '{}',
  frequency_hours INTEGER NOT NULL DEFAULT 24,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED')),
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_agents_profile_id_idx ON search_agents(profile_id);

ALTER TABLE profile_preferences ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profile_preferences ADD COLUMN IF NOT EXISTS min_hourly_rate INTEGER;
ALTER TABLE profile_preferences ADD COLUMN IF NOT EXISTS min_annual_comp INTEGER;
ALTER TABLE profile_preferences ADD COLUMN IF NOT EXISTS work_authorization TEXT[] NOT NULL DEFAULT ARRAY['US Citizen', 'Green Card', 'Contractor C2C'];
ALTER TABLE profile_preferences ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'Immediate';

ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Seed default search agents
INSERT INTO search_agents (profile_id, name, connector_type, board_token, query_params) VALUES
  ('revops', 'Linear RevOps Monitor', 'GREENHOUSE', 'linear', '{"keywords": ["revenue", "revops", "operations", "hubspot"]}'),
  ('fullstack', 'PostHog Product Engineering', 'ASHBY', 'posthog', '{"keywords": ["engineer", "full stack", "typescript", "product"]}'),
  ('revops', 'Figma GTM Systems', 'LEVER', 'figma', '{"keywords": ["gtm", "operations", "salesforce", "hubspot"]}')
ON CONFLICT DO NOTHING;
