import { z } from "zod";

export const AuditQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  actor_type: z.string().optional(),
  action_type: z.string().optional(),
  target_object_type: z.string().optional(),
  result_type: z.enum(["success", "partial", "failed", "manual_needed"]).optional(),
  audit_trail_id: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20)
});

export const AuditStatsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime()
});

export const AuditExportBodySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  format: z.enum(["csv", "json"])
});
