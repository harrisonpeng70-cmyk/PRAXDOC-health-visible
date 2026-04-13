-- 健康可见 1.0 云端公共知识库 v1.1
-- 最小种子数据（可用于联调与验收）
-- 依赖：先执行 健康可见_1.0_知识库_数据库迁移_v1.1.sql

BEGIN;

-- 固定测试租户
-- tenant_id: 00000000-0000-0000-0000-000000000001

DELETE FROM kb_hit_logs          WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_query_logs        WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_audit_logs        WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_jobs              WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_conflicts         WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_review_tasks      WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_snapshots         WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_entry_versions    WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_entries           WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_documents         WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_sources           WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_source_whitelist  WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM kb_tenants           WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO kb_tenants (
  tenant_id, tenant_code, tenant_name, status
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'health-visible-dev',
  '健康可见开发租户',
  'active'
);

INSERT INTO kb_source_whitelist (
  tenant_id, source_name, source_domain, source_type, trust_level, enabled, created_by
) VALUES
('00000000-0000-0000-0000-000000000001', 'WHO',                'who.int',              'guideline', 5, true, 'seed_admin'),
('00000000-0000-0000-0000-000000000001', 'NIH',                'nih.gov',              'database',  5, true, 'seed_admin'),
('00000000-0000-0000-0000-000000000001', 'Cochrane Library',   'cochranelibrary.com',  'journal',   5, true, 'seed_admin'),
('00000000-0000-0000-0000-000000000001', 'CDC',                'cdc.gov',              'guideline', 5, true, 'seed_admin');

INSERT INTO kb_sources (
  source_id, tenant_id, source_name, source_domain, source_type,
  publication_org, publication_date, source_version, source_url,
  checksum, is_whitelisted, pollution_risk_score, created_by
) VALUES
(
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'WHO Guideline 2025',
  'who.int',
  'guideline',
  'WHO',
  '2025-02-01',
  'v2025.02',
  'https://www.who.int',
  'seed-who-2025',
  true,
  0.0200,
  'seed_admin'
),
(
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'NIH Mechanism Review',
  'nih.gov',
  'database',
  'NIH',
  '2024-09-15',
  'v2024.09',
  'https://www.nih.gov',
  'seed-nih-2024',
  true,
  0.0300,
  'seed_admin'
),
(
  '00000000-0000-0000-0001-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Lifestyle Medicine Evidence Pack',
  'cochranelibrary.com',
  'journal',
  'Cochrane',
  '2024-06-10',
  'v2024.06',
  'https://www.cochranelibrary.com',
  'seed-cochrane-2024',
  true,
  0.0600,
  'seed_admin'
);

INSERT INTO kb_documents (
  document_id, tenant_id, source_id, title, language, raw_storage_uri,
  parser_version, chunk_strategy, chunk_count, publication_date, created_by
) VALUES
(
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000001',
  'Type 2 Diabetes Guideline 2025',
  'en',
  's3://health-visible-dev/kb/who-dm-2025.pdf',
  'parser-1.4.2',
  'section_paragraph',
  48,
  '2025-02-01',
  'seed_admin'
),
(
  '00000000-0000-0000-0002-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000002',
  'Inflammation and Insulin Resistance Review',
  'en',
  's3://health-visible-dev/kb/nih-inflammation-2024.pdf',
  'parser-1.4.2',
  'section_paragraph',
  32,
  '2024-09-15',
  'seed_admin'
),
(
  '00000000-0000-0000-0002-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000003',
  'Lifestyle Intervention Summary',
  'en',
  's3://health-visible-dev/kb/lifestyle-pack-2024.pdf',
  'parser-1.4.2',
  'section_paragraph',
  26,
  '2024-06-10',
  'seed_admin'
);

INSERT INTO kb_entries (
  entry_id, tenant_id, kb_id, layer, claim_type, topic, tags, current_version_no, is_active, created_by
) VALUES
(
  '00000000-0000-0000-0100-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'KB-L1-DM-0001',
  'L1',
  'judgment',
  'type2_diabetes_screening',
  ARRAY['endocrine', 'screening'],
  1,
  true,
  'seed_admin'
),
(
  '00000000-0000-0000-0100-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'KB-L1-DM-0002',
  'L1',
  'procedure',
  'glucose_followup_pathway',
  ARRAY['endocrine', 'followup'],
  1,
  true,
  'seed_admin'
),
(
  '00000000-0000-0000-0100-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'KB-L2-IMM-0001',
  'L2',
  'judgment',
  'inflammation_insulin_resistance',
  ARRAY['immunology', 'mechanism'],
  1,
  true,
  'seed_admin'
),
(
  '00000000-0000-0000-0100-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'KB-L3-LF-0001',
  'L3',
  'procedure',
  'lifestyle_sleep_diet_activity',
  ARRAY['lifestyle', 'sleep', 'nutrition'],
  1,
  true,
  'seed_admin'
),
(
  '00000000-0000-0000-0100-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'KB-L3-FM-0002',
  'L3',
  'procedure',
  'micronutrient_support_assessment',
  ARRAY['functional', 'supplement'],
  2,
  true,
  'seed_admin'
);

