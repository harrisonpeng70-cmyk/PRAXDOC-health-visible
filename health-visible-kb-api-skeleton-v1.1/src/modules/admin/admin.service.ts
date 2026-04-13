import {
  createSourceWhitelistEntry,
  findSourceWhitelistById,
  getWhitelistSummary,
  isPgvectorExtensionInstalled,
  listSourceWhitelist,
  updateSourceWhitelistEntry
} from "./admin.repo";
import { AdminWhitelistQuery, CreateWhitelistEntryInput, UpdateWhitelistEntryInput } from "./admin.schema";

const DEFAULT_RETRIEVE_POLICY = {
  approved_only: true,
  l3_requires_exploratory_label: true,
  no_l1_hit_error_hint: "only_mid_low_confidence_evidence",
  default_weights: {
    r_struct: 0.4,
    r_keyword: 0.25,
    r_vector: 0.25,
    r_quality: 0.1,
    w_layer: { L1: 1.0, L2: 0.8, L3: 0.6 },
    w_evidence: { A: 1.0, B: 0.85, C: 0.7 },
    conflict_penalty: 0.5
  }
} as const;

function normalizeDomain(sourceDomain: string): string {
  return sourceDomain.trim().toLowerCase();
}

function assertEffectiveRange(effectiveFrom?: string | null, effectiveTo?: string | null): void {
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
    throw new Error("whitelist_invalid_effective_range");
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

  return updateSourceWhitelistEntry(tenantId, whitelistId, {
    ...payload,
    source_domain: payload.source_domain ? normalizeDomain(payload.source_domain) : payload.source_domain
  });
}

export async function getPolicyOverviewService(tenantId: string) {
  const [whitelistSummary, pgvectorInstalled] = await Promise.all([
    getWhitelistSummary(tenantId),
    isPgvectorExtensionInstalled()
  ]);

  return {
    whitelist_summary: whitelistSummary,
    ingest_policy: {
      whitelist_gate_enabled: true,
      duplicate_domain_guard_enabled: true,
      trust_level_range: {
        min: 1,
        max: 5
      }
    },
    retrieve_policy: DEFAULT_RETRIEVE_POLICY,
    runtime_flags: {
      pgvector_extension_installed: pgvectorInstalled,
      workspace_preview_enabled: true,
      admin_actor_required: true
    }
  };
}
