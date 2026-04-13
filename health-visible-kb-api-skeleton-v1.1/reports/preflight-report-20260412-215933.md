# Preflight Report

- generated_at: 2026-04-12 21:59:49+08:00
- workspace: C:\Users\Y9000P\Desktop\健康可行临时文件夹\2604进行中文件\health-visible-kb-api-skeleton-v1.1
- run_started_at: 2026-04-12 21:59:33+08:00
- run_ended_at: 2026-04-12 21:59:49+08:00
- total_duration_seconds: 16.12
- overall_status: passed

| step | command | exit_code | duration_seconds | passed |
| --- | --- | ---: | ---: | --- |
| typecheck | D:\Program Files\nodejs\npm.cmd run check | 0 | 1.69 | True |
| build | D:\Program Files\nodejs\npm.cmd run build | 0 | 1.63 | True |
| smoke_all | D:\Program Files\nodejs\npm.cmd run smoke:all | 0 | 12.77 | True |

## Step: typecheck

- status: passed
- started_at: 2026-04-12 21:59:33+08:00
- ended_at: 2026-04-12 21:59:35+08:00
- duration_seconds: 1.69
- command: D:\Program Files\nodejs\npm.cmd run check

```text
> health-visible-kb-api-skeleton-v1.1@1.1.0 check
> tsc --noEmit
```

## Step: build

- status: passed
- started_at: 2026-04-12 21:59:35+08:00
- ended_at: 2026-04-12 21:59:37+08:00
- duration_seconds: 1.63
- command: D:\Program Files\nodejs\npm.cmd run build

```text
> health-visible-kb-api-skeleton-v1.1@1.1.0 build
> tsc -p tsconfig.json
```

## Step: smoke_all

- status: passed
- started_at: 2026-04-12 21:59:37+08:00
- ended_at: 2026-04-12 21:59:49+08:00
- duration_seconds: 12.77
- command: D:\Program Files\nodejs\npm.cmd run smoke:all

```text
> health-visible-kb-api-skeleton-v1.1@1.1.0 smoke:all
> npm run smoke:sources && npm run smoke:retrieve-audit && npm run smoke:edge


> health-visible-kb-api-skeleton-v1.1@1.1.0 smoke:sources
> powershell -ExecutionPolicy Bypass -File ./scripts/smoke-sources.ps1


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
> powershell -ExecutionPolicy Bypass -File ./scripts/smoke-retrieve-audit.ps1


case                    status detail                               passed
----                    ------ ------                               ------
retrieve_partial_l3        200 only_mid_low_confidence_evidence       True
retrieve_ready_l1          200 ready                                  True
conflicts_open             200 1                                      True
audit_logs_list            200 54                                     True
audit_log_detail           200 0d2361fa-57d5-47cb-9735-5aad60edcb47   True
audit_stats                200 54                                     True
audit_export_job           200 c8177065-c1e7-48a2-b4ec-71449d088013   True
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
        "detail":  "54",
        "passed":  true
    },
    {
        "case":  "audit_log_detail",
        "status":  200,
        "detail":  "0d2361fa-57d5-47cb-9735-5aad60edcb47",
        "passed":  true
    },
    {
        "case":  "audit_stats",
        "status":  200,
        "detail":  "54",
        "passed":  true
    },
    {
        "case":  "audit_export_job",
        "status":  200,
        "detail":  "c8177065-c1e7-48a2-b4ec-71449d088013",
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

> health-visible-kb-api-skeleton-v1.1@1.1.0 smoke:edge
> powershell -ExecutionPolicy Bypass -File ./scripts/smoke-edge.ps1


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
