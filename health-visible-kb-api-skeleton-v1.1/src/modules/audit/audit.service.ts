import {
  enqueueAuditExportJob,
  findAuditLogById,
  getAuditStats,
  InsertAuditLogParams,
  insertAuditLog,
  listAuditLogs
} from "./audit.repo";

export async function writeAuditLog(params: InsertAuditLogParams): Promise<void> {
  await insertAuditLog(params);
}

export async function getAuditLogs(
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
): Promise<{ page: number; page_size: number; total: number; items: unknown[] }> {
  const result = await listAuditLogs(tenantId, filters);
  return {
    page: filters.page,
    page_size: filters.page_size,
    total: result.total,
    items: result.rows
  };
}

export async function getAuditLogDetail(tenantId: string, auditId: string): Promise<unknown | null> {
  return findAuditLogById(tenantId, auditId);
}

export async function getAuditStatsSummary(
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
  return getAuditStats(tenantId, from, to);
}

export async function exportAuditLogs(
  tenantId: string,
  actorId: string,
  payload: { from: string; to: string; format: "csv" | "json" }
): Promise<{ job_id: string }> {
  return enqueueAuditExportJob(tenantId, actorId, payload);
}
