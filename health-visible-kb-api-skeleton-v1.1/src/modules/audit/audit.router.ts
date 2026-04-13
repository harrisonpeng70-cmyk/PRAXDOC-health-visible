import { Router } from "express";
import { exportLogs, getLogDetail, getLogs, getStats } from "./audit.controller";

export const auditRouter = Router();

auditRouter.get("/audit/logs", getLogs);
auditRouter.get("/audit/logs/:auditId", getLogDetail);
auditRouter.get("/audit/stats", getStats);
auditRouter.post("/audit/export", exportLogs);
