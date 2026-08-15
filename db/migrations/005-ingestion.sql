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
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_id TEXT REFERENCES sources(id);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_source_external_id_unique ON opportunities(source_id, external_id) WHERE source_id IS NOT NULL AND external_id IS NOT NULL;
INSERT INTO sources (id, name, connector_type) VALUES ('manual-import', 'Manual opportunity import', 'MANUAL') ON CONFLICT (id) DO NOTHING;
