-- 健康可见 1.0 云端公共知识库
-- 关键查询 SQL 模板 v1.1
-- 说明：参数以 :param 形式表示（按你的 ORM/驱动替换）

-- 1) 来源白名单校验
SELECT EXISTS (
  SELECT 1
  FROM kb_source_whitelist w
  WHERE w.tenant_id = :tenant_id
    AND w.source_domain = :source_domain
    AND w.enabled = true
    AND (w.effective_from IS NULL OR w.effective_from <= current_date)
    AND (w.effective_to   IS NULL OR w.effective_to   >= current_date)
) AS is_whitelisted;

-- 2) 创建来源
INSERT INTO kb_sources (
  source_id, tenant_id, source_name, source_domain, source_type,
  publication_org, publication_date, source_version, source_url,
  checksum, is_whitelisted, pollution_risk_score, created_by
) VALUES (
  gen_random_uuid(), :tenant_id, :source_name, :source_domain, :source_type,
  :publication_org, :publication_date, :source_version, :source_url,
  :checksum, :is_whitelisted, :pollution_risk_score, :actor_id
)
RETURNING source_id, is_whitelisted, pollution_risk_score, ingest_date;

-- 3) 创建条目（entry + 首版 version）事务模板
-- BEGIN;
INSERT INTO kb_entries (
  entry_id, tenant_id, kb_id, layer, claim_type, topic, tags, current_version_no, is_active, created_by
) VALUES (
  gen_random_uuid(), :tenant_id, :kb_id, :layer, :claim_type, :topic, :tags, 1, true, :actor_id
)
RETURNING entry_id;

INSERT INTO kb_entry_versions (
  version_id, entry_id, tenant_id, version_no,
  statement, applicability, contraindication, evidence_level, confidence_score,
  source_name, source_url, source_version, publication_date, citation_span, checksum,
  review_status, created_by, tsv
) VALUES (
  gen_random_uuid(), :entry_id, :tenant_id, 1,
  :statement, :applicability, :contraindication, :evidence_level, :confidence_score,
  :source_name, :source_url, :source_version, :publication_date, :citation_span, :checksum,
  'draft', :actor_id, to_tsvector('simple', coalesce(:statement, '') || ' ' || coalesce(:topic, ''))
)
RETURNING version_id, version_no, review_status;
-- COMMIT;

-- 4) 新增版本（递增版本号）
WITH next_no AS (
  SELECT coalesce(max(version_no), 0) + 1 AS version_no
  FROM kb_entry_versions
  WHERE entry_id = :entry_id
)
INSERT INTO kb_entry_versions (
  version_id, entry_id, tenant_id, version_no,
  statement, applicability, contraindication, evidence_level, confidence_score,
  source_name, source_url, source_version, publication_date, citation_span, checksum,
  supersedes_version_id, review_status, created_by, tsv
)
SELECT
  gen_random_uuid(), :entry_id, :tenant_id, next_no.version_no,
  :statement, :applicability, :contraindication, :evidence_level, :confidence_score,
  :source_name, :source_url, :source_version, :publication_date, :citation_span, :checksum,
  :supersedes_version_id, 'reviewing', :actor_id,
  to_tsvector('simple', coalesce(:statement, ''))
FROM next_no
RETURNING version_id, version_no, review_status;

-- 5) 审核通过
UPDATE kb_entry_versions
SET
  review_status = 'approved',
  reviewer = :reviewer,
  review_notes = :review_notes,
  approved_at = now(),
  valid_from = coalesce(:valid_from, now()),
  valid_to = :valid_to
WHERE version_id = :version_id
  AND tenant_id = :tenant_id
RETURNING version_id, review_status, reviewer, approved_at;

-- 6) 审核拒绝
UPDATE kb_entry_versions
SET
  review_status = 'rejected',
  reviewer = :reviewer,
  review_notes = :review_notes
WHERE version_id = :version_id
  AND tenant_id = :tenant_id
RETURNING version_id, review_status, reviewer;

