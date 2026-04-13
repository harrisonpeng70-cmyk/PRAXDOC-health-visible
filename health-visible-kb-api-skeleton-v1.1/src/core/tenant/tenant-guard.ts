import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { ErrorCodes } from "../errors/error-codes";

const UUID_FORMAT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tenantGuard(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = req.header("X-Tenant-Id");
  if (!tenantId) {
    next(new AppError(400, ErrorCodes.PARAM_INVALID, "X-Tenant-Id is required", "tenant_id_required"));
    return;
  }

  if (!UUID_FORMAT_REGEX.test(tenantId)) {
    next(new AppError(400, ErrorCodes.PARAM_INVALID, "X-Tenant-Id must be a valid UUID", "tenant_id_invalid_uuid"));
    return;
  }

  req.tenantId = tenantId;
  next();
}
