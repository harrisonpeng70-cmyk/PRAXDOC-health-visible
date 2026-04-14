-- 健康可见 1.0 云端公共知识库 v1.1
-- 数据库迁移脚本（PostgreSQL 15+）

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kb_layer') THEN
    CREATE TYPE kb_layer AS ENUM ('L1', 'L2', 'L3');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kb_claim_type') THEN
    CREATE TYPE kb_claim_type AS ENUM ('judgment', 'procedure');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kb_review_status') THEN
    CREATE TYPE kb_review_status AS ENUM ('draft', 'reviewing', 'approved', 'rejected', 'deprecated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kb_result_type') THEN
    CREATE TYPE kb_result_type AS ENUM ('success', 'partial', 'failed', 'manual_needed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kb_job_status') THEN
    CREATE TYPE kb_job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');
  END IF;
END$$;

CREATE OR REPLACE FUNCTION kb_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS kb_tenants (
  tenant_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code          TEXT UNIQUE NOT NULL,
  tenant_name          TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_source_whitelist (
  id                   BIGSERIAL PRIMARY KEY,
  tenant_id            UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  source_name          TEXT NOT NULL,
  source_domain        TEXT NOT NULL,
  source_type          TEXT NOT NULL,
  trust_level          SMALLINT NOT NULL CHECK (trust_level BETWEEN 1 AND 5),
  enabled              BOOLEAN NOT NULL DEFAULT true,
  effective_from       DATE,
  effective_to         DATE,
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_domain)
);

