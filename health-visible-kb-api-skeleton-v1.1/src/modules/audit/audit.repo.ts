import { query } from "../../config/db";

export interface InsertAuditLogParams {
  tenantId: string;
  auditTrailId: string;
  actorType: string;
  actorId: string | null;
  actionType: string;
  targetObjectType: string;
  targetObjectId: string;
  resultType: "success" | "partial" | "failed" | "manual_needed";
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export async function insertAuditLog(params: InsertAuditLogParams): Promise<void> {
  await query(
    `
      INSERT INTO kb_audit_logs (
        audit_id, tenant_id, audit_trail_id, actor_type, actor_id, action_type,
        target_object_type, target_object_id, result_type,
        request_payload, response_payload, error_code, error_message
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9::jsonb, $10::jsonb, $11, $12
      )
    `,
    [
      params.tenantId,
      params.auditTrailId,
      params.actorType,
      params.actorId,
      params.actionType,
      params.targetObjectType,
      params.targetObjectId,
      params.resultType,
      JSON.stringify(params.requestPayload ?? {}),
      JSON.stringify(params.responsePayload ?? {}),
      params.errorCode ?? null,
      params.errorMessage ?? null
    ]
  );
}

export async function listAuditLogs(
  tenantId: string,
  filters: {
    from?: string;
    to?: string;
    actor_type?: string;
    action_type?: string;
    target_object_type?: string;
    result_type?: string;
    audit_trail_id?: string;
    page: number;
    page_size: number;
  }
): Promise<{ total: number; rows: unknown[] }> {
  const offset = (filters.page - 1) * filters.page_size;

  const whereSql = `
    tenant_id = $1
    AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
    AND ($3::timestamptz IS NULL OR created_at <= $3::timestamptz)
    AND ($4::text IS NULL OR actor_type = $4::text)
    AND ($5::text IS NULL OR action_type = $5::text)
    AND ($6::text IS NULL OR target_object_type = $6::text)
    AND ($7::text IS NULL OR result_type::text = $7::text)
    AND ($8::text IS NULL OR audit_trail_id = $8::text)
  `;

  const params = [
    tenantId,
    filters.from ?? null,
    filters.to ?? null,
    filters.actor_type ?? null,
    filters.action_type ?? null,
    filters.target_object_type ?? null,
    filters.result_type ?? null,
    filters.audit_trail_id ?? null
  ];

  const totalResult = await query<{ total: string }>(
    `SELECT count(*)::text AS total FROM kb_audit_logs WHERE ${whereSql}`,
    params
  );

  const rowsResult = await query(
    `
      SELECT
        audit_id,
        audit_trail_id,
        actor_type,
        actor_id,
        action_type,
        target_object_type,
        target_object_id,
        result_type,
        created_at
      FROM kb_audit_logs
      WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT $9 OFFSET $10
    `,
    [...params, filters.page_size, offset]
  );

  return {
    total: Number(totalResult.rows[0]?.total ?? 0),
    rows: rowsResult.rows
  };
}

export async function findAuditLogById(tenantId: string, auditId: string): Promise<unknown | null> {
  const result = await query(
    `
      SELECT
        audit_id,
        audit_trail_id,
        actor_type,
        actor_id,
        action_type,
        target_object_type,
        target_object_id,
        result_type,
        request_payload,
        response_payload,
        error_code,
        error_message,
        created_at
      FROM kb_audit_logs
      WHERE tenant_id = $1 AND audit_id = $2
      LIMIT 1
    `,
    [tenantId, auditId]
  );

  return result.rows[0] ?? null;
}

export async function getAuditStats(
  tenantId: string,
  from: string,
  to: string
): Promise<{
  total_actions: number;
  failed_actions: number;
  pollution_blocked_count: number;
  open_conflict_count: number;
  top_actions: Array<{ action_type: string; count: number }>;
}> {
  const totalResult = await query<{ total_actions: string; failed_actions: string }>(
    `
      SELECT
        count(*)::text AS total_actions,
        count(*) FILTER (WHERE result_type = 'failed')::text AS failed_actions
      FROM kb_audit_logs
      WHERE tenant_id = $1
        AND created_at >= $2::timestamptz
        AND created_at <= $3::timestamptz
    `,
    [tenantId, from, to]
  );

  const blockedResult = await query<{ cnt: string }>(
    `
      SELECT count(*)::text AS cnt
      FROM kb_audit_logs
      WHERE tenant_id = $1
        AND action_type = 'ingest'
        AND error_code = 'KB-4221'
        AND created_at >= $2::timestamptz
        AND created_at <= $3::timestamptz
    `,
    [tenantId, from, to]
  );

  const conflictResult = await query<{ cnt: string }>(
    `
      SELECT count(*)::text AS cnt
      FROM kb_conflicts
      WHERE tenant_id = $1
        AND resolution_status = 'open'
    `,
    [tenantId]
  );

  const topActionsResult = await query<{ action_type: string; count: string }>(
    `
      SELECT action_type, count(*)::text AS count
      FROM kb_audit_logs
      WHERE tenant_id = $1
        AND created_at >= $2::timestamptz
        AND created_at <= $3::timestamptz
      GROUP BY action_type
      ORDER BY count(*) DESC
      LIMIT 5
    `,
    [tenantId, from, to]
  );

  return {
    total_actions: Number(totalResult.rows[0]?.total_actions ?? 0),
    failed_actions: Number(totalResult.rows[0]?.failed_actions ?? 0),
    pollution_blocked_count: Number(blockedResult.rows[0]?.cnt ?? 0),
    open_conflict_count: Number(conflictResult.rows[0]?.cnt ?? 0),
    top_actions: topActionsResult.rows.map((x: { action_type: string; count: string }) => ({
      action_type: x.action_type,
      count: Number(x.count)
    }))
  };
}

export async function enqueueAuditExportJob(
  tenantId: string,
  actorId: string,
  payload: { from: string; to: string; format: "csv" | "json" }
): Promise<{ job_id: string }> {
  const result = await query<{ job_id: string }>(
    `
      INSERT INTO kb_jobs (
        job_id, tenant_id, job_type, status, progress,
        request_payload, created_by
      ) VALUES (
        gen_random_uuid(), $1, 'audit_export', 'queued', 0,
        $2::jsonb, $3
      )
      RETURNING job_id::text
    `,
    [tenantId, JSON.stringify(payload), actorId]
  );

  return {
    job_id: result.rows[0].job_id
  };
}
