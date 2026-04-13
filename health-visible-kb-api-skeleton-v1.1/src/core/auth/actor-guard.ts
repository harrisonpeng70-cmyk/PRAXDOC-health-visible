import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { ErrorCodes } from "../errors/error-codes";

export function requireActorTypes(actorTypes: string[]) {
  const allowed = new Set(
    actorTypes.map((actorType) => actorType.trim().toLowerCase()).filter((actorType) => actorType.length > 0)
  );

  return (req: Request, _res: Response, next: NextFunction): void => {
    const actorType = (req.actorType ?? "system").trim().toLowerCase();
    if (allowed.has(actorType)) {
      next();
      return;
    }

    next(new AppError(403, ErrorCodes.FORBIDDEN, "Actor type is not allowed for this route", "actor_type_not_allowed"));
  };
}
