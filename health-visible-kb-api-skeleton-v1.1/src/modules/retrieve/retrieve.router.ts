import { Router } from "express";
import { getConflicts, getEntry, getVersions, search } from "./retrieve.controller";

export const retrieveRouter = Router();

retrieveRouter.post("/retrieve/search", search);
retrieveRouter.get("/entries/:entryId", getEntry);
retrieveRouter.get("/entries/:entryId/versions", getVersions);
retrieveRouter.get("/conflicts", getConflicts);