CREATE TABLE IF NOT EXISTS kb_runtime_policies (
  tenant_id            UUID PRIMARY KEY REFERENCES kb_tenants(tenant_id),
  ingest_policy        JSONB NOT NULL,
  retrieve_policy      JSONB NOT NULL,
  updated_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'kb_runtime_policies_set_updated_at'
  ) THEN
    CREATE TRIGGER kb_runtime_policies_set_updated_at
    BEFORE UPDATE ON kb_runtime_policies
    FOR EACH ROW
    EXECUTE FUNCTION kb_set_updated_at();
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS kb_sources (
  source_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  source_name          TEXT NOT NULL,
  source_domain        TEXT NOT NULL,
  source_type          TEXT NOT NULL,
  publication_org      TEXT,
  publication_date     DATE,
  source_version       TEXT,
  source_url           TEXT NOT NULL,
  checksum             TEXT,
  is_whitelisted       BOOLEAN NOT NULL,
  pollution_risk_score NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (pollution_risk_score BETWEEN 0 AND 1),
  ingest_date          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_sources_tenant_domain
  ON kb_sources (tenant_id, source_domain);

CREATE TABLE IF NOT EXISTS kb_documents (
  document_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  source_id            UUID NOT NULL REFERENCES kb_sources(source_id),
  title                TEXT NOT NULL,
  language             TEXT NOT NULL DEFAULT 'zh-CN',
  raw_storage_uri      TEXT NOT NULL,
  parser_version       TEXT,
  chunk_strategy       TEXT,
  chunk_count          INT NOT NULL DEFAULT 0,
  publication_date     DATE,
  ingest_date          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_tenant_source
  ON kb_documents (tenant_id, source_id);

CREATE TABLE IF NOT EXISTS kb_entries (
  entry_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  kb_id                TEXT NOT NULL,
  layer                kb_layer NOT NULL,
  claim_type           kb_claim_type NOT NULL,
  topic                TEXT NOT NULL,
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  current_version_no   INT NOT NULL DEFAULT 1,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kb_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_entries_tenant_layer_topic
  ON kb_entries (tenant_id, layer, topic);

CREATE TABLE IF NOT EXISTS kb_entry_versions (
  version_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id                UUID NOT NULL REFERENCES kb_entries(entry_id),
  tenant_id               UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  version_no              INT NOT NULL,
  statement               TEXT NOT NULL,
  applicability           TEXT,
  contraindication        TEXT,
  evidence_level          TEXT NOT NULL,
  confidence_score        NUMERIC(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  source_name             TEXT NOT NULL,
  source_url              TEXT NOT NULL,
  source_version          TEXT,
  publication_date        DATE,
  citation_span           TEXT,
  checksum                TEXT,
  review_status           kb_review_status NOT NULL DEFAULT 'draft',
  reviewer                TEXT,
  review_notes            TEXT,
  approved_at             TIMESTAMPTZ,
  supersedes_version_id   UUID NULL REFERENCES kb_entry_versions(version_id),
  valid_from              TIMESTAMPTZ,
  valid_to                TIMESTAMPTZ,
  embedding               vector(1536),
  tsv                     tsvector,
  created_by              TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, version_no),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_kb_entry_versions_tenant_status
  ON kb_entry_versions (tenant_id, review_status, publication_date DESC);

CREATE INDEX IF NOT EXISTS idx_kb_entry_versions_tsv
  ON kb_entry_versions USING GIN (tsv);

CREATE INDEX IF NOT EXISTS idx_kb_entry_versions_embedding
  ON kb_entry_versions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_kb_entry_versions_online
  ON kb_entry_versions (tenant_id, review_status, valid_from, valid_to)
  WHERE review_status = 'approved';

CREATE TABLE IF NOT EXISTS kb_conflicts (
  conflict_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  topic                 TEXT NOT NULL,
  version_id_a          UUID NOT NULL REFERENCES kb_entry_versions(version_id),
  version_id_b          UUID NOT NULL REFERENCES kb_entry_versions(version_id),
  conflict_type         TEXT NOT NULL,
  severity              SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  resolution_status     TEXT NOT NULL DEFAULT 'open',
  resolution_notes      TEXT,
  resolved_by           TEXT,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_conflicts_tenant_status
  ON kb_conflicts (tenant_id, resolution_status, severity DESC);

CREATE TABLE IF NOT EXISTS kb_review_tasks (
  task_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  version_id            UUID NOT NULL REFERENCES kb_entry_versions(version_id),
  assignee              TEXT NOT NULL,
  task_status           TEXT NOT NULL DEFAULT 'open',
  due_at                TIMESTAMPTZ,
  created_by            TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_snapshots (
  snapshot_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  snapshot_name         TEXT NOT NULL,
  snapshot_type         TEXT NOT NULL DEFAULT 'release',
  based_on_time         TIMESTAMPTZ NOT NULL,
  released_by           TEXT NOT NULL,
  released_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                 TEXT,
  UNIQUE (tenant_id, snapshot_name)
);

CREATE TABLE IF NOT EXISTS kb_query_logs (
  query_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  actor_type            TEXT NOT NULL,
  actor_id              TEXT,
  client_id             TEXT,
  query_text            TEXT,
  query_filters         JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_k                 INT NOT NULL DEFAULT 10,
  latency_ms            INT,
  result_type           kb_result_type NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_query_logs_tenant_time
  ON kb_query_logs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS kb_hit_logs (
  hit_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id              UUID NOT NULL REFERENCES kb_query_logs(query_id),
  tenant_id             UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  version_id            UUID NOT NULL REFERENCES kb_entry_versions(version_id),
  rank_no               INT NOT NULL,
  score_struct          NUMERIC(8,6),
  score_keyword         NUMERIC(8,6),
  score_vector          NUMERIC(8,6),
  score_quality         NUMERIC(8,6),
  score_final           NUMERIC(8,6),
  layer_weight          NUMERIC(8,6),
  evidence_weight       NUMERIC(8,6),
  conflict_penalty      NUMERIC(8,6),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_hit_logs_query_rank
  ON kb_hit_logs (query_id, rank_no);

CREATE TABLE IF NOT EXISTS kb_audit_logs (
  audit_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  audit_trail_id        TEXT NOT NULL,
  actor_type            TEXT NOT NULL,
  actor_id              TEXT,
  action_type           TEXT NOT NULL,
  target_object_type    TEXT NOT NULL,
  target_object_id      TEXT NOT NULL,
  result_type           kb_result_type NOT NULL,
  request_payload       JSONB,
  response_payload      JSONB,
  error_code            TEXT,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_audit_logs_tenant_trail
  ON kb_audit_logs (tenant_id, audit_trail_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_audit_logs_tenant_action_time
  ON kb_audit_logs (tenant_id, action_type, created_at DESC);

CREATE TABLE IF NOT EXISTS kb_jobs (
  job_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES kb_tenants(tenant_id),
  job_type               TEXT NOT NULL,
  status                 kb_job_status NOT NULL DEFAULT 'queued',
  progress               NUMERIC(5,2) NOT NULL DEFAULT 0,
  request_payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload         JSONB,
  error_message          TEXT,
  started_at             TIMESTAMPTZ,
  finished_at            TIMESTAMPTZ,
  created_by             TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_jobs_tenant_status
  ON kb_jobs (tenant_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_kb_tenants_updated_at ON kb_tenants;
CREATE TRIGGER trg_kb_tenants_updated_at
BEFORE UPDATE ON kb_tenants
FOR EACH ROW EXECUTE FUNCTION kb_set_updated_at();

DROP TRIGGER IF EXISTS trg_kb_entries_updated_at ON kb_entries;
CREATE TRIGGER trg_kb_entries_updated_at
BEFORE UPDATE ON kb_entries
FOR EACH ROW EXECUTE FUNCTION kb_set_updated_at();

DROP TRIGGER IF EXISTS trg_kb_entry_versions_updated_at ON kb_entry_versions;
CREATE TRIGGER trg_kb_entry_versions_updated_at
BEFORE UPDATE ON kb_entry_versions
FOR EACH ROW EXECUTE FUNCTION kb_set_updated_at();

DROP TRIGGER IF EXISTS trg_kb_review_tasks_updated_at ON kb_review_tasks;
CREATE TRIGGER trg_kb_review_tasks_updated_at
BEFORE UPDATE ON kb_review_tasks
FOR EACH ROW EXECUTE FUNCTION kb_set_updated_at();

CREATE OR REPLACE VIEW kb_online_entry_versions AS
SELECT
  e.tenant_id,
  e.entry_id,
  e.kb_id,
  e.layer,
  e.claim_type,
  e.topic,
  v.version_id,
  v.version_no,
  v.statement,
  v.applicability,
  v.contraindication,
  v.evidence_level,
  v.confidence_score,
  v.source_name,
  v.source_url,
  v.source_version,
  v.publication_date,
  v.citation_span,
  v.valid_from,
  v.valid_to,
  v.embedding,
  v.tsv
FROM kb_entries e
JOIN kb_entry_versions v ON v.entry_id = e.entry_id
WHERE e.is_active = true
  AND v.review_status = 'approved'
  AND (v.valid_from IS NULL OR v.valid_from <= now())
  AND (v.valid_to IS NULL OR v.valid_to > now());

COMMIT;
