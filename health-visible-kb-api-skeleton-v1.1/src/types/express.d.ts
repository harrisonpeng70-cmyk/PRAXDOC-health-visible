import "express";

declare global {
  namespace Express {
    interface Request {
      actorId?: string;
      actorType?: string;
      tenantId?: string;
      requestId?: string;
    }
  }
}

export {};
