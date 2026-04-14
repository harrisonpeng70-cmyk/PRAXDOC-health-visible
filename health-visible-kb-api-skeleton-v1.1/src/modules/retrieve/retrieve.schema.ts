import { z } from "zod";

const RetrieveWeightsInputSchema = z.object({
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
});

export const RetrieveSearchSchema = z.object({
  client_id: z.string().optional(),
  query_text: z.string().min(1),
  filters: z
    .object({
      layers: z.array(z.enum(["L1", "L2", "L3"])).optional(),
      claim_types: z.array(z.enum(["judgment", "procedure"])).optional(),
      topics: z.array(z.string()).optional(),
      evidence_levels: z.array(z.string()).optional()
    })
    .default({}),
  weights: RetrieveWeightsInputSchema.optional(),
  top_k: z.number().int().min(1).max(100).default(10),
  need_explain: z.boolean().default(true)
});

export const ConflictQuerySchema = z.object({
  resolution_status: z.enum(["open", "resolved", "ignored"]).optional(),
  severity_gte: z.coerce.number().int().min(1).max(5).optional()
});

export type RetrieveWeightsInput = z.infer<typeof RetrieveWeightsInputSchema>;
