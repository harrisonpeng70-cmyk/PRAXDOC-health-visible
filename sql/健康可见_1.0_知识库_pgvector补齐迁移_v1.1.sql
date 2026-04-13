-- 健康可见 1.0 云端公共知识库 v1.1
-- pgvector 补齐迁移脚本
-- 使用时机：已在 PostgreSQL 主机安装 pgvector 扩展后

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- 为避免数组->vector 强转兼容差异，采用旁路列替换
ALTER TABLE kb_entry_versions
  ADD COLUMN IF NOT EXISTS embedding_new vector(1536);

-- 如历史 embedding(double precision[]) 有值，可在应用层批量重算后写入 embedding_new
-- 当前默认不做强转，避免迁移中断

ALTER TABLE kb_entry_versions
  DROP COLUMN IF EXISTS embedding;

ALTER TABLE kb_entry_versions
  RENAME COLUMN embedding_new TO embedding;

CREATE INDEX IF NOT EXISTS idx_kb_entry_versions_embedding
  ON kb_entry_versions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMIT;
