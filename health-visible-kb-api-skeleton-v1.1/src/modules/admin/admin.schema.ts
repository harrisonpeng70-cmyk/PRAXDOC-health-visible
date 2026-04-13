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

export type AdminWhitelistQuery = z.infer<typeof AdminWhitelistQuerySchema>;
export type AdminWhitelistParams = z.infer<typeof AdminWhitelistParamsSchema>;
export type CreateWhitelistEntryInput = z.infer<typeof CreateWhitelistEntrySchema>;
export type UpdateWhitelistEntryInput = z.infer<typeof UpdateWhitelistEntrySchema>;
