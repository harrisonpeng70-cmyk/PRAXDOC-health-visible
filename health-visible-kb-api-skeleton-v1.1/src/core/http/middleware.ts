import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error";
import { ErrorCodes } from "../errors/error-codes";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = req.header("X-Request-Id") || randomUUID();
  next();
}

export function notFoundMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, ErrorCodes.NOT_FOUND, "Route not found", "route_not_found"));
}

function logErrorSafely(err: unknown): void {
  try {
    if (err instanceof Error) {
      console.error("[ERROR_MIDDLEWARE]", err.name, err.message);
      if (err.stack) {
        const stackPreview = err.stack.split("\n").slice(0, 5).join("\n");
        console.error(stackPreview);
      }
      return;
    }
    console.error("[ERROR_MIDDLEWARE]", String(err));
  } catch {
    // Logging should never break HTTP error responses.
  }
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  // Keep explicit server-side logs for troubleshooting while returning normalized envelopes.
  logErrorSafely(err);
  if (
    err instanceof SyntaxError &&
    typeof (err as { status?: number }).status === "number" &&
    (err as { status?: number }).status === 400
  ) {
    return res.status(400).json({
      status: "failed",
      message: "Invalid JSON body",
      data: {
        request_id: req.requestId
      },
      error_hint: ErrorCodes.PARAM_INVALID
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      status: "failed",
      message: "Invalid request payload",
      data: {
        request_id: req.requestId
      },
      error_hint: "payload_validation_failed"
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: "failed",
      message: err.message,
      data: {
        request_id: req.requestId
      },
      error_hint: err.errorHint ?? err.errorCode
    });
  }

  return res.status(500).json({
    status: "failed",
    message: "Internal server error",
    data: {
      request_id: req.requestId
    },
    error_hint: ErrorCodes.INTERNAL_ERROR
  });
}
