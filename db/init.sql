CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Profiles & Core Opportunities
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Active', 'Paused')),
  opportunity_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('job', 'contract', 'client')),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  compensation TEXT NOT NULL,
  match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  freshness TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('High', 'Medium', 'Review')),
  reasons TEXT[] NOT NULL,
  source_id TEXT,
  external_id TEXT,
  url TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS profile_opportunities (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'RECOMMENDED' CHECK (status IN ('RECOMMENDED', 'SAVED', 'APPLICATION_PREPARING')),
  recommended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PREPARING' CHECK (status IN ('PREPARING', 'READY_FOR_REVIEW', 'SUBMITTED', 'INTERVIEWING', 'OFFER', 'REJECTED')),
  notes TEXT,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  external_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS profile_preferences (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  target_titles TEXT[] NOT NULL DEFAULT '{}',
  preferred_kinds TEXT[] NOT NULL DEFAULT ARRAY['job', 'contract', 'client'],
  remote_only BOOLEAN NOT NULL DEFAULT FALSE,
  min_match_score INTEGER NOT NULL DEFAULT 0 CHECK (min_match_score BETWEEN 0 AND 100),
  skills TEXT[] NOT NULL DEFAULT '{}',
  min_hourly_rate INTEGER,
  min_annual_comp INTEGER,
  work_authorization TEXT[] NOT NULL DEFAULT ARRAY['US Citizen', 'Green Card', 'Contractor C2C'],
  availability TEXT NOT NULL DEFAULT 'Immediate',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sources, Provenance & Ingestion Runs
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'ERROR')),
  last_ingested_at TIMESTAMPTZ,
  records_ingested INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES sources(id),
  external_id TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, external_id, payload_hash)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCEEDED','FAILED')),
  records_fetched INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ingestion_runs_source_started_idx ON ingestion_runs(source_id, started_at DESC);

-- 3. Search Agents
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

