import { NextFunction, Request, Response } from "express";

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const headerActorType = req.header("X-Actor-Type")?.trim().toLowerCase();
  const headerActorId = req.header("X-Actor-Id")?.trim();
  const authHeader = req.header("Authorization");

  if (headerActorType || headerActorId) {
    req.actorType = headerActorType || (authHeader?.startsWith("Bearer ") ? "doctor" : "system");
    req.actorId = headerActorId || (authHeader?.startsWith("Bearer ") ? "token_user" : "anonymous");
    next();
    return;
  }

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