-- 7) 混合检索（无pgvector占位版）
WITH candidates AS (
  SELECT
    e.entry_id,
    e.kb_id,
    e.layer,
    e.claim_type,
    e.topic,
    v.version_id,
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
    ts_rank(v.tsv, websearch_to_tsquery('simple', :query_text)) AS r_keyword,
    CASE
      WHEN e.topic = ANY(:topics) THEN :r_struct_hit
      ELSE :r_struct_base
    END AS r_struct,
    :r_vector_placeholder::numeric AS r_vector,
    v.confidence_score AS r_quality
  FROM kb_entries e
  JOIN kb_entry_versions v ON v.entry_id = e.entry_id
  WHERE e.tenant_id = :tenant_id
    AND v.review_status = 'approved'
    AND (v.valid_from IS NULL OR v.valid_from <= now())
    AND (v.valid_to   IS NULL OR v.valid_to   > now())
    AND (cardinality(:layers) = 0 OR e.layer = ANY(:layers))
    AND (cardinality(:claim_types) = 0 OR e.claim_type = ANY(:claim_types))
    AND (cardinality(:evidence_levels) = 0 OR v.evidence_level = ANY(:evidence_levels))
),
scored AS (
  SELECT
    *,
    ( :w_struct  * r_struct
    + :w_keyword * r_keyword
    + :w_vector  * r_vector
    + :w_quality * r_quality ) AS s,
    CASE layer
      WHEN 'L1' THEN :wl1
      WHEN 'L2' THEN :wl2
      ELSE :wl3
    END AS w_layer,
    CASE evidence_level
      WHEN 'A' THEN :wea
      WHEN 'B' THEN :web
      ELSE :wec
    END AS w_evidence
  FROM candidates
)
SELECT
  entry_id, version_id, kb_id, layer, claim_type, topic, statement,
  applicability, contraindication, evidence_level, confidence_score,
  source_name, source_url, source_version, publication_date, citation_span,
  r_struct, r_keyword, r_vector, r_quality,
  (s * w_layer * w_evidence) AS score_final
FROM scored
ORDER BY score_final DESC
LIMIT :top_k;

-- 8) 条目详情
SELECT
  e.entry_id, e.kb_id, e.layer, e.claim_type, e.topic, e.tags, e.current_version_no, e.is_active
FROM kb_entries e
WHERE e.tenant_id = :tenant_id
  AND e.entry_id = :entry_id;

-- 9) 版本列表
SELECT
  v.version_id, v.version_no, v.review_status, v.evidence_level,
  v.publication_date, v.created_at, v.updated_at
FROM kb_entry_versions v
WHERE v.tenant_id = :tenant_id
  AND v.entry_id = :entry_id
ORDER BY v.version_no DESC;

-- 10) 冲突列表
SELECT
  conflict_id, topic, conflict_type, severity, resolution_status, created_at
FROM kb_conflicts
WHERE tenant_id = :tenant_id
  AND (:resolution_status IS NULL OR resolution_status = :resolution_status)
  AND (:severity_gte IS NULL OR severity >= :severity_gte)
ORDER BY severity DESC, created_at DESC
LIMIT :limit OFFSET :offset;

-- 11) 审计写入模板
INSERT INTO kb_audit_logs (
  audit_id, tenant_id, audit_trail_id, actor_type, actor_id, action_type,
  target_object_type, target_object_id, result_type,
  request_payload, response_payload, error_code, error_message
) VALUES (
  gen_random_uuid(), :tenant_id, :audit_trail_id, :actor_type, :actor_id, :action_type,
  :target_object_type, :target_object_id, :result_type,
  :request_payload::jsonb, :response_payload::jsonb, :error_code, :error_message
)
RETURNING audit_id, created_at;

-- 12) 审计日志查询
SELECT
  audit_id, audit_trail_id, actor_type, actor_id, action_type,
  target_object_type, target_object_id, result_type, created_at
FROM kb_audit_logs
WHERE tenant_id = :tenant_id
  AND (:from_time IS NULL OR created_at >= :from_time)
  AND (:to_time IS NULL OR created_at <= :to_time)
  AND (:action_type IS NULL OR action_type = :action_type)
ORDER BY created_at DESC
LIMIT :limit OFFSET :offset;
