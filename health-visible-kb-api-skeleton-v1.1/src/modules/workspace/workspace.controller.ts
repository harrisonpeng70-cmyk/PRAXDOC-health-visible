import { Request, Response } from "express";
import { ZodError } from "zod";
import { writeAuditLog } from "../audit/audit.service";
import { AppError } from "../../core/errors/app-error";
import { ErrorCodes } from "../../core/errors/error-codes";
import { sendEnvelope } from "../../core/http/envelope";
import { asyncHandler } from "../../core/http/middleware";
import {
  WorkspaceActionBodySchema,
  WorkspaceAtomicQuerySchema,
  WorkspaceParamsSchema,
  WorkspaceQuerySchema,
  WorkspaceRouteTarget
} from "./workspace.schema";
import {
  getWorkspaceAtomicProfileService,
  createWorkspaceFeedbackStubService,
  createWorkspaceDraftStubService,
  createWorkspaceTaskStubService,
  WorkspaceCreatedStub,
  getWorkspaceRouteSummaryService,
  getWorkspaceSummaryService
} from "./workspace.service";

function mapError(err: unknown): never {
  if (err instanceof AppError) {
    throw err;
  }
  if (err instanceof ZodError) {
    throw new AppError(400, ErrorCodes.PARAM_INVALID, "Invalid request payload", "payload_validation_failed");
  }
  if (err instanceof Error && err.message === "workspace_summary_unavailable") {
    throw new AppError(503, ErrorCodes.INTERNAL_ERROR, "Workspace summary temporarily unavailable", "workspace_summary_unavailable");
  }
  throw new AppError(500, ErrorCodes.INTERNAL_ERROR, "Workspace summary failed", "workspace_summary_failed");
}

export const getWorkspaceSummary = asyncHandler(async (req: Request, res: Response) => {
  let requestPayload: unknown = {
    params: req.params,
    query: req.query
  };

  try {
    const params = WorkspaceParamsSchema.parse(req.params);
    const query = WorkspaceQuerySchema.parse(req.query);
    requestPayload = {
      client_id: params.clientId,
      scenario: query.scenario
    };

    const result = await getWorkspaceSummaryService({
      tenantId: req.tenantId!,
      clientId: params.clientId,
      scenario: query.scenario
    });

    try {
      await writeAuditLog({
        tenantId: req.tenantId!,
        auditTrailId: req.requestId!,
        actorType: req.actorType ?? "doctor",
        actorId: req.actorId ?? null,
        actionType: "query",
        targetObjectType: "workspace_summary",
        targetObjectId: params.clientId,
        resultType: result.result_type,
        requestPayload,
        responsePayload: {
          page_state: result.data.page_state,
          documents: result.data.document_list.length
        }
      });
    } catch {
      // Audit write failure should not block response.
    }

    sendEnvelope(res, result.result_type, "ok", result.data, result.error_hint);
  } catch (err) {
    try {
      await writeAuditLog({
        tenantId: req.tenantId!,
        auditTrailId: req.requestId!,
        actorType: req.actorType ?? "doctor",
        actorId: req.actorId ?? null,
        actionType: "query",
        targetObjectType: "workspace_summary",
        targetObjectId: typeof req.params.clientId === "string" ? req.params.clientId : "unknown",
        resultType: "failed",
        requestPayload,
        responsePayload: {},
        errorCode: err instanceof AppError ? err.errorCode : ErrorCodes.INTERNAL_ERROR,
        errorMessage: err instanceof Error ? err.message : "unknown_error"
      });
    } catch {
      // Audit write failure should not block response.
    }
    mapError(err);
  }
});

export const getWorkspaceAtomicProfile = asyncHandler(async (req: Request, res: Response) => {
  let requestPayload: unknown = {
    params: req.params,
    query: req.query
  };

  try {
    const params = WorkspaceParamsSchema.parse(req.params);
    const query = WorkspaceAtomicQuerySchema.parse(req.query);
    requestPayload = {
      client_id: params.clientId,
      scenario: query.scenario,
      limit: query.limit,
      atom_groups: query.atom_groups,
      confidence_tiers: query.confidence_tiers,
      quality_flags: query.quality_flags
    };

    const result = await getWorkspaceAtomicProfileService({
      tenantId: req.tenantId!,
      clientId: params.clientId,
      scenario: query.scenario,
      limit: query.limit,
      atomGroups: query.atom_groups,
      confidenceTiers: query.confidence_tiers,
      qualityFlags: query.quality_flags
    });

    try {
      await writeAuditLog({
        tenantId: req.tenantId!,
        auditTrailId: req.requestId!,
        actorType: req.actorType ?? "doctor",
        actorId: req.actorId ?? null,
        actionType: "query",
        targetObjectType: "workspace_atomic_profile",
        targetObjectId: params.clientId,
        resultType: result.result_type,
        requestPayload,
        responsePayload: {
          atom_count: result.data.atom_count,
          truncated: result.data.truncated
        }
      });
    } catch {
      // Audit write failure should not block response.
    }

    sendEnvelope(res, result.result_type, "ok", result.data, result.error_hint);
  } catch (err) {
    try {
      await writeAuditLog({
        tenantId: req.tenantId!,
        auditTrailId: req.requestId!,
        actorType: req.actorType ?? "doctor",
        actorId: req.actorId ?? null,
        actionType: "query",
        targetObjectType: "workspace_atomic_profile",
        targetObjectId: typeof req.params.clientId === "string" ? req.params.clientId : "unknown",
        resultType: "failed",
        requestPayload,
        responsePayload: {},
        errorCode: err instanceof AppError ? err.errorCode : ErrorCodes.INTERNAL_ERROR,
        errorMessage: err instanceof Error ? err.message : "unknown_error"
      });
    } catch {
      // Audit write failure should not block response.
    }
    mapError(err);
  }
});

