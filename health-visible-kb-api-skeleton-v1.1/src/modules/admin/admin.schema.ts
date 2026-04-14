import { z } from "zod";

function parseBoolean(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return value;
}

const DateStringSchema = z.string().date();
const NullableDateStringSchema = z.union([DateStringSchema, z.null()]);

export const AdminWhitelistQuerySchema = z.object({
  enabled: z.preprocess((value) => parseBoolean(value), z.boolean()).optional(),
  source_type: z.string().trim().min(1).max(64).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20)
});

export const AdminWhitelistParamsSchema = z.object({
  whitelistId: z.coerce.number().int().positive()
});

export const CreateWhitelistEntrySchema = z.object({
  source_name: z.string().trim().min(1).max(160),
  source_domain: z.string().trim().min(1).max(255),
  source_type: z.string().trim().min(1).max(64),
  trust_level: z.coerce.number().int().min(1).max(5),
  enabled: z.boolean().default(true),
  effective_from: DateStringSchema.optional(),
  effective_to: DateStringSchema.optional()
});

export const UpdateWhitelistEntrySchema = z
  .object({
    source_name: z.string().trim().min(1).max(160).optional(),
    source_domain: z.string().trim().min(1).max(255).optional(),
    source_type: z.string().trim().min(1).max(64).optional(),
    trust_level: z.coerce.number().int().min(1).max(5).optional(),
    enabled: z.boolean().optional(),
    effective_from: NullableDateStringSchema.optional(),
    effective_to: NullableDateStringSchema.optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided"
  });

const RetrieveWeightsSchema = z.object({
  r_struct: z.number().min(0).max(1),
  r_keyword: z.number().min(0).max(1),
  r_vector: z.number().min(0).max(1),
  r_quality: z.number().min(0).max(1),
  w_layer: z.object({
    L1: z.number().min(0).max(5),
    L2: z.number().min(0).max(5),
    L3: z.number().min(0).max(5)
  }),
  w_evidence: z.object({
    A: z.number().min(0).max(5),
    B: z.number().min(0).max(5),
    C: z.number().min(0).max(5)
  }),
  conflict_penalty: z.number().min(0).max(1)
});

const RetrieveWeightsPatchSchema = z
  .object({
    r_struct: z.number().min(0).max(1).optional(),
    r_keyword: z.number().min(0).max(1).optional(),
    r_vector: z.number().min(0).max(1).optional(),
    r_quality: z.number().min(0).max(1).optional(),
    w_layer: z
      .object({
        L1: z.number().min(0).max(5).optional(),
        L2: z.number().min(0).max(5).optional(),
        L3: z.number().min(0).max(5).optional()
      })
      .optional(),
    w_evidence: z
      .object({
        A: z.number().min(0).max(5).optional(),
        B: z.number().min(0).max(5).optional(),
        C: z.number().min(0).max(5).optional()
      })
      .optional(),
    conflict_penalty: z.number().min(0).max(1).optional()
  })
  .refine(
    (payload) =>
      Object.keys(payload).length > 0 ||
      payload.w_layer !== undefined ||
      payload.w_evidence !== undefined,
    {
      message: "At least one weight field must be provided"
    }
  );

export const AdminPolicyConfigSchema = z.object({
  ingest_policy: z
    .object({
      whitelist_gate_enabled: z.boolean(),
      duplicate_domain_guard_enabled: z.boolean(),
      trust_level_range: z
        .object({
          min: z.coerce.number().int().min(1).max(5),
          max: z.coerce.number().int().min(1).max(5)
        })
        .refine((value) => value.min <= value.max, {
          message: "trust_level_range min must be less than or equal to max"
        })
    }),
  retrieve_policy: z.object({
    approved_only: z.boolean(),
    l3_requires_exploratory_label: z.boolean(),
    no_l1_hit_error_hint: z.string().trim().min(1).max(128),
    default_weights: RetrieveWeightsSchema
  })
});

export const AdminPolicyConfigResponseSchema = AdminPolicyConfigSchema.extend({
  updated_by: z.string().min(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1)
});

export const UpdatePolicyConfigSchema = z
  .object({
    ingest_policy: z
      .object({
        whitelist_gate_enabled: z.boolean().optional(),
        duplicate_domain_guard_enabled: z.boolean().optional(),
        trust_level_range: z
          .object({
            min: z.coerce.number().int().min(1).max(5).optional(),
            max: z.coerce.number().int().min(1).max(5).optional()
          })
          .optional()
      })
      .optional(),
    retrieve_policy: z
      .object({
        approved_only: z.boolean().optional(),
        l3_requires_exploratory_label: z.boolean().optional(),
        no_l1_hit_error_hint: z.string().trim().min(1).max(128).optional(),
        default_weights: RetrieveWeightsPatchSchema.optional()
      })
      .optional()
  })
  .refine((payload) => payload.ingest_policy !== undefined || payload.retrieve_policy !== undefined, {
    message: "At least one policy section must be provided"
  });

export type AdminWhitelistQuery = z.infer<typeof AdminWhitelistQuerySchema>;
export type AdminWhitelistParams = z.infer<typeof AdminWhitelistParamsSchema>;
export type CreateWhitelistEntryInput = z.infer<typeof CreateWhitelistEntrySchema>;
export type UpdateWhitelistEntryInput = z.infer<typeof UpdateWhitelistEntrySchema>;
export type AdminPolicyConfig = z.infer<typeof AdminPolicyConfigSchema>;
export type AdminPolicyConfigResponse = z.infer<typeof AdminPolicyConfigResponseSchema>;
export type UpdatePolicyConfigInput = z.infer<typeof UpdatePolicyConfigSchema>;
