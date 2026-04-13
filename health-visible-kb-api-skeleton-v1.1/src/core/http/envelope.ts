import { Response } from "express";

export type ResultType = "success" | "partial" | "failed" | "manual_needed";

export function sendEnvelope<T>(
  res: Response,
  status: ResultType,
  message: string,
  data: T,
  errorHint: string | null = null
): Response {
  return res.status(status === "failed" ? 400 : 200).json({
    status,
    message,
    data,
    error_hint: errorHint
  });
}
