import { NextFunction, Request, Response } from "express";

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.actorType = "system";
    req.actorId = "anonymous";
    next();
    return;
  }

  req.actorType = "doctor";
  req.actorId = "token_user";
  next();
}
