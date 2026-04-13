# Preflight Report

- generated_at: 2026-04-13 11:27:08+08:00
- workspace: C:\Users\Y9000P\Desktop\健康可行临时文件夹\2604进行中文件\health-visible-kb-api-skeleton-v1.1
- run_started_at: 2026-04-13 11:26:45+08:00
- run_ended_at: 2026-04-13 11:27:08+08:00
- total_duration_seconds: 22.82
- overall_status: passed

| step | command | exit_code | duration_seconds | passed |
| --- | --- | ---: | ---: | --- |
| typecheck | D:\Program Files\nodejs\npm.cmd run check | 0 | 1.26 | True |
| build | D:\Program Files\nodejs\npm.cmd run build | 0 | 1.31 | True |
| smoke_all | D:\Program Files\nodejs\npm.cmd run smoke:all | 0 | 20.22 | True |

## Step: typecheck

- status: passed
- started_at: 2026-04-13 11:26:45+08:00
- ended_at: 2026-04-13 11:26:46+08:00
- duration_seconds: 1.26
- command: D:\Program Files\nodejs\npm.cmd run check

```text
> health-visible-kb-api-skeleton-v1.1@1.1.0 check
> tsc --noEmit
```

## Step: build

- status: passed
- started_at: 2026-04-13 11:26:46+08:00
- ended_at: 2026-04-13 11:26:48+08:00
- duration_seconds: 1.31
- command: D:\Program Files\nodejs\npm.cmd run build

```text
> health-visible-kb-api-skeleton-v1.1@1.1.0 build
> tsc -p tsconfig.json
```

## Step: smoke_all

- status: passed
- started_at: 2026-04-13 11:26:48+08:00
- ended_at: 2026-04-13 11:27:08+08:00
- duration_seconds: 20.22
- command: D:\Program Files\nodejs\npm.cmd run smoke:all

