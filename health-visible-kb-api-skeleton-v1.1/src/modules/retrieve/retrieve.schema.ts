import { z } from "zod";

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
  weights: z
    .object({
      r_struct: z.number().default(0.4),
      r_keyword: z.number().default(0.25),
      r_vector: z.number().default(0.25),
      r_quality: z.number().default(0.1),
      w_layer: z
        .object({
          L1: z.number().default(1.0),
          L2: z.number().default(0.8),
          L3: z.number().default(0.6)
        })
        .default({ L1: 1.0, L2: 0.8, L3: 0.6 }),
      w_evidence: z.record(z.number()).default({ A: 1.0, B: 0.85, C: 0.7 }),
      conflict_penalty: z.number().default(0.5)
    })
    .default({
      r_struct: 0.4,
      r_keyword: 0.25,
      r_vector: 0.25,
      r_quality: 0.1,
      w_layer: { L1: 1.0, L2: 0.8, L3: 0.6 },
      w_evidence: { A: 1.0, B: 0.85, C: 0.7 },
      conflict_penalty: 0.5
    }),
  top_k: z.number().int().min(1).max(100).default(10),
  need_explain: z.boolean().default(true)
});

export const ConflictQuerySchema = z.object({
  resolution_status: z.enum(["open", "resolved", "ignored"]).optional(),
  severity_gte: z.coerce.number().int().min(1).max(5).optional()
});
