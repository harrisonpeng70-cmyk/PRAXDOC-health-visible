export type RetrieveWeights = {
  r_struct: number;
  r_keyword: number;
  r_vector: number;
  r_quality: number;
  w_layer: {
    L1: number;
    L2: number;
    L3: number;
  };
  w_evidence: {
    A: number;
    B: number;
    C: number;
  };
  conflict_penalty: number;
};

export type RuntimePolicyConfig = {
  ingest_policy: {
    whitelist_gate_enabled: boolean;
    duplicate_domain_guard_enabled: boolean;
    trust_level_range: {
      min: number;
      max: number;
    };
  };
  retrieve_policy: {
    approved_only: boolean;
    l3_requires_exploratory_label: boolean;
    no_l1_hit_error_hint: string;
    default_weights: RetrieveWeights;
  };
};

export type RuntimePolicyConfigPatch = {
  ingest_policy?: {
    whitelist_gate_enabled?: boolean;
    duplicate_domain_guard_enabled?: boolean;
    trust_level_range?: {
      min?: number;
      max?: number;
    };
  };
  retrieve_policy?: {
    approved_only?: boolean;
    l3_requires_exploratory_label?: boolean;
    no_l1_hit_error_hint?: string;
    default_weights?: {
      r_struct?: number;
      r_keyword?: number;
      r_vector?: number;
      r_quality?: number;
      w_layer?: {
        L1?: number;
        L2?: number;
        L3?: number;
      };
      w_evidence?: {
        A?: number;
        B?: number;
        C?: number;
      };
      conflict_penalty?: number;
    };
  };
};

export function getDefaultRuntimePolicyConfig(): RuntimePolicyConfig {
  return {
    ingest_policy: {
      whitelist_gate_enabled: true,
      duplicate_domain_guard_enabled: true,
      trust_level_range: {
        min: 1,
        max: 5
      }
    },
    retrieve_policy: {
      approved_only: true,
      l3_requires_exploratory_label: true,
      no_l1_hit_error_hint: "only_mid_low_confidence_evidence",
      default_weights: {
        r_struct: 0.4,
        r_keyword: 0.25,
        r_vector: 0.25,
        r_quality: 0.1,
        w_layer: {
          L1: 1.0,
          L2: 0.8,
          L3: 0.6
        },
        w_evidence: {
          A: 1.0,
          B: 0.85,
          C: 0.7
        },
        conflict_penalty: 0.5
      }
    }
  };
}

export function mergeRuntimePolicyConfig(
  current: RuntimePolicyConfig,
  patch: RuntimePolicyConfigPatch
): RuntimePolicyConfig {
  return {
    ingest_policy: {
      whitelist_gate_enabled:
        patch.ingest_policy?.whitelist_gate_enabled ?? current.ingest_policy.whitelist_gate_enabled,
      duplicate_domain_guard_enabled:
        patch.ingest_policy?.duplicate_domain_guard_enabled ?? current.ingest_policy.duplicate_domain_guard_enabled,
      trust_level_range: {
        min: patch.ingest_policy?.trust_level_range?.min ?? current.ingest_policy.trust_level_range.min,
        max: patch.ingest_policy?.trust_level_range?.max ?? current.ingest_policy.trust_level_range.max
      }
    },
    retrieve_policy: {
      approved_only: patch.retrieve_policy?.approved_only ?? current.retrieve_policy.approved_only,
      l3_requires_exploratory_label:
        patch.retrieve_policy?.l3_requires_exploratory_label ?? current.retrieve_policy.l3_requires_exploratory_label,
      no_l1_hit_error_hint:
        patch.retrieve_policy?.no_l1_hit_error_hint ?? current.retrieve_policy.no_l1_hit_error_hint,
      default_weights: {
        r_struct: patch.retrieve_policy?.default_weights?.r_struct ?? current.retrieve_policy.default_weights.r_struct,
        r_keyword: patch.retrieve_policy?.default_weights?.r_keyword ?? current.retrieve_policy.default_weights.r_keyword,
        r_vector: patch.retrieve_policy?.default_weights?.r_vector ?? current.retrieve_policy.default_weights.r_vector,
        r_quality: patch.retrieve_policy?.default_weights?.r_quality ?? current.retrieve_policy.default_weights.r_quality,
        w_layer: {
          L1: patch.retrieve_policy?.default_weights?.w_layer?.L1 ?? current.retrieve_policy.default_weights.w_layer.L1,
          L2: patch.retrieve_policy?.default_weights?.w_layer?.L2 ?? current.retrieve_policy.default_weights.w_layer.L2,
          L3: patch.retrieve_policy?.default_weights?.w_layer?.L3 ?? current.retrieve_policy.default_weights.w_layer.L3
        },
        w_evidence: {
          A: patch.retrieve_policy?.default_weights?.w_evidence?.A ?? current.retrieve_policy.default_weights.w_evidence.A,
          B: patch.retrieve_policy?.default_weights?.w_evidence?.B ?? current.retrieve_policy.default_weights.w_evidence.B,
          C: patch.retrieve_policy?.default_weights?.w_evidence?.C ?? current.retrieve_policy.default_weights.w_evidence.C
        },
        conflict_penalty:
          patch.retrieve_policy?.default_weights?.conflict_penalty ??
          current.retrieve_policy.default_weights.conflict_penalty
      }
    }
  };
}
