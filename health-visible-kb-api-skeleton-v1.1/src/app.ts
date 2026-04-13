import express from "express";
import path from "path";
import { authMiddleware } from "./core/auth/auth-middleware";
import { errorMiddleware, notFoundMiddleware, requestIdMiddleware } from "./core/http/middleware";
import { tenantGuard } from "./core/tenant/tenant-guard";
import { adminRouter } from "./modules/admin/admin.router";
import { auditRouter } from "./modules/audit/audit.router";
import { ingestRouter } from "./modules/ingest/ingest.router";
import { retrieveRouter } from "./modules/retrieve/retrieve.router";
import { workspaceRouter } from "./modules/workspace/workspace.router";

export function buildApp() {
  const app = express();

  // Lightweight v1 doctor workspace page preview for local integration.
  app.use(
    "/client-workspace-page-v1",
    express.static(path.join(process.cwd(), "public", "client-workspace-page-v1"))
  );

  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "2mb" }));
  app.use(authMiddleware);
  app.use(tenantGuard);

  app.get("/kb/v1/health", (_req, res) => {
    res.status(200).json({
      status: "success",
      message: "ok",
      data: { alive: true },
      error_hint: null
    });
  });

  app.use("/kb/v1", ingestRouter);
  app.use("/kb/v1", retrieveRouter);
  app.use("/kb/v1", auditRouter);
  app.use("/kb/v1", workspaceRouter);
  app.use("/kb/v1", adminRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
