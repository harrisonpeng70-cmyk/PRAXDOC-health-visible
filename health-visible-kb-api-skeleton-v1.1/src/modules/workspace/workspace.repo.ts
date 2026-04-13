import { query } from "../../config/db";

export type WorkspaceDocument = {
  document_id: string;
  report_type: "checkup" | "lab_test" | "medical_record";
  source_file_name: string;
  report_date: string;
  extraction_status: "succeeded" | "pending";
  sort_at: string;
};

export type WorkspaceDocumentStats = {
  total: number;
  checkup_count: number;
  lab_test_count: number;
  medical_record_count: number;
  latest_report_date: string | null;
  pending_count: number;
};

export type WorkspaceVersion = {
  layer: "L1" | "L2" | "L3";
  claim_type: "judgment" | "procedure";
  kb_id: string;
  statement: string;
  review_status: "draft" | "reviewing" | "approved" | "rejected";
  evidence_level: string;
  sort_at: string;
};

export type WorkspaceTimelineEvent = {
  event_date: string;
  event_type: "checkup" | "lab_test" | "medical_record" | "followup";
  event_title: string;
  event_summary: string;
  sort_at: string;
};

export type WorkspaceChartPoint = {
  report_date: string;
  item_value: number;
};

export type WorkspaceCardsSummary = {
  total_cards: number;
  latest_card_title: string | null;
  updated_at: string | null;
};

export type WorkspaceVersionStats = {
  reviewing_count: number;
  approved_count: number;
  latest_reviewing_at: string | null;
};

export type WorkspaceJobsSummary = {
  open_count: number;
  delayed_count: number;
  done_count: number;
};

export type WorkspaceLatestFeedback = {
  latest_feedback_at: string;
  latest_feedback_hint: string | null;
} | null;

function normalizeReportType(sourceType: string, title: string): "checkup" | "lab_test" | "medical_record" {
  const source = sourceType.toLowerCase();
  if (title.includes("体检") || source === "guideline") {
    return "checkup";
  }
  if (title.includes("检验") || source === "database") {
    return "lab_test";
  }
  return "medical_record";
}

function fileNameFromUri(uri: string, fallback: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    return fallback;
  }
  const parts = trimmed.split("/");
  const last = parts[parts.length - 1];
  return last && last.length > 0 ? last : fallback;
}

export async function listWorkspaceDocuments(tenantId: string, limit = 20): Promise<WorkspaceDocument[]> {
  const result = await query<{
    document_id: string;
    title: string;
    source_type: string;
    raw_storage_uri: string;
    report_date: string;
    extraction_status: "succeeded" | "pending";
    sort_at: string;
  }>(
    `
      SELECT
        d.document_id::text AS document_id,
        d.title,
        s.source_type,
        d.raw_storage_uri,
        to_char(COALESCE(d.publication_date, d.ingest_date::date), 'YYYY-MM-DD') AS report_date,
        CASE WHEN d.chunk_count > 0 THEN 'succeeded' ELSE 'pending' END AS extraction_status,
        COALESCE(d.ingest_date, d.created_at)::text AS sort_at
      FROM kb_documents d
      JOIN kb_sources s ON s.source_id = d.source_id
      WHERE d.tenant_id = $1
      ORDER BY COALESCE(d.publication_date, d.ingest_date::date) DESC, d.created_at DESC
      LIMIT $2
    `,
    [tenantId, limit]
  );

  return result.rows.map((row) => ({
    document_id: row.document_id,
    report_type: normalizeReportType(row.source_type, row.title),
    source_file_name: fileNameFromUri(row.raw_storage_uri, row.title),
    report_date: row.report_date,
    extraction_status: row.extraction_status,
    sort_at: row.sort_at
  }));
}

