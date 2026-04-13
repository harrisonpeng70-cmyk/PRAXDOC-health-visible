import { ErrorCode } from "./error-codes";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly errorHint?: string;

  constructor(statusCode: number, errorCode: ErrorCode, message: string, errorHint?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errorHint = errorHint;
  }
}
