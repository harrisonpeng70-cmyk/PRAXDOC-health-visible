import { query } from "../../config/db";

export type SourceWhitelistEntry = {
  whitelist_id: string;
  source_name: string;
  source_domain: string;
  source_type: string;
  trust_level: number;
  enabled: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_by: string;
  created_at: string;
};

type SourceWhitelistRow = {
  whitelist_id: string;
  source_name: string;
  source_domain: string;
  source_type: string;
  trust_level: string;
  enabled: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_by: string;
  created_at: string;
};

function mapWhitelistRow(row: SourceWhitelistRow): SourceWhitelistEntry {
  return {
    whitelist_id: row.whitelist_id,
    source_name: row.source_name,
    source_domain: row.source_domain,
    source_type: row.source_type,
    trust_level: Number(row.trust_level),
    enabled: row.enabled,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    created_by: row.created_by,
    created_at: row.created_at
  };
}

function buildWhitelistWhere(
  tenantId: string,
  filters: {
    enabled?: boolean;
    sourceType?: string;
    search?: string;
  }
): { params: unknown[]; whereClause: string } {
  const params: unknown[] = [tenantId];
  const clauses = ["tenant_id = $1"];

  if (typeof filters.enabled === "boolean") {
    params.push(filters.enabled);
    clauses.push(`enabled = $${params.length}`);
  }

  if (filters.sourceType) {
    params.push(filters.sourceType);
    clauses.push(`source_type = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    clauses.push(`(source_name ILIKE $${params.length} OR source_domain ILIKE $${params.length})`);
  }

  return {
    params,
    whereClause: clauses.join(" AND ")
  };
}

export async function listSourceWhitelist(
  tenantId: string,
  filters: {
    enabled?: boolean;
    sourceType?: string;
    search?: string;
    page: number;
    pageSize: number;
  }
): Promise<{ total: number; items: SourceWhitelistEntry[] }> {
  const { params, whereClause } = buildWhitelistWhere(tenantId, filters);
  const countResult = await query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM kb_source_whitelist
      WHERE ${whereClause}
    `,
    params
  );

  const listParams = [...params];
  listParams.push(filters.pageSize);
  const limitIndex = listParams.length;
  listParams.push((filters.page - 1) * filters.pageSize);
  const offsetIndex = listParams.length;

  const rowsResult = await query<SourceWhitelistRow>(
    `
      SELECT
        id::text AS whitelist_id,
        source_name,
        source_domain,
        source_type,
        trust_level::text,
        enabled,
        effective_from::text,
        effective_to::text,
        created_by,
        created_at::text
      FROM kb_source_whitelist
      WHERE ${whereClause}
      ORDER BY enabled DESC, trust_level DESC, source_domain ASC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    listParams
  );

  return {
    total: Number(countResult.rows[0]?.total ?? 0),
    items: rowsResult.rows.map((row) => mapWhitelistRow(row))
  };
}

export async function findSourceWhitelistById(
  tenantId: string,
  whitelistId: number
): Promise<SourceWhitelistEntry | null> {
  const result = await query<SourceWhitelistRow>(
    `
      SELECT
        id::text AS whitelist_id,
        source_name,
        source_domain,
        source_type,
        trust_level::text,
        enabled,
        effective_from::text,
        effective_to::text,
        created_by,
        created_at::text
      FROM kb_source_whitelist
      WHERE tenant_id = $1
        AND id = $2
      LIMIT 1
    `,
    [tenantId, whitelistId]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapWhitelistRow(result.rows[0]);
}

export async function createSourceWhitelistEntry(
  tenantId: string,
  actorId: string,
  payload: {
    source_name: string;
    source_domain: string;
    source_type: string;
    trust_level: number;
    enabled: boolean;
    effective_from?: string;
    effective_to?: string;
  }
): Promise<SourceWhitelistEntry> {
  const result = await query<SourceWhitelistRow>(
    `
      INSERT INTO kb_source_whitelist (
        tenant_id,
        source_name,
        source_domain,
        source_type,
        trust_level,
        enabled,
        effective_from,
        effective_to,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9)
      RETURNING
        id::text AS whitelist_id,
        source_name,
        source_domain,
        source_type,
        trust_level::text,
        enabled,
        effective_from::text,
        effective_to::text,
        created_by,
        created_at::text
    `,
    [
      tenantId,
      payload.source_name,
      payload.source_domain,
      payload.source_type,
      payload.trust_level,
      payload.enabled,
      payload.effective_from ?? null,
      payload.effective_to ?? null,
      actorId
    ]
  );

  return mapWhitelistRow(result.rows[0]);
}

export async function updateSourceWhitelistEntry(
  tenantId: string,
  whitelistId: number,
  payload: {
    source_name?: string;
    source_domain?: string;
    source_type?: string;
    trust_level?: number;
    enabled?: boolean;
    effective_from?: string | null;
    effective_to?: string | null;
  }
): Promise<SourceWhitelistEntry | null> {
  const params: unknown[] = [tenantId, whitelistId];
  const setClauses: string[] = [];

  if (payload.source_name !== undefined) {
    params.push(payload.source_name);
    setClauses.push(`source_name = $${params.length}`);
  }
  if (payload.source_domain !== undefined) {
    params.push(payload.source_domain);
    setClauses.push(`source_domain = $${params.length}`);
  }
  if (payload.source_type !== undefined) {
    params.push(payload.source_type);
    setClauses.push(`source_type = $${params.length}`);
  }
  if (payload.trust_level !== undefined) {
    params.push(payload.trust_level);
    setClauses.push(`trust_level = $${params.length}`);
  }
  if (payload.enabled !== undefined) {
    params.push(payload.enabled);
    setClauses.push(`enabled = $${params.length}`);
  }
  if (payload.effective_from !== undefined) {
    params.push(payload.effective_from);
    setClauses.push(`effective_from = $${params.length}::date`);
  }
  if (payload.effective_to !== undefined) {
    params.push(payload.effective_to);
    setClauses.push(`effective_to = $${params.length}::date`);
  }

  const result = await query<SourceWhitelistRow>(
    `
      UPDATE kb_source_whitelist
      SET ${setClauses.join(", ")}
      WHERE tenant_id = $1
        AND id = $2
      RETURNING
        id::text AS whitelist_id,
        source_name,
        source_domain,
        source_type,
        trust_level::text,
        enabled,
        effective_from::text,
        effective_to::text,
        created_by,
        created_at::text
    `,
    params
  );

  if (!result.rowCount) {
    return null;
  }

  return mapWhitelistRow(result.rows[0]);
}

export async function getWhitelistSummary(tenantId: string): Promise<{
  total_entries: number;
  enabled_entries: number;
  disabled_entries: number;
  by_source_type: Array<{
    source_type: string;
    total_entries: number;
    enabled_entries: number;
    disabled_entries: number;
  }>;
}> {
  const totalsResult = await query<{
    total_entries: string;
    enabled_entries: string;
    disabled_entries: string;
  }>(
    `
      SELECT
        COUNT(*)::text AS total_entries,
        COUNT(*) FILTER (WHERE enabled)::text AS enabled_entries,
        COUNT(*) FILTER (WHERE NOT enabled)::text AS disabled_entries
      FROM kb_source_whitelist
      WHERE tenant_id = $1
    `,
    [tenantId]
  );

  const bySourceTypeResult = await query<{
    source_type: string;
    total_entries: string;
    enabled_entries: string;
    disabled_entries: string;
  }>(
    `
      SELECT
        source_type,
        COUNT(*)::text AS total_entries,
        COUNT(*) FILTER (WHERE enabled)::text AS enabled_entries,
        COUNT(*) FILTER (WHERE NOT enabled)::text AS disabled_entries
      FROM kb_source_whitelist
      WHERE tenant_id = $1
      GROUP BY source_type
      ORDER BY source_type ASC
    `,
    [tenantId]
  );

  return {
    total_entries: Number(totalsResult.rows[0]?.total_entries ?? 0),
    enabled_entries: Number(totalsResult.rows[0]?.enabled_entries ?? 0),
    disabled_entries: Number(totalsResult.rows[0]?.disabled_entries ?? 0),
    by_source_type: bySourceTypeResult.rows.map((row) => ({
      source_type: row.source_type,
      total_entries: Number(row.total_entries),
      enabled_entries: Number(row.enabled_entries),
      disabled_entries: Number(row.disabled_entries)
    }))
  };
}

export async function isPgvectorExtensionInstalled(): Promise<boolean> {
  const result = await query<{ installed: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'vector'
      ) AS installed
    `
  );

  return Boolean(result.rows[0]?.installed);
}
