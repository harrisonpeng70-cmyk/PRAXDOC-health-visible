import {
  createSourceWhitelistEntry,
  findSourceWhitelistById,
  getRuntimePolicyConfig,
  getWhitelistSummary,
  isPgvectorExtensionInstalled,
  listSourceWhitelist,
  updateRuntimePolicyConfig,
  updateSourceWhitelistEntry
} from "./admin.repo";
import {
  AdminWhitelistQuery,
  CreateWhitelistEntryInput,
  UpdatePolicyConfigInput,
  UpdateWhitelistEntryInput
} from "./admin.schema";
import { mergeRuntimePolicyConfig, RuntimePolicyConfig } from "../../shared/policy/runtime-policy";

function normalizeDomain(sourceDomain: string): string {
  return sourceDomain.trim().toLowerCase();
}

function assertEffectiveRange(effectiveFrom?: string | null, effectiveTo?: string | null): void {
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
    throw new Error("whitelist_invalid_effective_range");
  }
}

function assertTrustLevelRange(config: RuntimePolicyConfig): void {
  if (config.ingest_policy.trust_level_range.min > config.ingest_policy.trust_level_range.max) {
    throw new Error("policy_trust_level_range_invalid");
  }
}

function assertWhitelistTrustLevel(
  trustLevel: number,
  config: RuntimePolicyConfig
): void {
  const { min, max } = config.ingest_policy.trust_level_range;
  if (trustLevel < min || trustLevel > max) {
    throw new Error("whitelist_trust_level_out_of_range");
  }
}

export async function listSourceWhitelistService(tenantId: string, query: AdminWhitelistQuery) {
  const result = await listSourceWhitelist(tenantId, {
    enabled: query.enabled,
    sourceType: query.source_type,
    search: query.search,
    page: query.page,
    pageSize: query.page_size
  });

  return {
    page: query.page,
    page_size: query.page_size,
    total: result.total,
    items: result.items
  };
}

export async function createSourceWhitelistEntryService(
  tenantId: string,
  actorId: string,
  payload: CreateWhitelistEntryInput
) {
  assertEffectiveRange(payload.effective_from, payload.effective_to);
  const policyConfig = await getRuntimePolicyConfig(tenantId);
  assertWhitelistTrustLevel(payload.trust_level, policyConfig);

  return createSourceWhitelistEntry(tenantId, actorId, {
    ...payload,
    source_domain: normalizeDomain(payload.source_domain)
  });
}

export async function updateSourceWhitelistEntryService(
  tenantId: string,
  whitelistId: number,
  payload: UpdateWhitelistEntryInput
) {
  const existing = await findSourceWhitelistById(tenantId, whitelistId);
  if (!existing) {
    throw new Error("whitelist_not_found");
  }

  const effectiveFrom = payload.effective_from !== undefined ? payload.effective_from : existing.effective_from;
  const effectiveTo = payload.effective_to !== undefined ? payload.effective_to : existing.effective_to;
  assertEffectiveRange(effectiveFrom, effectiveTo);
  const policyConfig = await getRuntimePolicyConfig(tenantId);
  assertWhitelistTrustLevel(payload.trust_level ?? existing.trust_level, policyConfig);

  return updateSourceWhitelistEntry(tenantId, whitelistId, {
    ...payload,
    source_domain: payload.source_domain ? normalizeDomain(payload.source_domain) : payload.source_domain
  });
}

export async function getRuntimePolicyConfigService(tenantId: string) {
  return getRuntimePolicyConfig(tenantId);
}

export async function updateRuntimePolicyConfigService(
  tenantId: string,
  actorId: string,
  patch: UpdatePolicyConfigInput
) {
  const current = await getRuntimePolicyConfig(tenantId);
  const merged = mergeRuntimePolicyConfig(current, patch);
  assertTrustLevelRange(merged);
  return updateRuntimePolicyConfig(tenantId, actorId, merged);
}

export async function getPolicyOverviewService(tenantId: string) {
  const [whitelistSummary, pgvectorInstalled, policyConfig] = await Promise.all([
    getWhitelistSummary(tenantId),
    isPgvectorExtensionInstalled(),
    getRuntimePolicyConfig(tenantId)
  ]);

  return {
    whitelist_summary: whitelistSummary,
    ingest_policy: policyConfig.ingest_policy,
    retrieve_policy: policyConfig.retrieve_policy,
    runtime_flags: {
      pgvector_extension_installed: pgvectorInstalled,
      workspace_preview_enabled: true,
      admin_actor_required: true
    }
  };
}