export async function getWorkspaceDocumentStats(tenantId: string): Promise<WorkspaceDocumentStats> {
  const result = await query<{
    total: string;
    checkup_count: string;
    lab_test_count: string;
    medical_record_count: string;
    latest_report_date: string | null;
    pending_count: string;
  }>(
    `
      WITH typed_docs AS (
        SELECT
          CASE
            WHEN position('体检' in d.title) > 0 OR s.source_type = 'guideline' THEN 'checkup'
            WHEN position('检验' in d.title) > 0 OR s.source_type = 'database' THEN 'lab_test'
            ELSE 'medical_record'
          END AS report_type,
          COALESCE(d.publication_date, d.ingest_date::date) AS report_date,
          d.chunk_count
        FROM kb_documents d
        JOIN kb_sources s ON s.source_id = d.source_id
        WHERE d.tenant_id = $1
      )
      SELECT
        count(*)::text AS total,
        count(*) FILTER (WHERE report_type = 'checkup')::text AS checkup_count,
        count(*) FILTER (WHERE report_type = 'lab_test')::text AS lab_test_count,
        count(*) FILTER (WHERE report_type = 'medical_record')::text AS medical_record_count,
        to_char(max(report_date), 'YYYY-MM-DD') AS latest_report_date,
        count(*) FILTER (WHERE chunk_count = 0)::text AS pending_count
      FROM typed_docs
    `,
    [tenantId]
  );

  const row = result.rows[0];
  return {
    total: Number(row?.total ?? 0),
    checkup_count: Number(row?.checkup_count ?? 0),
    lab_test_count: Number(row?.lab_test_count ?? 0),
    medical_record_count: Number(row?.medical_record_count ?? 0),
    latest_report_date: row?.latest_report_date ?? null,
    pending_count: Number(row?.pending_count ?? 0)
  };
}

export async function listWorkspaceVersions(tenantId: string, limit = 120): Promise<WorkspaceVersion[]> {
  const result = await query<{
    layer: "L1" | "L2" | "L3";
    claim_type: "judgment" | "procedure";
    kb_id: string;
    statement: string;
    review_status: "draft" | "reviewing" | "approved" | "rejected";
    evidence_level: string;
    sort_at: string;
  }>(
    `
      SELECT
        e.layer::text AS layer,
        e.claim_type::text AS claim_type,
        e.kb_id,
        v.statement,
        v.review_status::text AS review_status,
        v.evidence_level,
        COALESCE(v.approved_at, v.created_at)::text AS sort_at
      FROM kb_entries e
      JOIN kb_entry_versions v
        ON v.entry_id = e.entry_id
       AND v.tenant_id = e.tenant_id
      WHERE e.tenant_id = $1
      ORDER BY COALESCE(v.approved_at, v.created_at) DESC
      LIMIT $2
    `,
    [tenantId, limit]
  );

  return result.rows;
}

export async function listWorkspaceTimelineDocumentEvents(
  tenantId: string,
  limit = 8
): Promise<WorkspaceTimelineEvent[]> {
  const result = await query<{
    event_date: string;
    event_type: "checkup" | "lab_test" | "medical_record";
    event_title: string;
    event_summary: string;
    sort_at: string;
  }>(
    `
      SELECT
        to_char(COALESCE(d.publication_date, d.ingest_date::date), 'YYYY-MM-DD') AS event_date,
        CASE
          WHEN position('体检' in d.title) > 0 OR s.source_type = 'guideline' THEN 'checkup'
          WHEN position('检验' in d.title) > 0 OR s.source_type = 'database' THEN 'lab_test'
          ELSE 'medical_record'
        END AS event_type,
        ('资料更新：' || d.title) AS event_title,
        CASE
          WHEN d.chunk_count > 0 THEN '结构化结果已可用，可进入摘要查看。'
          ELSE '结构化待处理或待补录。'
        END AS event_summary,
        COALESCE(d.ingest_date, d.created_at)::text AS sort_at
      FROM kb_documents d
      JOIN kb_sources s ON s.source_id = d.source_id
      WHERE d.tenant_id = $1
      ORDER BY COALESCE(d.ingest_date, d.created_at) DESC
      LIMIT $2
    `,
    [tenantId, limit]
  );

  return result.rows;
}