INSERT INTO kb_entry_versions (
  version_id, entry_id, tenant_id, version_no,
  statement, applicability, contraindication, evidence_level, confidence_score,
  source_name, source_url, source_version, publication_date, citation_span, checksum,
  review_status, reviewer, review_notes, approved_at,
  valid_from, valid_to,
  tsv,
  created_by
) VALUES
(
  '00000000-0000-0000-0200-000000000001',
  '00000000-0000-0000-0100-000000000001',
  '00000000-0000-0000-0000-000000000001',
  1,
  '成人空腹血糖异常且伴危险因素时，建议进入分层筛查流程。',
  '18岁以上，存在代谢风险人群。',
  '妊娠期人群需走专门流程。',
  'A',
  0.95,
  'WHO Guideline 2025',
  'https://www.who.int',
  'v2025.02',
  '2025-02-01',
  'Sec 3.2 para 2',
  'ver-1',
  'approved',
  'doctor_lee',
  'source verified',
  '2026-04-10T08:00:00Z',
  '2026-04-10T00:00:00Z',
  NULL,
  to_tsvector('simple', 'type2 diabetes screening guideline'),
  'seed_admin'
),
(
  '00000000-0000-0000-0200-000000000002',
  '00000000-0000-0000-0100-000000000002',
  '00000000-0000-0000-0000-000000000001',
  1,
  '血糖异常复测应结合时间窗、症状变化与并发风险进行任务化随访。',
  '首诊后1-4周随访人群。',
  '急性症状恶化需转急诊流程。',
  'A',
  0.92,
  'WHO Guideline 2025',
  'https://www.who.int',
  'v2025.02',
  '2025-02-01',
  'Sec 4.1 para 1',
  'ver-2',
  'approved',
  'doctor_lee',
  'workflow aligned',
  '2026-04-10T08:05:00Z',
  '2026-04-10T00:00:00Z',
  NULL,
  to_tsvector('simple', 'followup pathway glucose abnormal'),
  'seed_admin'
),
(
  '00000000-0000-0000-0200-000000000003',
  '00000000-0000-0000-0100-000000000003',
  '00000000-0000-0000-0000-000000000001',
  1,
  '慢性炎症介导的胰岛素信号通路改变，可解释部分血糖异常与症状共现。',
  '用于机制解释与关联分析。',
  '不可直接替代临床诊断结论。',
  'B',
  0.86,
  'NIH Mechanism Review',
  'https://www.nih.gov',
  'v2024.09',
  '2024-09-15',
  'Chapter 2',
  'ver-3',
  'approved',
  'reviewer_wang',
  'mechanism tier approved',
  '2026-04-10T08:10:00Z',
  '2026-04-10T00:00:00Z',
  NULL,
  to_tsvector('simple', 'inflammation insulin resistance mechanism'),
  'seed_admin'
),
(
  '00000000-0000-0000-0200-000000000004',
  '00000000-0000-0000-0100-000000000004',
  '00000000-0000-0000-0000-000000000001',
  1,
  '睡眠、饮食、活动三联干预可作为探索性支持手段，需结合临床主线。',
  '生活方式管理阶段。',
  '不应替代一线临床治疗方案。',
  'B',
  0.78,
  'Lifestyle Medicine Evidence Pack',
  'https://www.cochranelibrary.com',
  'v2024.06',
  '2024-06-10',
  'Page 8',
  'ver-4',
  'approved',
  'reviewer_wang',
  'l3 exploratory approved',
  '2026-04-10T08:12:00Z',
  '2026-04-10T00:00:00Z',
  NULL,
  to_tsvector('simple', 'sleep diet activity lifestyle intervention'),
  'seed_admin'
),
(
  '00000000-0000-0000-0200-000000000005',
  '00000000-0000-0000-0100-000000000005',
  '00000000-0000-0000-0000-000000000001',
  1,
  '部分微量营养素评估可作为补充信息输入，但证据等级有限。',
  '营养评估阶段。',
  '存在药物相互作用风险时需先临床评估。',
  'C',
  0.66,
  'Lifestyle Medicine Evidence Pack',
  'https://www.cochranelibrary.com',
  'v2024.06',
  '2024-06-10',
  'Page 12',
  'ver-5',
  'approved',
  'reviewer_wang',
  'baseline approved',
  '2026-04-10T08:15:00Z',
  '2026-04-10T00:00:00Z',
  NULL,
  to_tsvector('simple', 'micronutrient assessment supportive evidence'),
  'seed_admin'
),
(
  '00000000-0000-0000-0200-000000000006',
  '00000000-0000-0000-0100-000000000005',
  '00000000-0000-0000-0000-000000000001',
  2,
  '微量营养素补充方案应个体化，并在冲突证据下保守处理。',
  '需要二次审核的探索性条目。',
  '肝肾功能异常与妊娠人群禁用未经确认方案。',
  'C',
  0.60,
  'Lifestyle Medicine Evidence Pack',
  'https://www.cochranelibrary.com',
  'v2024.06',
  '2024-06-10',
  'Page 15',
  'ver-6',
  'reviewing',
  NULL,
  'awaiting conflict review',
  NULL,
  NULL,
  NULL,
  to_tsvector('simple', 'micronutrient individualized conservative'),
  'seed_admin'
);

