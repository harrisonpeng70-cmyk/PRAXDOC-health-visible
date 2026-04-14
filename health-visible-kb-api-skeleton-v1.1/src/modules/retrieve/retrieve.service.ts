import {
  findEntryById,
  listConflicts,
  listVersions,
  runHybridSearch,
  updateQueryLogResult
} from "./retrieve.repo";
import { getRuntimePolicyConfig } from "../admin/admin.repo";
import { RetrieveWeights } from "../../shared/policy/runtime-policy";
import { RetrieveWeightsInput } from "./retrieve.schema";

type SearchHit = {
  layer: "L1" | "L2" | "L3";
  labels: string[];
};

function resolveRetrieveWeights(
  policyWeights: RetrieveWeights,
  overrideWeights?: RetrieveWeightsInput
): RetrieveWeights {
  return {
    r_struct: overrideWeights?.r_struct ?? policyWeights.r_struct,
    r_keyword: overrideWeights?.r_keyword ?? policyWeights.r_keyword,
    r_vector: overrideWeights?.r_vector ?? policyWeights.r_vector,
    r_quality: overrideWeights?.r_quality ?? policyWeights.r_quality,
    w_layer: {
      L1: overrideWeights?.w_layer?.L1 ?? policyWeights.w_layer.L1,
      L2: overrideWeights?.w_layer?.L2 ?? policyWeights.w_layer.L2,
      L3: overrideWeights?.w_layer?.L3 ?? policyWeights.w_layer.L3
    },
    w_evidence: {
      A: overrideWeights?.w_evidence?.A ?? policyWeights.w_evidence.A,
      B: overrideWeights?.w_evidence?.B ?? policyWeights.w_evidence.B,
      C: overrideWeights?.w_evidence?.C ?? policyWeights.w_evidence.C
    },
    conflict_penalty: overrideWeights?.conflict_penalty ?? policyWeights.conflict_penalty
  };
}

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
  weights?: RetrieveWeightsInput;
  topK: number;
}): Promise<{
  query_id: string;
  state: "ready" | "partial_ready" | "empty";
  result_type: "success" | "partial";
  hits: unknown[];
  error_hint: string | null;
}> {
  const startedAt = Date.now();
  const policyConfig = await getRuntimePolicyConfig(input.tenantId);
  const resolvedWeights = resolveRetrieveWeights(policyConfig.retrieve_policy.default_weights, input.weights);
  const result = await runHybridSearch({
    ...input,
    approvedOnly: policyConfig.retrieve_policy.approved_only,
    weights: resolvedWeights
  });
  const latencyMs = Date.now() - startedAt;
  const hits = policyConfig.retrieve_policy.l3_requires_exploratory_label
    ? result.hits
    : result.hits.map((hit: SearchHit) => ({
        ...hit,
        labels: []
      }));

  if (hits.length === 0) {
    await updateQueryLogResult(input.tenantId, result.queryId, "success", latencyMs);
    return {
      query_id: result.queryId,
      state: "empty",
      result_type: "success",
      hits: [],
      error_hint: null
    };
  }

  const hasL1 = hits.some((h: SearchHit) => h.layer === "L1");
  if (!hasL1) {
    await updateQueryLogResult(input.tenantId, result.queryId, "partial", latencyMs);
    return {
      query_id: result.queryId,
      state: "partial_ready",
      result_type: "partial",
      hits,
      error_hint: policyConfig.retrieve_policy.no_l1_hit_error_hint
    };
  }

  await updateQueryLogResult(input.tenantId, result.queryId, "success", latencyMs);
  return {
    query_id: result.queryId,
    state: "ready",
    result_type: "success",
    hits,
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