function buildRouteHandler(route: WorkspaceRouteTarget) {
  return asyncHandler(async (req: Request, res: Response) => {
    let requestPayload: unknown = {
      params: req.params,
      query: req.query
    };

    try {
      const params = WorkspaceParamsSchema.parse(req.params);
      const query = WorkspaceQuerySchema.parse(req.query);
      requestPayload = {
        client_id: params.clientId,
        route,
        scenario: query.scenario
      };

      const result = await getWorkspaceRouteSummaryService({
        tenantId: req.tenantId!,
        clientId: params.clientId,
        scenario: query.scenario,
        route
      });

      try {
        await writeAuditLog({
          tenantId: req.tenantId!,
          auditTrailId: req.requestId!,
          actorType: req.actorType ?? "doctor",
          actorId: req.actorId ?? null,
          actionType: "navigate",
          targetObjectType: `${route}_page`,
          targetObjectId: params.clientId,
          resultType: result.result_type,
          requestPayload,
          responsePayload: {
            route: result.data.route,
            route_ready: result.data.route_ready
          }
        });
      } catch {
        // Audit write failure should not block response.
      }

      sendEnvelope(res, result.result_type, "ok", result.data, result.error_hint);
    } catch (err) {
      try {
        await writeAuditLog({
          tenantId: req.tenantId!,
          auditTrailId: req.requestId!,
          actorType: req.actorType ?? "doctor",
          actorId: req.actorId ?? null,
          actionType: "navigate",
          targetObjectType: `${route}_page`,
          targetObjectId: typeof req.params.clientId === "string" ? req.params.clientId : "unknown",
          resultType: "failed",
          requestPayload,
          responsePayload: {},
          errorCode: err instanceof AppError ? err.errorCode : ErrorCodes.INTERNAL_ERROR,
          errorMessage: err instanceof Error ? err.message : "unknown_error"
        });
      } catch {
        // Audit write failure should not block response.
      }
      mapError(err);
    }
  });
}

export const getClientCardsRoute = buildRouteHandler("cards");
export const getClientDraftRoute = buildRouteHandler("draft");
export const getClientTasksRoute = buildRouteHandler("tasks");
export const getClientFeedbackRoute = buildRouteHandler("feedback");

export const recordWorkspaceAction = asyncHandler(async (req: Request, res: Response) => {
  let requestPayload: unknown = {
    params: req.params,
    body: req.body
  };

  try {
    const params = WorkspaceParamsSchema.parse(req.params);
    const body = WorkspaceActionBodySchema.parse(req.body);
    const actorId = req.actorId ?? "anonymous";
    requestPayload = {
      client_id: params.clientId,
      ...body
    };

    let createdStub: WorkspaceCreatedStub | null = null;

    if (body.action_type === "create_draft_stub") {
      createdStub = await createWorkspaceDraftStubService({
        tenantId: req.tenantId!,
        clientId: params.clientId,
        actorId,
        metadata: body.metadata
      });
    } else if (body.action_type === "create_task_stub") {
      createdStub = await createWorkspaceTaskStubService({
        tenantId: req.tenantId!,
        clientId: params.clientId,
        actorId,
        metadata: body.metadata
      });
    } else if (body.action_type === "create_feedback_stub") {
      createdStub = await createWorkspaceFeedbackStubService({
        tenantId: req.tenantId!,
        clientId: params.clientId,
        actorId,
        metadata: body.metadata
      });

      await writeAuditLog({
        tenantId: req.tenantId!,
        auditTrailId: `${req.requestId!}:feedback_stub`,
        actorType: req.actorType ?? "doctor",
        actorId: req.actorId ?? null,
        actionType: "feedback",
        targetObjectType: "feedback_stub",
        targetObjectId: params.clientId,
        resultType: "success",
        requestPayload: {
          client_id: params.clientId,
          metadata: body.metadata
        },
        responsePayload: {
          source: "workspace_actions",
          stub_id: createdStub.stub_id,
          latest_feedback_hint:
            typeof body.metadata?.feedback_hint === "string"
              ? body.metadata.feedback_hint
              : "Feedback stub created."
        }
      });
    }

    await writeAuditLog({
      tenantId: req.tenantId!,
      auditTrailId: req.requestId!,
      actorType: req.actorType ?? "doctor",
      actorId: req.actorId ?? null,
      actionType: "ui_action",
      targetObjectType: body.target_object_type,
      targetObjectId: body.target_object_id ?? params.clientId,
      resultType: "success",
      requestPayload,
      responsePayload: {
        recorded: true,
        created_stub: createdStub
      }
    });

    sendEnvelope(
      res,
      "success",
      "ok",
      {
        recorded: true,
        action_type: body.action_type,
        target_object_type: body.target_object_type,
        target_object_id: body.target_object_id ?? params.clientId,
        client_id: params.clientId,
        created_stub: createdStub
      },
      null
    );
  } catch (err) {
    try {
      await writeAuditLog({
        tenantId: req.tenantId!,
        auditTrailId: req.requestId!,
        actorType: req.actorType ?? "doctor",
        actorId: req.actorId ?? null,
        actionType: "ui_action",
        targetObjectType: "workspace_page",
        targetObjectId: typeof req.params.clientId === "string" ? req.params.clientId : "unknown",
        resultType: "failed",
        requestPayload,
        responsePayload: {},
        errorCode: err instanceof AppError ? err.errorCode : ErrorCodes.INTERNAL_ERROR,
        errorMessage: err instanceof Error ? err.message : "unknown_error"
      });
    } catch {
      // Audit write failure should not block response.
    }
    mapError(err);
  }
});