export async function listWorkspaceTimelineVersionEvents(
  tenantId: string,
  limit = 8
): Promise<WorkspaceTimelineEvent[]> {
  const result = await query<{
    event_date: string;
    event_title: string;
    event_summary: string;
    sort_at: string;
  }>(
    `
      SELECT
        to_char(COALESCE(v.approved_at::date, v.created_at::date), 'YYYY-MM-DD') AS event_date,
        ('知识条目更新：' || e.kb_id) AS event_title,
        left(v.statement, 120) AS event_summary,
        COALESCE(v.approved_at, v.created_at)::text AS sort_at
      FROM kb_entries e
      JOIN kb_entry_versions v
        ON v.entry_id = e.entry_id
       AND v.tenant_id = e.tenant_id
      WHERE e.tenant_id = $1
      ORDER BY COALESCE(v.approved_at, v.created_at) DESC
      LIMIT $2
    `,
    [tenantId, limit]
  );

  return result.rows.map((row) => ({
    event_date: row.event_date,
    event_type: "followup",
    event_title: row.event_title,
    event_summary: row.event_summary,
    sort_at: row.sort_at
  }));
}

export async function listWorkspaceChartSeries(
  tenantId: string,
  clientId: string,
  limit = 6
): Promise<WorkspaceChartPoint[]> {
  const result = await query<{
    report_date: string;
    item_value: string;
  }>(
    `
      SELECT
        to_char(date_trunc('day', q.created_at), 'YYYY-MM-DD') AS report_date,
        avg(h.score_final)::text AS item_value
      FROM kb_query_logs q
      JOIN kb_hit_logs h
        ON h.query_id = q.query_id
       AND h.tenant_id = q.tenant_id
      WHERE q.tenant_id = $1
        AND (q.client_id = $2 OR q.client_id IS NULL)
      GROUP BY date_trunc('day', q.created_at)
      ORDER BY date_trunc('day', q.created_at) DESC
      LIMIT $3
    `,
    [tenantId, clientId, limit]
  );

  return result.rows.map((row) => ({
    report_date: row.report_date,
    item_value: Number(row.item_value)
  }));
}

export async function getWorkspaceCardsSummary(tenantId: string): Promise<WorkspaceCardsSummary> {
  const totalResult = await query<{ total_cards: string }>(
    `
      SELECT count(*)::text AS total_cards
      FROM kb_entries
      WHERE tenant_id = $1
    `,
    [tenantId]
  );

  const latestResult = await query<{ latest_card_title: string; updated_at: string }>(
    `
      SELECT
        e.kb_id AS latest_card_title,
        COALESCE(v.approved_at, v.created_at)::text AS updated_at
      FROM kb_entries e
      JOIN kb_entry_versions v
        ON v.entry_id = e.entry_id
       AND v.tenant_id = e.tenant_id
      WHERE e.tenant_id = $1
      ORDER BY COALESCE(v.approved_at, v.created_at) DESC
      LIMIT 1
    `,
    [tenantId]
  );

  return {
    total_cards: Number(totalResult.rows[0]?.total_cards ?? 0),
    latest_card_title: latestResult.rows[0]?.latest_card_title ?? null,
    updated_at: latestResult.rows[0]?.updated_at ?? null
  };
}

export async function getWorkspaceVersionStats(tenantId: string): Promise<WorkspaceVersionStats> {
  const result = await query<{
    reviewing_count: string;
    approved_count: string;
    latest_reviewing_at: string | null;
  }>(
    `
      SELECT
        count(*) FILTER (WHERE review_status = 'reviewing')::text AS reviewing_count,
        count(*) FILTER (WHERE review_status = 'approved')::text AS approved_count,
        (max(created_at) FILTER (WHERE review_status = 'reviewing'))::text AS latest_reviewing_at
      FROM kb_entry_versions
      WHERE tenant_id = $1
    `,
    [tenantId]
  );

  const row = result.rows[0];
  return {
    reviewing_count: Number(row?.reviewing_count ?? 0),
    approved_count: Number(row?.approved_count ?? 0),
    latest_reviewing_at: row?.latest_reviewing_at ?? null
  };
}

