import {
  approveVersion,
  checkWhitelist,
  findJobById,
  insertDocumentAndJob,
  insertEntryWithVersion,
  insertSnapshot,
  insertSource,
  insertVersion,
  rejectVersion
} from "./ingest.repo";
import { getRuntimePolicyConfig } from "../admin/admin.repo";

export async function createSourceService(
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
  }
): Promise<{
  source_id: string;
  is_whitelisted: boolean;
  pollution_risk_score: number;
  ingest_date: string;
}> {
  const normalizedDomain = payload.source_domain.trim().toLowerCase();
  const [policyConfig, isWhitelisted] = await Promise.all([
    getRuntimePolicyConfig(tenantId),
    checkWhitelist(tenantId, normalizedDomain)
  ]);

  if (policyConfig.ingest_policy.whitelist_gate_enabled && !isWhitelisted) {
    throw new Error("source_not_whitelisted");
  }

  return insertSource(tenantId, actorId, {
    ...payload,
    source_domain: normalizedDomain,
    is_whitelisted: isWhitelisted,
    pollution_risk_score: isWhitelisted ? 0.03 : 0.18
  });
}

export async function createDocumentService(
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
  return insertDocumentAndJob(tenantId, actorId, payload);
}

export async function createEntryService(
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
  return insertEntryWithVersion(tenantId, actorId, payload);
}

export async function createVersionService(
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
  return insertVersion(tenantId, actorId, entryId, payload);
}

export async function approveVersionService(
  tenantId: string,
  versionId: string,
  payload: { reviewer: string; review_notes?: string; valid_from?: string; valid_to?: string | null }
): Promise<{ entry_id: string; version_id: string; version_no: number; review_status: string }> {
  return approveVersion(tenantId, versionId, payload);
}

export async function rejectVersionService(
  tenantId: string,
  versionId: string,
  payload: { reviewer: string; review_notes: string }
): Promise<{ entry_id: string; version_id: string; version_no: number; review_status: string }> {
  return rejectVersion(tenantId, versionId, payload);
}

export async function publishSnapshotService(
  tenantId: string,
  actorId: string,
  payload: { snapshot_name: string; based_on_time: string; notes?: string }
): Promise<{ snapshot_id: string; snapshot_name: string; released_at: string }> {
  return insertSnapshot(tenantId, actorId, payload);
}

export async function getJobService(
  tenantId: string,
  jobId: string
): Promise<{ job_id: string; status: string; progress: number; error_message: string | null } | null> {
  return findJobById(tenantId, jobId);
}
