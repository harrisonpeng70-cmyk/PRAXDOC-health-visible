import { z } from "zod";

export const CreateSourceSchema = z.object({
  source_name: z.string().min(1),
  source_domain: z.string().min(1),
  source_type: z.string().min(1),
  publication_org: z.string().optional(),
  publication_date: z.string().date().optional(),
  source_version: z.string().optional(),
  source_url: z.string().url(),
  checksum: z.string().optional()
});

export const CreateDocumentSchema = z.object({
  source_id: z.string().uuid(),
  title: z.string().min(1),
  language: z.string().default("zh-CN"),
  raw_storage_uri: z.string().min(1),
  parser_version: z.string().optional(),
  chunk_strategy: z.string().optional()
});

export const VersionPayloadSchema = z.object({
  statement: z.string().min(1),
  applicability: z.string().optional(),
  contraindication: z.string().optional(),
  evidence_level: z.string().min(1),
  confidence_score: z.number().min(0).max(1),
  source_name: z.string().min(1),
  source_url: z.string().url(),
  source_version: z.string().optional(),
  publication_date: z.string().date().optional(),
  citation_span: z.string().optional(),
  checksum: z.string().optional(),
  supersedes_version_id: z.string().uuid().optional()
});

export const CreateEntrySchema = z.object({
  kb_id: z.string().min(1),
  layer: z.enum(["L1", "L2", "L3"]),
  claim_type: z.enum(["judgment", "procedure"]),
  topic: z.string().min(1),
  tags: z.array(z.string()).default([]),
  version: VersionPayloadSchema
});

export const CreateVersionSchema = VersionPayloadSchema;

export const ApproveVersionSchema = z.object({
  reviewer: z.string().min(1),
  review_notes: z.string().optional(),
  valid_from: z.string().datetime().optional(),
  valid_to: z.string().datetime().nullable().optional()
});

export const RejectVersionSchema = z.object({
  reviewer: z.string().min(1),
  review_notes: z.string().min(1)
});

export const PublishSnapshotSchema = z.object({
  snapshot_name: z.string().min(1),
  based_on_time: z.string().datetime(),
  notes: z.string().optional()
});