export async function getWorkspaceJobsSummary(tenantId: string, clientId: string): Promise<WorkspaceJobsSummary> {
  const result = await query<{
    open_count: string;
    delayed_count: string;
    done_count: string;
  }>(
    `
      SELECT
        count(*) FILTER (WHERE status IN ('queued', 'running'))::text AS open_count,
        count(*) FILTER (WHERE status = 'failed')::text AS delayed_count,
        count(*) FILTER (WHERE status = 'succeeded')::text AS done_count
      FROM kb_jobs
      WHERE tenant_id = $1
        AND request_payload->>'client_id' = $2
    `,
    [tenantId, clientId]
  );

  const row = result.rows[0];
  return {
    open_count: Number(row?.open_count ?? 0),
    delayed_count: Number(row?.delayed_count ?? 0),
    done_count: Number(row?.done_count ?? 0)
  };
}

export async function getWorkspaceLatestFeedback(tenantId: string, clientId: string): Promise<WorkspaceLatestFeedback> {
  const result = await query<{
    latest_feedback_at: string;
    latest_feedback_hint: string | null;
  }>(
    `
      SELECT
        created_at::text AS latest_feedback_at,
        COALESCE(
          response_payload->>'latest_feedback_hint',
          response_payload->>'feedback_hint',
          request_payload->>'feedback_hint',
          request_payload->>'summary',
          error_message
        ) AS latest_feedback_hint
      FROM kb_audit_logs
      WHERE tenant_id = $1
        AND action_type = 'feedback'
        AND request_payload->>'client_id' = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, clientId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    latest_feedback_at: row.latest_feedback_at,
    latest_feedback_hint: row.latest_feedback_hint
  };
}

export async function getWorkspaceLastUpdatedAt(tenantId: string): Promise<string | null> {
  const result = await query<{ last_updated_at: string | null }>(
    `
      SELECT
        GREATEST(
          COALESCE((SELECT max(created_at) FROM kb_documents WHERE tenant_id = $1), 'epoch'::timestamptz),
          COALESCE((SELECT max(created_at) FROM kb_entry_versions WHERE tenant_id = $1), 'epoch'::timestamptz),
          COALESCE((SELECT max(created_at) FROM kb_jobs WHERE tenant_id = $1), 'epoch'::timestamptz),
          COALESCE((SELECT max(created_at) FROM kb_audit_logs WHERE tenant_id = $1), 'epoch'::timestamptz)
        )::text AS last_updated_at
    `,
    [tenantId]
  );

  return result.rows[0]?.last_updated_at ?? null;
}

async function hasWorkspaceJobStub(
  tenantId: string,
  clientId: string,
  jobType: "draft_stub" | "task_stub" | "feedback_stub"
): Promise<boolean> {
  const result = await query<{ cnt: string }>(
    `
      SELECT count(*)::text AS cnt
      FROM kb_jobs
      WHERE tenant_id = $1
        AND job_type = $3
        AND request_payload->>'client_id' = $2
        AND status IN ('queued', 'running', 'succeeded')
    `,
    [tenantId, clientId, jobType]
  );

  return Number(result.rows[0]?.cnt ?? 0) > 0;
}

export async function hasWorkspaceDraftStub(tenantId: string, clientId: string): Promise<boolean> {
  return hasWorkspaceJobStub(tenantId, clientId, "draft_stub");
}

export async function hasWorkspaceTaskStub(tenantId: string, clientId: string): Promise<boolean> {
  return hasWorkspaceJobStub(tenantId, clientId, "task_stub");
}

export async function hasWorkspaceFeedbackStub(tenantId: string, clientId: string): Promise<boolean> {
  return hasWorkspaceJobStub(tenantId, clientId, "feedback_stub");
}

export async function createWorkspaceJobStub(input: {
  tenantId: string;
  actorId: string;
  clientId: string;
  jobType: "draft_stub" | "task_stub" | "feedback_stub";
  payload?: Record<string, unknown>;
}): Promise<{ job_id: string }> {
  const requestPayload = {
    client_id: input.clientId,
    ...(input.payload ?? {})
  };

  const result = await query<{ job_id: string }>(
    `
      INSERT INTO kb_jobs (
        job_id, tenant_id, job_type, status, progress,
        request_payload, created_by
      ) VALUES (
        gen_random_uuid(), $1, $2, 'queued', 0,
        $3::jsonb, $4
      )
      RETURNING job_id::text
    `,
    [input.tenantId, input.jobType, JSON.stringify(requestPayload), input.actorId]
  );

  return {
    job_id: result.rows[0].job_id
  };
}
