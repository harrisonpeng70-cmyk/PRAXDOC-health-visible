import { Request, Response } from "express";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/errors/error-codes";
import { sendEnvelope } from "../../core/http/envelope";
import { asyncHandler } from "../../core/http/middleware";
import { AuditExportBodySchema, AuditQuerySchema, AuditStatsQuerySchema } from "./audit.schema";
import {
  exportAuditLogs,
  getAuditLogDetail,
  getAuditLogs,
  getAuditStatsSummary
} from "./audit.service";

export const getLogs = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const filters = AuditQuerySchema.parse(req.query);
  const data = await getAuditLogs(tenantId, filters);
  sendEnvelope(res, "success", "ok", data, null);
});

export const getLogDetail = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const auditId = req.params.auditId;
  const data = await getAuditLogDetail(tenantId, auditId);
  if (!data) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Audit log not found", "audit_not_found");
  }
  sendEnvelope(res, "success", "ok", data, null);
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const query = AuditStatsQuerySchema.parse(req.query);
  const data = await getAuditStatsSummary(tenantId, query.from, query.to);
  sendEnvelope(res, "success", "ok", data, null);
});

export const exportLogs = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const actorId = req.actorId ?? "anonymous";
  const body = AuditExportBodySchema.parse(req.body);
  const data = await exportAuditLogs(tenantId, actorId, body);
  sendEnvelope(res, "success", "export job queued", data, null);
});
