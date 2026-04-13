import { z } from "zod";

export const WorkspaceScenarioSchema = z.enum(["auto", "full", "files_only", "partial", "empty", "error"]);
export const WorkspaceRouteTargetSchema = z.enum(["cards", "draft", "tasks", "feedback"]);
export const WorkspaceActionTypeSchema = z.enum([
  "open_file",
  "open_structured",
  "open_timeline",
  "open_chart",
  "go_cards",
  "go_draft",
  "go_tasks",
  "go_feedback",
  "reload_workspace",
  "create_draft_stub",
  "create_task_stub",
  "create_feedback_stub"
]);

export const WorkspaceParamsSchema = z.object({
  clientId: z.string().min(1).max(64)
});

export const WorkspaceQuerySchema = z.object({
  scenario: WorkspaceScenarioSchema.default("auto")
});

export const WorkspaceAtomicGroupSchema = z.enum([
  "profile",
  "document",
  "extraction",
  "trend",
  "cards",
  "draft",
  "tasks",
  "feedback"
]);

export const WorkspaceAtomicTierSchema = z.enum(["L1", "L2", "L3", "system"]);

export const WorkspaceAtomicQualityFlagSchema = z.enum([
  "needs_manual_review",
  "potential_conflict",
  "derived_from_summary",
  "normalized_unit_inferred",
  "missing_observed_at",
  "out_of_reference_range"
]);

function parseQueryList(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return undefined;
}

export const WorkspaceAtomicQuerySchema = WorkspaceQuerySchema.extend({
  limit: z.coerce.number().int().min(10).max(500).default(120),
  atom_groups: z
    .preprocess((value) => parseQueryList(value), z.array(WorkspaceAtomicGroupSchema))
    .optional()
    .default([]),
  confidence_tiers: z
    .preprocess((value) => parseQueryList(value), z.array(WorkspaceAtomicTierSchema))
    .optional()
    .default([]),
  quality_flags: z
    .preprocess((value) => parseQueryList(value), z.array(WorkspaceAtomicQualityFlagSchema))
    .optional()
    .default([])
});

export const WorkspaceActionBodySchema = z.object({
  action_type: WorkspaceActionTypeSchema,
  target_object_type: z.string().min(1).max(64).default("workspace_page"),
  target_object_id: z.string().min(1).max(128).optional(),
  metadata: z.record(z.unknown()).default({})
});

export type WorkspaceScenario = z.infer<typeof WorkspaceScenarioSchema>;
export type WorkspaceRouteTarget = z.infer<typeof WorkspaceRouteTargetSchema>;
export type WorkspaceActionType = z.infer<typeof WorkspaceActionTypeSchema>;
