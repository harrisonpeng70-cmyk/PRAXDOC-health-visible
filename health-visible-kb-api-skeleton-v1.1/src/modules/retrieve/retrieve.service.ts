import {
  findEntryById,
  listConflicts,
  listVersions,
  runHybridSearch,
  updateQueryLogResult
} from "./retrieve.repo";

type SearchHit = {
  layer: "L1" | "L2" | "L3";
};

export async function searchService(input: {
  tenantId: string;
  actorType: string;
  actorId: string;
  clientId: string | null;
  queryText: string;
  filters: {
    layers?: Array<"L1" | "L2" | "L3">;
    claim_types?: Array<"judgment" | "procedure">;
    topics?: string[];
    evidence_levels?: string[];
  };
  weights: {
    r_struct: number;
    r_keyword: number;
    r_vector: number;
    r_quality: number;
    w_layer: { L1: number; L2: number; L3: number };
    w_evidence: Record<string, number>;
    conflict_penalty: number;
  };
  topK: number;
}): Promise<{
  query_id: string;
  state: "ready" | "partial_ready" | "empty";
  result_type: "success" | "partial";
  hits: unknown[];
  error_hint: string | null;
}> {
  const startedAt = Date.now();
  const result = await runHybridSearch(input);
  const latencyMs = Date.now() - startedAt;

  if (result.hits.length === 0) {
    await updateQueryLogResult(input.tenantId, result.queryId, "success", latencyMs);
    return {
      query_id: result.queryId,
      state: "empty",
      result_type: "success",
      hits: [],
      error_hint: null
    };
  }

  const hasL1 = result.hits.some((h: SearchHit) => h.layer === "L1");
  if (!hasL1) {
    await updateQueryLogResult(input.tenantId, result.queryId, "partial", latencyMs);
    return {
      query_id: result.queryId,
      state: "partial_ready",
      result_type: "partial",
      hits: result.hits,
      error_hint: "only_mid_low_confidence_evidence"
    };
  }

  await updateQueryLogResult(input.tenantId, result.queryId, "success", latencyMs);
  return {
    query_id: result.queryId,
    state: "ready",
    result_type: "success",
    hits: result.hits,
    error_hint: null
  };
}

export async function getEntryService(tenantId: string, entryId: string): Promise<unknown | null> {
  return findEntryById(tenantId, entryId);
}

export async function getVersionsService(tenantId: string, entryId: string): Promise<unknown[]> {
  return listVersions(tenantId, entryId);
}

export async function getConflictsService(
  tenantId: string,
  resolutionStatus?: "open" | "resolved" | "ignored",
  severityGte?: number
): Promise<unknown[]> {
  return listConflicts(tenantId, resolutionStatus, severityGte);
}