```text
> health-visible-kb-api-skeleton-v1.1@1.1.0 smoke:all
> npm run smoke:sources && npm run smoke:retrieve-audit && npm run smoke:workspace && npm run smoke:workspace-page && npm run smoke:edge


> health-visible-kb-api-skeleton-v1.1@1.1.0 smoke:sources
> powershell -ExecutionPolicy Bypass -File ./scripts/smoke-sources.ps1 -Port 18081


case           status error_hint                  passed
----           ------ ----------                  ------
invalid_tenant    400 tenant_id_invalid_uuid        True
blocked_domain    422 source_blocked_by_whitelist   True
allowed_domain    200                               True


[
    {
        "case":  "invalid_tenant",
        "status":  400,
        "error_hint":  "tenant_id_invalid_uuid",
        "passed":  true
    },
    {
        "case":  "blocked_domain",
        "status":  422,
        "error_hint":  "source_blocked_by_whitelist",
        "passed":  true
    },
    {
        "case":  "allowed_domain",
        "status":  200,
        "error_hint":  null,
        "passed":  true
    }
]
Smoke test passed.

> health-visible-kb-api-skeleton-v1.1@1.1.0 smoke:retrieve-audit
> powershell -ExecutionPolicy Bypass -File ./scripts/smoke-retrieve-audit.ps1 -Port 18081


case                    status detail                               passed
----                    ------ ------                               ------
retrieve_partial_l3        200 only_mid_low_confidence_evidence       True
retrieve_ready_l1          200 ready                                  True
conflicts_open             200 1                                      True
audit_logs_list            200 223                                    True
audit_log_detail           200 ad93b11a-f021-4a90-8a44-31aa1227f849   True
audit_stats                200 223                                    True
audit_export_job           200 9bbdab78-bb8f-4c42-a7cc-c6bc22e4bed9   True
audit_stats_invalid_400    400 payload_validation_failed              True


[
    {
        "case":  "retrieve_partial_l3",
        "status":  200,
        "detail":  "only_mid_low_confidence_evidence",
        "passed":  true
    },
    {
        "case":  "retrieve_ready_l1",
        "status":  200,
        "detail":  "ready",
        "passed":  true
    },
    {
        "case":  "conflicts_open",
        "status":  200,
        "detail":  "1",
        "passed":  true
    },
    {
        "case":  "audit_logs_list",
        "status":  200,
        "detail":  "223",
        "passed":  true
    },
    {
        "case":  "audit_log_detail",
        "status":  200,
        "detail":  "ad93b11a-f021-4a90-8a44-31aa1227f849",
        "passed":  true
    },
    {
        "case":  "audit_stats",
        "status":  200,
        "detail":  "223",
        "passed":  true
    },
    {
        "case":  "audit_export_job",
        "status":  200,
        "detail":  "9bbdab78-bb8f-4c42-a7cc-c6bc22e4bed9",
        "passed":  true
    },
    {
        "case":  "audit_stats_invalid_400",
        "status":  400,
        "detail":  "payload_validation_failed",
        "passed":  true
    }
]
Smoke test passed.

> health-visible-kb-api-skeleton-v1.1@1.1.0 smoke:workspace
> powershell -ExecutionPolicy Bypass -File ./scripts/smoke-workspace.ps1 -Port 18081


case                         status detail                            passed
----                         ------ ------                            ------
workspace_auto_db_path          200 ready                               True
workspace_full_ready            200 ready                               True
workspace_files_only_partial    200 partial_ready                       True
workspace_partial_partial       200 partial_structured_data_available   True
workspace_empty                 200 empty                               True
workspace_error_503             503 workspace_summary_unavailable       True
workspace_invalid_query_400     400 payload_validation_failed           True
workspace_cards_route           200 cards                               True
workspace_draft_route           200 draft                               True
workspace_tasks_route           200 tasks                               True
workspace_feedback_route        200 feedback                            True
workspace_ui_action_record      200 go_cards                            True


[
    {
        "case":  "workspace_auto_db_path",
        "status":  200,
        "detail":  "ready",
        "passed":  true
    },
    {
        "case":  "workspace_full_ready",
        "status":  200,
        "detail":  "ready",
        "passed":  true
    },
    {
        "case":  "workspace_files_only_partial",
        "status":  200,
        "detail":  "partial_ready",
        "passed":  true
    },
    {
        "case":  "workspace_partial_partial",
        "status":  200,
        "detail":  "partial_structured_data_available",
        "passed":  true
    },
    {
        "case":  "workspace_empty",
        "status":  200,
        "detail":  "empty",
        "passed":  true
    },
    {
        "case":  "workspace_error_503",
        "status":  503,
        "detail":  "workspace_summary_unavailable",
        "passed":  true
    },
    {
        "case":  "workspace_invalid_query_400",
        "status":  400,
        "detail":  "payload_validation_failed",
        "passed":  true
    },
    {
        "case":  "workspace_cards_route",
        "status":  200,
        "detail":  "cards",
        "passed":  true
    },
    {
        "case":  "workspace_draft_route",
        "status":  200,
        "detail":  "draft",
        "passed":  true
    },
    {
        "case":  "workspace_tasks_route",
        "status":  200,
        "detail":  "tasks",
        "passed":  true
    },
    {
        "case":  "workspace_feedback_route",
        "status":  200,
        "detail":  "feedback",
        "passed":  true
    },
    {
        "case":  "workspace_ui_action_record",
        "status":  200,
        "detail":  "go_cards",
        "passed":  true
    }
]
Smoke test passed.

> health-visible-kb-api-skeleton-v1.1@1.1.0 smoke:workspace-page
> powershell -ExecutionPolicy Bypass -File ./scripts/smoke-workspace-page.ps1 -Port 18081


case                            status detail      passed
----                            ------ ------      ------
workspace_page_static_200          200 title_found   True
workspace_route_page_static_200    200 title_found   True


[
    {
        "case":  "workspace_page_static_200",
        "status":  200,
        "detail":  "title_found",
        "passed":  true
    },
    {
        "case":  "workspace_route_page_static_200",
        "status":  200,
        "detail":  "title_found",
        "passed":  true
    }
]
Smoke test passed.

> health-visible-kb-api-skeleton-v1.1@1.1.0 smoke:edge
> powershell -ExecutionPolicy Bypass -File ./scripts/smoke-edge.ps1 -Port 18081


case                             status detail                    passed
----                             ------ ------                    ------
retrieve_empty_success              200 empty                       True
entry_not_found_404                 404 entry_not_found             True
audit_not_found_404                 404 audit_not_found             True
audit_page_invalid_400              400 payload_validation_failed   True
conflicts_invalid_400               400 payload_validation_failed   True
invalid_json_400_with_request_id    400 smoke-edge-invalid-json     True


[
    {
        "case":  "retrieve_empty_success",
        "status":  200,
        "detail":  "empty",
        "passed":  true
    },
    {
        "case":  "entry_not_found_404",
        "status":  404,
        "detail":  "entry_not_found",
        "passed":  true
    },
    {
        "case":  "audit_not_found_404",
        "status":  404,
        "detail":  "audit_not_found",
        "passed":  true
    },
    {
        "case":  "audit_page_invalid_400",
        "status":  400,
        "detail":  "payload_validation_failed",
        "passed":  true
    },
    {
        "case":  "conflicts_invalid_400",
        "status":  400,
        "detail":  "payload_validation_failed",
        "passed":  true
    },
    {
        "case":  "invalid_json_400_with_request_id",
        "status":  400,
        "detail":  "smoke-edge-invalid-json",
        "passed":  true
    }
]
Smoke test passed.
```
