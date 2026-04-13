import { Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/errors/error-codes";
import { sendEnvelope } from "../../core/http/envelope";
import { asyncHandler } from "../../core/http/middleware";
import { writeAuditLog } from "../audit/audit.service";
import {
  ApproveVersionSchema,
  CreateDocumentSchema,
  CreateEntrySchema,
  CreateSourceSchema,
  CreateVersionSchema,
  PublishSnapshotSchema,
  RejectVersionSchema
} from "./ingest.schema";
import {
  approveVersionService,
  createDocumentService,
  createEntryService,
  createSourceService,
  createVersionService,
  getJobService,
  publishSnapshotService,
  rejectVersionService
} from "./ingest.service";

async function auditSuccess(
  req: Request,
  actionType: string,
  targetObjectType: string,
  targetObjectId: string,
  requestPayload: unknown,
  responsePayload: unknown
): Promise<void> {
  try {
    await writeAuditLog({
      tenantId: req.tenantId!,
      auditTrailId: req.requestId!,
      actorType: req.actorType ?? "system",
      actorId: req.actorId ?? null,
      actionType,
      targetObjectType,
      targetObjectId,
      resultType: "success",
      requestPayload,
      responsePayload
    });
  } catch {
    // 审计失败不应影响主流程结果返回
  }
}

async function auditFailure(req: Request, actionType: string, requestPayload: unknown, error: unknown): Promise<void> {
  try {
    await writeAuditLog({
      tenantId: req.tenantId!,
      auditTrailId: req.requestId!,
      actorType: req.actorType ?? "system",
      actorId: req.actorId ?? null,
      actionType,
      targetObjectType: "unknown",
      targetObjectId: "unknown",
      resultType: "failed",
      requestPayload,
      responsePayload: {},
      errorCode: error instanceof AppError ? error.errorCode : ErrorCodes.INTERNAL_ERROR,
      errorMessage: error instanceof Error ? error.message : "unknown_error"
    });
  } catch {
    // 审计失败不应影响主流程结果返回
  }
}

function mapError(err: unknown): never {
  if (err instanceof AppError) {
    throw err;
  }
  if (err instanceof ZodError) {
    throw new AppError(400, ErrorCodes.PARAM_INVALID, "Invalid request payload", "payload_validation_failed");
  }
  if (err instanceof Error && err.message === "source_not_whitelisted") {
    throw new AppError(
      422,
      ErrorCodes.SOURCE_NOT_WHITELISTED,
      "Source is not allowed by whitelist policy",
      "source_blocked_by_whitelist"
    );
  }
  if (err instanceof Error && err.message === "entry_not_found") {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Entry not found", "entry_not_found");
  }
  if (err instanceof Error && err.message === "version_not_found") {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Version not found", "version_not_found");
  }
  throw new AppError(500, ErrorCodes.INTERNAL_ERROR, "Unexpected server error", "unexpected_error");
}

export const createSource = asyncHandler(async (req: Request, res: Response) => {
  let requestPayload: unknown = req.body;
  try {
    const body = CreateSourceSchema.parse(req.body);
    requestPayload = body;
    const data = await createSourceService(req.tenantId!, req.actorId ?? "anonymous", body);
    await auditSuccess(req, "ingest", "source", data.source_id, body, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "ingest", requestPayload, err);
    mapError(err);
  }
});

export const createDocument = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateDocumentSchema.parse(req.body);
  try {
    const data = await createDocumentService(req.tenantId!, req.actorId ?? "anonymous", body);
    await auditSuccess(req, "ingest", "document", data.document_id, body, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "ingest", body, err);
    mapError(err);
  }
});

export const createEntry = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateEntrySchema.parse(req.body);
  try {
    const data = await createEntryService(req.tenantId!, req.actorId ?? "anonymous", body);
    await auditSuccess(req, "create_version", "entry", data.entry_id, body, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "create_version", body, err);
    mapError(err);
  }
});

export const createVersion = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateVersionSchema.parse(req.body);
  const entryId = req.params.entryId;
  try {
    const data = await createVersionService(req.tenantId!, req.actorId ?? "anonymous", entryId, body);
    await auditSuccess(req, "create_version", "version", data.version_id, body, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "create_version", body, err);
    mapError(err);
  }
});

export const approveVersion = asyncHandler(async (req: Request, res: Response) => {
  const body = ApproveVersionSchema.parse(req.body);
  const versionId = req.params.versionId;
  try {
    const data = await approveVersionService(req.tenantId!, versionId, body);
    await auditSuccess(req, "approve", "version", data.version_id, body, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "approve", body, err);
    mapError(err);
  }
});

export const rejectVersion = asyncHandler(async (req: Request, res: Response) => {
  const body = RejectVersionSchema.parse(req.body);
  const versionId = req.params.versionId;
  try {
    const data = await rejectVersionService(req.tenantId!, versionId, body);
    await auditSuccess(req, "reject", "version", data.version_id, body, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "reject", body, err);
    mapError(err);
  }
});

export const publishSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const body = PublishSnapshotSchema.parse(req.body);
  try {
    const data = await publishSnapshotService(req.tenantId!, req.actorId ?? "anonymous", body);
    await auditSuccess(req, "snapshot", "snapshot", data.snapshot_id, body, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "snapshot", body, err);
    mapError(err);
  }
});

export const getJob = asyncHandler(async (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  try {
    const data = await getJobService(req.tenantId!, jobId);
    if (!data) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Job not found", "job_not_found");
    }
    await auditSuccess(req, "query", "job", data.job_id, {}, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "query", {}, err);
    mapError(err);
  }
});
