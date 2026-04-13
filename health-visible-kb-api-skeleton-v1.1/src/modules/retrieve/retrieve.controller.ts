import { Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/errors/error-codes";
import { sendEnvelope } from "../../core/http/envelope";
import { asyncHandler } from "../../core/http/middleware";
import { writeAuditLog } from "../audit/audit.service";
import { ConflictQuerySchema, RetrieveSearchSchema } from "./retrieve.schema";
import {
  getConflictsService,
  getEntryService,
  getVersionsService,
  searchService
} from "./retrieve.service";

function mapError(err: unknown): never {
  if (err instanceof AppError) {
    throw err;
  }
  if (err instanceof ZodError) {
    throw new AppError(400, ErrorCodes.PARAM_INVALID, "Invalid request payload", "payload_validation_failed");
  }
  throw new AppError(500, ErrorCodes.RETRIEVE_ENGINE_ERROR, "Retrieve failed", "retrieve_failed");
}

export const search = asyncHandler(async (req: Request, res: Response) => {
  let requestPayload: unknown = req.body;
  try {
    const body = RetrieveSearchSchema.parse(req.body);
    requestPayload = body;
    const data = await searchService({
      tenantId: req.tenantId!,
      actorType: req.actorType ?? "doctor",
      actorId: req.actorId ?? "anonymous",
      clientId: body.client_id ?? null,
      queryText: body.query_text,
      filters: {
        layers: body.filters.layers,
        claim_types: body.filters.claim_types,
        topics: body.filters.topics,
        evidence_levels: body.filters.evidence_levels
      },
      weights: body.weights,
      topK: body.top_k
    });

    try {
      await writeAuditLog({
        tenantId: req.tenantId!,
        auditTrailId: req.requestId!,
        actorType: req.actorType ?? "doctor",
        actorId: req.actorId ?? null,
        actionType: "query",
        targetObjectType: "query",
        targetObjectId: data.query_id,
        resultType: data.result_type,
        requestPayload: body,
        responsePayload: {
          state: data.state,
          hits: Array.isArray(data.hits) ? data.hits.length : 0
        }
      });
    } catch {
      // 审计失败不应影响主流程结果返回
    }

    sendEnvelope(res, data.result_type, "ok", data, data.error_hint);
  } catch (err) {
    try {
      await writeAuditLog({
        tenantId: req.tenantId!,
        auditTrailId: req.requestId!,
        actorType: req.actorType ?? "doctor",
        actorId: req.actorId ?? null,
        actionType: "query",
        targetObjectType: "query",
        targetObjectId: "unknown",
        resultType: "failed",
        requestPayload,
        responsePayload: {},
        errorCode: err instanceof AppError ? err.errorCode : ErrorCodes.RETRIEVE_ENGINE_ERROR,
        errorMessage: err instanceof Error ? err.message : "unknown_error"
      });
    } catch {
      // 审计失败不应影响主流程结果返回
    }
    mapError(err);
  }
});

export const getEntry = asyncHandler(async (req: Request, res: Response) => {
  const entryId = req.params.entryId;
  const data = await getEntryService(req.tenantId!, entryId);
  if (!data) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Entry not found", "entry_not_found");
  }
  sendEnvelope(res, "success", "ok", data, null);
});

export const getVersions = asyncHandler(async (req: Request, res: Response) => {
  const entryId = req.params.entryId;
  const data = await getVersionsService(req.tenantId!, entryId);
  sendEnvelope(
    res,
    "success",
    "ok",
    {
      items: data
    },
    null
  );
});

export const getConflicts = asyncHandler(async (req: Request, res: Response) => {
  const query = ConflictQuerySchema.parse(req.query);
  const data = await getConflictsService(req.tenantId!, query.resolution_status, query.severity_gte);
  sendEnvelope(
    res,
    "success",
    "ok",
    {
      items: data
    },
    null
  );
});