INSERT INTO kb_conflicts (
  conflict_id, tenant_id, topic, version_id_a, version_id_b, conflict_type, severity,
  resolution_status, resolution_notes, created_at
) VALUES (
  '00000000-0000-0000-0300-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'micronutrient_support_assessment',
  '00000000-0000-0000-0200-000000000003',
  '00000000-0000-0000-0200-000000000006',
  'incompatible_method',
  3,
  'open',
  'L2 mechanism caution vs L3 procedure extension requires manual adjudication',
  now()
);

INSERT INTO kb_jobs (
  job_id, tenant_id, job_type, status, progress, request_payload, result_payload, created_by
) VALUES (
  '00000000-0000-0000-0400-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'ingest',
  'succeeded',
  100.00,
  '{"source_id":"00000000-0000-0000-0001-000000000001"}'::jsonb,
  '{"document_id":"00000000-0000-0000-0002-000000000001"}'::jsonb,
  'seed_admin'
);

INSERT INTO kb_query_logs (
  query_id, tenant_id, actor_type, actor_id, client_id, query_text, query_filters, top_k, latency_ms, result_type
) VALUES (
  '00000000-0000-0000-0500-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'doctor',
  'doctor_zhang',
  'client_123',
  '空腹血糖升高并伴体重下降如何分层处理',
  '{"layers":["L1","L2","L3"],"claim_types":["judgment","procedure"]}'::jsonb,
  5,
  128,
  'success'
);

INSERT INTO kb_hit_logs (
  hit_id, query_id, tenant_id, version_id, rank_no,
  score_struct, score_keyword, score_vector, score_quality, score_final,
  layer_weight, evidence_weight, conflict_penalty
) VALUES
(
  '00000000-0000-0000-0600-000000000001',
  '00000000-0000-0000-0500-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0200-000000000001',
  1,
  0.88, 0.74, 0.81, 0.90, 0.846,
  1.00, 1.00, 1.00
),
(
  '00000000-0000-0000-0600-000000000002',
  '00000000-0000-0000-0500-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0200-000000000003',
  2,
  0.70, 0.61, 0.73, 0.82, 0.536,
  0.80, 0.85, 1.00
);

INSERT INTO kb_audit_logs (
  audit_id, tenant_id, audit_trail_id, actor_type, actor_id, action_type,
  target_object_type, target_object_id, result_type, request_payload, response_payload
) VALUES
(
  '00000000-0000-0000-0700-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'trail-seed-001',
  'admin',
  'seed_admin',
  'ingest',
  'source',
  '00000000-0000-0000-0001-000000000001',
  'success',
  '{"action":"create_source"}'::jsonb,
  '{"source_id":"00000000-0000-0000-0001-000000000001"}'::jsonb
),
(
  '00000000-0000-0000-0700-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'trail-seed-002',
  'reviewer',
  'doctor_lee',
  'approve',
  'version',
  '00000000-0000-0000-0200-000000000001',
  'success',
  '{"action":"approve_version"}'::jsonb,
  '{"review_status":"approved"}'::jsonb
),
(
  '00000000-0000-0000-0700-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'trail-seed-003',
  'doctor',
  'doctor_zhang',
  'query',
  'query',
  '00000000-0000-0000-0500-000000000001',
  'success',
  '{"query_text":"空腹血糖升高并伴体重下降如何分层处理"}'::jsonb,
  '{"top_hit":"KB-L1-DM-0001"}'::jsonb
);

COMMIT;
