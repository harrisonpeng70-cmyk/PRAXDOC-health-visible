import { Router } from "express";
import { requireActorTypes } from "../../core/auth/actor-guard";
import {
  createSourceWhitelistRoute,
  getPolicyConfigRoute,
  getPolicyOverviewRoute,
  listSourceWhitelistRoute,
  updatePolicyConfigRoute,
  updateSourceWhitelistRoute
} from "./admin.controller";

export const adminRouter = Router();

adminRouter.use("/admin", requireActorTypes(["admin"]));
adminRouter.get("/admin/source-whitelist", listSourceWhitelistRoute);
adminRouter.post("/admin/source-whitelist", createSourceWhitelistRoute);
adminRouter.patch("/admin/source-whitelist/:whitelistId", updateSourceWhitelistRoute);
adminRouter.get("/admin/policy-config", getPolicyConfigRoute);
adminRouter.patch("/admin/policy-config", updatePolicyConfigRoute);
adminRouter.get("/admin/policy-overview", getPolicyOverviewRoute);
