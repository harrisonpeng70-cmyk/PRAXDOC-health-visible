import { Router } from "express";
import {
  approveVersion,
  createDocument,
  createEntry,
  createSource,
  createVersion,
  getJob,
  publishSnapshot,
  rejectVersion
} from "./ingest.controller";

export const ingestRouter = Router();

ingestRouter.post("/sources", createSource);
ingestRouter.post("/documents", createDocument);
ingestRouter.post("/entries", createEntry);
ingestRouter.post("/entries/:entryId/versions", createVersion);
ingestRouter.post("/reviews/:versionId/approve", approveVersion);
ingestRouter.post("/reviews/:versionId/reject", rejectVersion);
ingestRouter.post("/snapshots/publish", publishSnapshot);
ingestRouter.get("/jobs/:jobId", getJob);
