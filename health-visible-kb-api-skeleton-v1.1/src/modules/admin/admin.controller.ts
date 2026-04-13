import { Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/errors/error-codes";
import { sendEnvelope } from "../../core/http/envelope";
import { asyncHandler } from "../../core/http/middleware";
import { writeAuditLog } from "../audit/audit.service";
import {
  AdminWhitelistParamsSchema,
  AdminWhitelistQuerySchema,
  CreateWhitelistEntrySchema,
  UpdateWhitelistEntrySchema
} from "./admin.schema";
import {
  createSourceWhitelistEntryService,
  getPolicyOverviewService,
  listSourceWhitelistService,
  updateSourceWhitelistEntryService
} from "./admin.service";

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
      actorType: req.actorType ?? "admin",
      actorId: req.actorId ?? null,
      actionType,
      targetObjectType,
      targetObjectId,
      resultType: "success",
      requestPayload,
      responsePayload
    });
  } catch {
    // Audit write failure should not block admin responses.
  }
}

async function auditFailure(req: Request, actionType: string, requestPayload: unknown, error: unknown): Promise<void> {
  try {
    await writeAuditLog({
      tenantId: req.tenantId!,
      auditTrailId: req.requestId!,
      actorType: req.actorType ?? "admin",
      actorId: req.actorId ?? null,
      actionType,
      targetObjectType: "admin",
      targetObjectId: "unknown",
      resultType: "failed",
      requestPayload,
      responsePayload: {},
      errorCode: error instanceof AppError ? error.errorCode : ErrorCodes.INTERNAL_ERROR,
      errorMessage: error instanceof Error ? error.message : "unknown_error"
    });
  } catch {
    // Audit write failure should not block admin responses.
  }
}

function mapError(err: unknown): never {
  if (err instanceof AppError) {
    throw err;
  }
  if (err instanceof ZodError) {
    throw new AppError(400, ErrorCodes.PARAM_INVALID, "Invalid request payload", "payload_validation_failed");
  }
  if (err instanceof Error && err.message === "whitelist_not_found") {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Whitelist entry not found", "whitelist_not_found");
  }
  if (err instanceof Error && err.message === "whitelist_invalid_effective_range") {
    throw new AppError(
      400,
      ErrorCodes.PARAM_INVALID,
      "Whitelist effective range is invalid",
      "whitelist_invalid_effective_range"
    );
  }

  const errorCode = typeof (err as { code?: unknown })?.code === "string" ? (err as { code: string }).code : null;
  if (errorCode === "23505") {
    throw new AppError(
      409,
      ErrorCodes.DUPLICATE_RESOURCE,
      "Whitelist entry for this domain already exists",
      "whitelist_domain_exists"
    );
  }

  throw new AppError(500, ErrorCodes.INTERNAL_ERROR, "Admin request failed", "admin_request_failed");
}

export const listSourceWhitelistRoute = asyncHandler(async (req: Request, res: Response) => {
  let requestPayload: unknown = req.query;
  try {
    const query = AdminWhitelistQuerySchema.parse(req.query);
    requestPayload = query;
    const data = await listSourceWhitelistService(req.tenantId!, query);
    await auditSuccess(req, "admin_query", "source_whitelist", "list", query, {
      total: data.total,
      page: data.page,
      page_size: data.page_size
    });
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "admin_query", requestPayload, err);
    mapError(err);
  }
});

export const createSourceWhitelistRoute = asyncHandler(async (req: Request, res: Response) => {
  let requestPayload: unknown = req.body;
  try {
    const body = CreateWhitelistEntrySchema.parse(req.body);
    requestPayload = body;
    const data = await createSourceWhitelistEntryService(req.tenantId!, req.actorId ?? "admin", body);
    await auditSuccess(req, "admin_create", "source_whitelist", data.whitelist_id, body, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "admin_create", requestPayload, err);
    mapError(err);
  }
});

export const updateSourceWhitelistRoute = asyncHandler(async (req: Request, res: Response) => {
  let requestPayload: unknown = {
    params: req.params,
    body: req.body
  };
  try {
    const params = AdminWhitelistParamsSchema.parse(req.params);
    const body = UpdateWhitelistEntrySchema.parse(req.body);
    requestPayload = {
      whitelist_id: params.whitelistId,
      ...body
    };

    const data = await updateSourceWhitelistEntryService(req.tenantId!, params.whitelistId, body);
    if (!data) {
      throw new Error("whitelist_not_found");
    }

    await auditSuccess(req, "admin_update", "source_whitelist", data.whitelist_id, requestPayload, data);
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "admin_update", requestPayload, err);
    mapError(err);
  }
});

export const getPolicyOverviewRoute = asyncHandler(async (req: Request, res: Response) => {
  try {
    const data = await getPolicyOverviewService(req.tenantId!);
    await auditSuccess(req, "admin_query", "policy_overview", req.tenantId!, {}, {
      whitelist_entries: data.whitelist_summary.total_entries
    });
    sendEnvelope(res, "success", "ok", data, null);
  } catch (err) {
    await auditFailure(req, "admin_query", {}, err);
    mapError(err);
  }
});
