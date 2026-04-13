import { PoolClient } from "pg";
import { pool, query } from "../../config/db";

export async function checkWhitelist(tenantId: string, sourceDomain: string): Promise<boolean> {
  const result = await query<{ is_whitelisted: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM kb_source_whitelist w
        WHERE w.tenant_id = $1
          AND w.source_domain = $2
          AND w.enabled = true
          AND (w.effective_from IS NULL OR w.effective_from <= current_date)
          AND (w.effective_to IS NULL OR w.effective_to >= current_date)
      ) AS is_whitelisted
    `,
    [tenantId, sourceDomain]
  );

  return Boolean(result.rows[0]?.is_whitelisted);
}

export async function insertSource(
  tenantId: string,
  actorId: string,
  payload: {
    source_name: string;
    source_domain: string;
    source_type: string;
    publication_org?: string;
    publication_date?: string;
    source_version?: string;
    source_url: string;
    checksum?: string;
    is_whitelisted: boolean;
    pollution_risk_score: number;
  }
): Promise<{
  source_id: string;
  is_whitelisted: boolean;
  pollution_risk_score: number;
  ingest_date: string;
}> {
  const result = await query<{
    source_id: string;
    is_whitelisted: boolean;
    pollution_risk_score: string;
    ingest_date: string;
  }>(
    `
      INSERT INTO kb_sources (
        source_id, tenant_id, source_name, source_domain, source_type,
        publication_org, publication_date, source_version, source_url,
        checksum, is_whitelisted, pollution_risk_score, created_by
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6::date, $7, $8,
        $9, $10, $11, $12
      )
      RETURNING source_id::text, is_whitelisted, pollution_risk_score::text, ingest_date::text
    `,
    [
      tenantId,
      payload.source_name,
      payload.source_domain,
      payload.source_type,
      payload.publication_org ?? null,
      payload.publication_date ?? null,
      payload.source_version ?? null,
      payload.source_url,
      payload.checksum ?? null,
      payload.is_whitelisted,
      payload.pollution_risk_score,
      actorId
    ]
  );

  return {
    source_id: result.rows[0].source_id,
    is_whitelisted: result.rows[0].is_whitelisted,
    pollution_risk_score: Number(result.rows[0].pollution_risk_score),
    ingest_date: result.rows[0].ingest_date
  };
}

export async function insertDocumentAndJob(
  tenantId: string,
  actorId: string,
  payload: {
    source_id: string;
    title: string;
    language: string;
    raw_storage_uri: string;
    parser_version?: string;
    chunk_strategy?: string;
  }
): Promise<{ document_id: string; job_id: string; job_status: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const docResult = await client.query<{ document_id: string }>(
      `
        INSERT INTO kb_documents (
          document_id, tenant_id, source_id, title, language,
          raw_storage_uri, parser_version, chunk_strategy, created_by
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8
        )
        RETURNING document_id::text
      `,
      [
        tenantId,
        payload.source_id,
        payload.title,
        payload.language,
        payload.raw_storage_uri,
        payload.parser_version ?? null,
        payload.chunk_strategy ?? null,
        actorId
      ]
    );

    const jobResult = await client.query<{ job_id: string; status: string }>(
      `
        INSERT INTO kb_jobs (
          job_id, tenant_id, job_type, status, progress, request_payload, created_by
        )
        VALUES (
          gen_random_uuid(), $1, 'ingest', 'queued', 0,
          $2::jsonb, $3
        )
        RETURNING job_id::text, status::text
      `,
      [tenantId, JSON.stringify({ source_id: payload.source_id, title: payload.title }), actorId]
    );

    await client.query("COMMIT");

    return {
      document_id: docResult.rows[0].document_id,
      job_id: jobResult.rows[0].job_id,
      job_status: jobResult.rows[0].status
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getNextVersionNo(client: PoolClient, entryId: string): Promise<number> {
  const result = await client.query<{ version_no: string }>(
    `
      SELECT COALESCE(MAX(version_no), 0) + 1 AS version_no
      FROM kb_entry_versions
      WHERE entry_id = $1
    `,
    [entryId]
  );
  return Number(result.rows[0].version_no);
}

export async function insertEntryWithVersion(
  tenantId: string,
  actorId: string,
  payload: {
    kb_id: string;
    layer: "L1" | "L2" | "L3";
    claim_type: "judgment" | "procedure";
    topic: string;
    tags: string[];
    version: {
      statement: string;
      applicability?: string;
      contraindication?: string;
      evidence_level: string;
      confidence_score: number;
      source_name: string;
      source_url: string;
      source_version?: string;
      publication_date?: string;
      citation_span?: string;
      checksum?: string;
      supersedes_version_id?: string;
    };
  }
): Promise<{ entry_id: string; version_id: string; version_no: number; review_status: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const entryResult = await client.query<{ entry_id: string }>(
      `
        INSERT INTO kb_entries (
          entry_id, tenant_id, kb_id, layer, claim_type, topic, tags, current_version_no, is_active, created_by
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6::text[], 1, true, $7
        )
        RETURNING entry_id::text
      `,
      [tenantId, payload.kb_id, payload.layer, payload.claim_type, payload.topic, payload.tags, actorId]
    );

    const entryId = entryResult.rows[0].entry_id;
    const versionNo = await getNextVersionNo(client, entryId);

    const versionResult = await client.query<{
      version_id: string;
      version_no: string;
      review_status: string;
    }>(
      `
        INSERT INTO kb_entry_versions (
          version_id, entry_id, tenant_id, version_no,
          statement, applicability, contraindication, evidence_level, confidence_score,
          source_name, source_url, source_version, publication_date, citation_span, checksum,
          supersedes_version_id, review_status, created_by, tsv
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, $10, $11, $12::date, $13, $14,
          $15::uuid, 'draft', $16, to_tsvector('simple', $4 || ' ' || $17)
        )
        RETURNING version_id::text, version_no::text, review_status::text
      `,
      [
        entryId,
        tenantId,
        versionNo,
        payload.version.statement,
        payload.version.applicability ?? null,
        payload.version.contraindication ?? null,
        payload.version.evidence_level,
        payload.version.confidence_score,
        payload.version.source_name,
        payload.version.source_url,
        payload.version.source_version ?? null,
        payload.version.publication_date ?? null,
        payload.version.citation_span ?? null,
        payload.version.checksum ?? null,
        payload.version.supersedes_version_id ?? null,
        actorId,
        payload.topic
      ]
    );

    await client.query("COMMIT");

    return {
      entry_id: entryId,
      version_id: versionResult.rows[0].version_id,
      version_no: Number(versionResult.rows[0].version_no),
      review_status: versionResult.rows[0].review_status
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function insertVersion(
  tenantId: string,
  actorId: string,
  entryId: string,
  payload: {
    statement: string;
    applicability?: string;
    contraindication?: string;
    evidence_level: string;
    confidence_score: number;
    source_name: string;
    source_url: string;
    source_version?: string;
    publication_date?: string;
    citation_span?: string;
    checksum?: string;
    supersedes_version_id?: string;
  }
): Promise<{ entry_id: string; version_id: string; version_no: number; review_status: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existsResult = await client.query<{ topic: string }>(
      `
        SELECT topic
        FROM kb_entries
        WHERE entry_id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [entryId, tenantId]
    );
    const topic = existsResult.rows[0]?.topic;
    if (!topic) {
      throw new Error("entry_not_found");
    }

    const versionNo = await getNextVersionNo(client, entryId);

    const result = await client.query<{
      version_id: string;
      version_no: string;
      review_status: string;
    }>(
      `
        INSERT INTO kb_entry_versions (
          version_id, entry_id, tenant_id, version_no,
          statement, applicability, contraindication, evidence_level, confidence_score,
          source_name, source_url, source_version, publication_date, citation_span, checksum,
          supersedes_version_id, review_status, created_by, tsv
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, $10, $11, $12::date, $13, $14,
          $15::uuid, 'reviewing', $16, to_tsvector('simple', $4 || ' ' || $17)
        )
        RETURNING version_id::text, version_no::text, review_status::text
      `,
      [
        entryId,
        tenantId,
        versionNo,
        payload.statement,
        payload.applicability ?? null,
        payload.contraindication ?? null,
        payload.evidence_level,
        payload.confidence_score,
        payload.source_name,
        payload.source_url,
        payload.source_version ?? null,
        payload.publication_date ?? null,
        payload.citation_span ?? null,
        payload.checksum ?? null,
        payload.supersedes_version_id ?? null,
        actorId,
        topic
      ]
    );

    await client.query(
      `
        UPDATE kb_entries
        SET current_version_no = $1
        WHERE entry_id = $2
      `,
      [versionNo, entryId]
    );

    await client.query("COMMIT");

    return {
      entry_id: entryId,
      version_id: result.rows[0].version_id,
      version_no: Number(result.rows[0].version_no),
      review_status: result.rows[0].review_status
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function approveVersion(
  tenantId: string,
  versionId: string,
  payload: { reviewer: string; review_notes?: string; valid_from?: string; valid_to?: string | null }
): Promise<{ entry_id: string; version_id: string; version_no: number; review_status: string }> {
  const result = await query<{
    entry_id: string;
    version_id: string;
    version_no: string;
    review_status: string;
  }>(
    `
      UPDATE kb_entry_versions
      SET
        review_status = 'approved',
        reviewer = $1,
        review_notes = $2,
        approved_at = now(),
        valid_from = COALESCE($3::timestamptz, now()),
        valid_to = $4::timestamptz
      WHERE version_id = $5
        AND tenant_id = $6
      RETURNING entry_id::text, version_id::text, version_no::text, review_status::text
    `,
    [
      payload.reviewer,
      payload.review_notes ?? null,
      payload.valid_from ?? null,
      payload.valid_to ?? null,
      versionId,
      tenantId
    ]
  );

  if (!result.rowCount) {
    throw new Error("version_not_found");
  }

  return {
    entry_id: result.rows[0].entry_id,
    version_id: result.rows[0].version_id,
    version_no: Number(result.rows[0].version_no),
    review_status: result.rows[0].review_status
  };
}

export async function rejectVersion(
  tenantId: string,
  versionId: string,
  payload: { reviewer: string; review_notes: string }
): Promise<{ entry_id: string; version_id: string; version_no: number; review_status: string }> {
  const result = await query<{
    entry_id: string;
    version_id: string;
    version_no: string;
    review_status: string;
  }>(
    `
      UPDATE kb_entry_versions
      SET
        review_status = 'rejected',
        reviewer = $1,
        review_notes = $2
      WHERE version_id = $3
        AND tenant_id = $4
      RETURNING entry_id::text, version_id::text, version_no::text, review_status::text
    `,
    [payload.reviewer, payload.review_notes, versionId, tenantId]
  );

  if (!result.rowCount) {
    throw new Error("version_not_found");
  }

  return {
    entry_id: result.rows[0].entry_id,
    version_id: result.rows[0].version_id,
    version_no: Number(result.rows[0].version_no),
    review_status: result.rows[0].review_status
  };
}

export async function insertSnapshot(
  tenantId: string,
  actorId: string,
  payload: { snapshot_name: string; based_on_time: string; notes?: string }
): Promise<{ snapshot_id: string; snapshot_name: string; released_at: string }> {
  const result = await query<{ snapshot_id: string; snapshot_name: string; released_at: string }>(
    `
      INSERT INTO kb_snapshots (
        snapshot_id, tenant_id, snapshot_name, snapshot_type, based_on_time, released_by, notes
      )
      VALUES (
        gen_random_uuid(), $1, $2, 'release', $3::timestamptz, $4, $5
      )
      RETURNING snapshot_id::text, snapshot_name, released_at::text
    `,
    [tenantId, payload.snapshot_name, payload.based_on_time, actorId, payload.notes ?? null]
  );

  return result.rows[0];
}

export async function findJobById(
  tenantId: string,
  jobId: string
): Promise<{ job_id: string; status: string; progress: number; error_message: string | null } | null> {
  const result = await query<{
    job_id: string;
    status: string;
    progress: string;
    error_message: string | null;
  }>(
    `
      SELECT
        job_id::text,
        status::text,
        progress::text,
        error_message
      FROM kb_jobs
      WHERE tenant_id = $1
        AND job_id = $2
      LIMIT 1
    `,
    [tenantId, jobId]
  );

  if (!result.rowCount) {
    return null;
  }

  return {
    job_id: result.rows[0].job_id,
    status: result.rows[0].status,
    progress: Number(result.rows[0].progress),
    error_message: result.rows[0].error_message
  };
}
