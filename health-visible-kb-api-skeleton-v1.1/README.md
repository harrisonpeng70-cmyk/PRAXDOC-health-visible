# Health Visible KB API Skeleton v1.1

Minimal runnable Express + TypeScript backend for:
- ingest APIs
- retrieve APIs
- audit APIs
- workspace APIs
- admin APIs

## 1) Setup

1. Copy `.env.example` to `.env` and update DB settings.
2. Install dependencies:

```bash
npm install
```

3. Type check:

```bash
npm run check
```

4. Build:

```bash
npm run build
```

5. Run:

```bash
npm run dev
```

6. Smoke tests:

```bash
npm run smoke:sources
npm run smoke:retrieve-audit
npm run smoke:admin
npm run smoke:workspace
npm run smoke:workspace-page
npm run smoke:edge
npm run smoke:all
```

Smoke scripts run on isolated port `18081` by default to avoid conflicts with local dev server on `18080`.

7. Preflight:

```bash
npm run preflight
npm run preflight:report
npm run reports:prune
```

Preflight report output path:
- `reports/preflight-report-YYYYMMDD-HHMMSS.md`
- Preflight auto-prunes old reports and keeps latest 20 by default.

Health endpoint:

```text
GET /kb/v1/health
Headers: X-Tenant-Id, X-Request-Id
```

Admin endpoints require:

```text
Headers: X-Tenant-Id, X-Request-Id, X-Actor-Type: admin
Optional: X-Actor-Id
```

Workspace page preview (local static page):

```text
http://localhost:18080/client-workspace-page-v1/index.html
http://localhost:18080/client-workspace-page-v1/route.html
http://localhost:18080/client-workspace-page-v1/cards.html
http://localhost:18080/client-workspace-page-v1/draft.html
http://localhost:18080/client-workspace-page-v1/tasks.html
http://localhost:18080/client-workspace-page-v1/feedback.html
```

See:
- `docs/client-workspace-page-v1.md`

## 2) Database

Run these scripts in order:
1. `健康可见_1.0_知识库_数据库迁移_v1.1_无pgvector兼容.sql`
2. `健康可见_1.0_知识库_最小种子数据_v1.1.sql`

Optional after pgvector is installed:
3. `健康可见_1.0_知识库_pgvector补齐迁移_v1.1.sql`

## 3) API Coverage

Ingest:
- `POST /kb/v1/sources`
- `POST /kb/v1/documents`
- `POST /kb/v1/entries`
- `POST /kb/v1/entries/:entryId/versions`
- `POST /kb/v1/reviews/:versionId/approve`
- `POST /kb/v1/reviews/:versionId/reject`
- `POST /kb/v1/snapshots/publish`
- `GET /kb/v1/jobs/:jobId`

Retrieve:
- `POST /kb/v1/retrieve/search`
- `GET /kb/v1/entries/:entryId`
- `GET /kb/v1/entries/:entryId/versions`
- `GET /kb/v1/conflicts`

Workspace:
- `GET /kb/v1/clients/:clientId/workspace-summary`
- `GET /kb/v1/clients/:clientId/atomic-profile` (supports `limit`, `atom_groups`, `confidence_tiers`, `quality_flags`)
- `GET /kb/v1/clients/:clientId/cards`
- `GET /kb/v1/clients/:clientId/draft`
- `GET /kb/v1/clients/:clientId/tasks`
- `GET /kb/v1/clients/:clientId/feedback`
- `POST /kb/v1/clients/:clientId/workspace-actions`
  - supports logging actions and creating minimal stubs (`create_draft_stub`, `create_task_stub`, `create_feedback_stub`)

Audit:
- `GET /kb/v1/audit/logs`
- `GET /kb/v1/audit/logs/:auditId`
- `GET /kb/v1/audit/stats`
- `POST /kb/v1/audit/export`

Admin:
- `GET /kb/v1/admin/source-whitelist`
  - query: `enabled`, `source_type`, `search`, `page`, `page_size`
- `POST /kb/v1/admin/source-whitelist`
- `PATCH /kb/v1/admin/source-whitelist/:whitelistId`
- `GET /kb/v1/admin/policy-overview`
