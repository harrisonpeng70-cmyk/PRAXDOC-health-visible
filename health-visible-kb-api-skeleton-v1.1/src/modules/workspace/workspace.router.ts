import { Router } from "express";
import {
  getClientCardsRoute,
  getClientDraftRoute,
  getClientFeedbackRoute,
  getClientTasksRoute,
  getWorkspaceAtomicProfile,
  getWorkspaceSummary,
  recordWorkspaceAction
} from "./workspace.controller";

export const workspaceRouter = Router();

workspaceRouter.get("/clients/:clientId/workspace-summary", getWorkspaceSummary);
workspaceRouter.get("/clients/:clientId/atomic-profile", getWorkspaceAtomicProfile);
workspaceRouter.get("/clients/:clientId/cards", getClientCardsRoute);
workspaceRouter.get("/clients/:clientId/draft", getClientDraftRoute);
workspaceRouter.get("/clients/:clientId/tasks", getClientTasksRoute);
workspaceRouter.get("/clients/:clientId/feedback", getClientFeedbackRoute);
workspaceRouter.post("/clients/:clientId/workspace-actions", recordWorkspaceAction);