-- 4. Operations, Audit & Safety
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events(created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_records (
  key TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_windows (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(key, window_start)
);

-- 5. Client Acquisition & CRM
CREATE TABLE IF NOT EXISTS service_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  target_industries TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  industry TEXT,
  employee_range TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  title TEXT,
  consent_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (consent_status IN ('UNKNOWN','PERMITTED','OPTED_OUT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  service_profile_id UUID REFERENCES service_profiles(id),
  title TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN ('DISCOVERED','QUALIFIED','OUTREACH_READY','CONTACTED','RESPONDED','CONVERTED','DISQUALIFIED')),
  facts JSONB NOT NULL DEFAULT '[]',
  inference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_opportunity_id UUID NOT NULL REFERENCES client_opportunities(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','SENT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index for opportunity deduplication
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_source_external_id_unique ON opportunities(source_id, external_id) WHERE source_id IS NOT NULL AND external_id IS NOT NULL;

-- Initial Seed Data
INSERT INTO profiles (id, name, role, status, opportunity_count) VALUES
  ('revops', 'RevOps Consultant', 'HubSpot & GTM systems', 'Active', 18),
  ('fullstack', 'Full Stack Developer', 'TypeScript & product engineering', 'Active', 12),
  ('automation', 'Automation Specialist', 'Make, AI workflows & ops', 'Paused', 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profile_preferences (profile_id, target_titles, preferred_kinds, remote_only, min_match_score, skills, min_hourly_rate, min_annual_comp, work_authorization, availability) VALUES
  ('revops', ARRAY['Revenue Operations Manager', 'HubSpot Consultant', 'GTM Architect'], ARRAY['job', 'contract', 'client'], TRUE, 80, ARRAY['HubSpot', 'Salesforce', 'Zapier', 'Revenue Architecture', 'GTM Systems'], 90, 140000, ARRAY['US Citizen', 'Contractor C2C'], 'Immediate'),
  ('fullstack', ARRAY['Full Stack Engineer', 'Staff Engineer', 'Product Engineer'], ARRAY['job', 'contract'], TRUE, 80, ARRAY['TypeScript', 'Next.js', 'React', 'Node.js', 'PostgreSQL', 'Tailwind'], 100, 150000, ARRAY['US Citizen', 'Green Card'], '2 weeks'),
  ('automation', ARRAY['Automation Specialist', 'AI Workflow Architect'], ARRAY['contract', 'client'], TRUE, 75, ARRAY['Make.com', 'OpenAI API', 'n8n', 'Zapier', 'Python'], 75, 120000, ARRAY['Contractor C2C'], 'Immediate')
ON CONFLICT (profile_id) DO NOTHING;

INSERT INTO sources (id, name, connector_type, status, last_ingested_at, records_ingested) VALUES
  ('manual-import', 'Manual opportunity import', 'MANUAL', 'ACTIVE', NOW(), 5),
  ('greenhouse:linear', 'Greenhouse: Linear', 'GREENHOUSE', 'ACTIVE', NOW(), 14),
  ('ashby:posthog', 'Ashby: PostHog', 'ASHBY', 'ACTIVE', NOW(), 8),
  ('lever:figma', 'Lever: Figma', 'LEVER', 'ACTIVE', NOW(), 12)
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_agents (profile_id, name, connector_type, board_token, query_params) VALUES
  ('revops', 'Linear RevOps Monitor', 'GREENHOUSE', 'linear', '{"keywords": ["revenue", "revops", "operations", "hubspot"]}'),
  ('fullstack', 'PostHog Product Engineering', 'ASHBY', 'posthog', '{"keywords": ["engineer", "full stack", "typescript", "product"]}'),
  ('revops', 'Figma GTM Systems', 'LEVER', 'figma', '{"keywords": ["gtm", "operations", "salesforce", "hubspot"]}')
ON CONFLICT DO NOTHING;

INSERT INTO opportunities (id, kind, title, company, location, compensation, match_score, freshness, source, confidence, reasons, source_id, external_id) VALUES
  ('opp-1', 'job', 'Senior Revenue Operations Manager', 'Linear', 'Remote · US', '$135k–$165k', 94, 'Posted 2h ago', 'Greenhouse', 'High', ARRAY['HubSpot workflow experience', 'Remote preference matches', 'Seniority aligned', 'Comp meets minimum'], 'greenhouse:linear', 'linear-revops-1'),
  ('opp-2', 'contract', 'HubSpot migration & lifecycle build', 'Fable', 'Remote · Contract', '$75–$95/hr', 89, 'Posted 5h ago', 'Company careers', 'High', ARRAY['Service profile: HubSpot consulting', 'Similar project evidence', 'Rate meets minimum'], 'manual-import', 'fable-hubspot-2'),
  ('opp-3', 'client', 'Likely CRM scaling requirement', 'Arcade', 'San Francisco · Remote', 'Estimated $12k–$30k project', 86, 'New signal today', 'Career graph', 'Medium', ARRAY['Hiring RevOps roles', 'HubSpot detected', 'Headcount signal in ICP'], 'manual-import', 'arcade-client-3'),
  ('opp-4', 'job', 'Staff Full Stack Engineer', 'PostHog', 'Remote · Global', '$120k–$175k', 83, 'Posted 1d ago', 'Ashby', 'High', ARRAY['TypeScript stack', 'Remote eligibility', 'Product experience', 'Node.js & Next.js verified'], 'ashby:posthog', 'posthog-fs-4')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profile_opportunities (profile_id, opportunity_id, status) VALUES
  ('revops', 'opp-1', 'RECOMMENDED'),
  ('revops', 'opp-2', 'SAVED'),
  ('revops', 'opp-3', 'RECOMMENDED'),
  ('fullstack', 'opp-4', 'APPLICATION_PREPARING'),
  ('fullstack', 'opp-1', 'RECOMMENDED'),
  ('automation', 'opp-2', 'RECOMMENDED'),
  ('automation', 'opp-3', 'SAVED')
ON CONFLICT DO NOTHING;

-- Seed Service Profiles & Companies for Client Pipeline
DO $$
DECLARE
  v_revops_service UUID;
  v_arcade_co UUID;
  v_resend_co UUID;
  v_co_opp1 UUID;
  v_co_opp2 UUID;
BEGIN
  INSERT INTO service_profiles (profile_id, name, description, target_industries)
  VALUES ('revops', 'HubSpot & GTM Systems Architecture', 'Full lifecycle CRM design, attribution modeling, and automated sales pipeline infrastructure for B2B SaaS.', ARRAY['B2B SaaS', 'Fintech', 'Developer Tools'])
  RETURNING id INTO v_revops_service;

  INSERT INTO companies (name, domain, industry, employee_range)
  VALUES ('Arcade', 'arcade.software', 'Developer Tools', '11-50')
  ON CONFLICT (domain) DO UPDATE SET name=EXCLUDED.name
  RETURNING id INTO v_arcade_co;

  INSERT INTO companies (name, domain, industry, employee_range)
  VALUES ('Resend', 'resend.com', 'Developer Infrastructure', '1-10')
  ON CONFLICT (domain) DO UPDATE SET name=EXCLUDED.name
  RETURNING id INTO v_resend_co;

  INSERT INTO client_opportunities (profile_id, company_id, service_profile_id, title, score, status, facts, inference)
  VALUES (
    'revops',
    v_arcade_co,
    v_revops_service,
    'HubSpot Lifecycle & Multi-Channel Pipeline Overhaul',
    92,
    'OUTREACH_READY',
    '["Hiring first 2 Enterprise AEs", "Using HubSpot CRM with no dedicated RevOps hire", "Raised $15M Series A 3 months ago", "Recent 40% headcount expansion in sales"]'::jsonb,
    'Likely facing attribution friction, lead routing leakage, and CRM cleanup needs as new sales reps onboard without full-time ops bandwidth.'
  ) RETURNING id INTO v_co_opp1;

  INSERT INTO client_opportunities (profile_id, company_id, service_profile_id, title, score, status, facts, inference)
  VALUES (
    'revops',
    v_resend_co,
    v_revops_service,
    'Inbound Qualification & Billing Automation Bridge',
    88,
    'DISCOVERED',
    '["Rapid self-serve volume growth", "Stripe billing integration with custom CRM sync", "Developer documentation mentions webhook ingestion"]'::jsonb,
    'High potential for automated deal scoring, churn prevention alerts, and Stripe-to-CRM reconciliation workflows.'
  ) RETURNING id INTO v_co_opp2;

  INSERT INTO contacts (company_id, email, full_name, title, consent_status)
  VALUES (v_arcade_co, 'alex@arcade.software', 'Alex Miller', 'VP of Growth', 'PERMITTED')
  ON CONFLICT (email) DO NOTHING;

  INSERT INTO outreach_drafts (client_opportunity_id, subject, body, status)
  VALUES (
    v_co_opp1,
    'RevOps infrastructure for Arcade''s enterprise expansion',
    'Hi Alex,\n\nSaw you''re scaling out your Enterprise sales team following the Series A. With new AEs joining, CRM lead routing, lifecycle attribution, and Stripe-HubSpot sync often become bottlenecks without a dedicated in-house ops team.\n\nI specialize in turnkey RevOps architecture for fast-growing DevTool companies. Happy to share a quick 1-pager on how we resolved similar routing issues for high-velocity teams.\n\nBest,\nShiv',
    'DRAFT'
  );
END $$;
