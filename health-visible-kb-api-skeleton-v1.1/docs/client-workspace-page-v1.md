# Client Workspace Page v1

This page is a lightweight doctor workspace gateway for a single client.
It reads the existing aggregate API:

- `GET /kb/v1/clients/:clientId/workspace-summary`
- `GET /kb/v1/clients/:clientId/atomic-profile`
- `GET /kb/v1/clients/:clientId/cards`
- `GET /kb/v1/clients/:clientId/draft`
- `GET /kb/v1/clients/:clientId/tasks`
- `GET /kb/v1/clients/:clientId/feedback`
- `POST /kb/v1/clients/:clientId/workspace-actions`

## Local URL

- `http://localhost:18080/client-workspace-page-v1/index.html`
- `http://localhost:18080/client-workspace-page-v1/route.html`
- `http://localhost:18080/client-workspace-page-v1/cards.html`
- `http://localhost:18080/client-workspace-page-v1/draft.html`
- `http://localhost:18080/client-workspace-page-v1/tasks.html`
- `http://localhost:18080/client-workspace-page-v1/feedback.html`

Recommended query params for local debugging:

- `client_id`: target client id (default `C_AUTO_001`)
- `scenario`: `auto | full | files_only | partial | empty | error`
- `tenant_id`: tenant id header value
- `api_base`: API base URL (default `<origin>/kb/v1`)

Example:

```text
http://localhost:18080/client-workspace-page-v1/index.html?client_id=C_AUTO_001&scenario=auto
http://localhost:18080/client-workspace-page-v1/route.html?client_id=C_AUTO_001&route=cards&scenario=auto
http://localhost:18080/client-workspace-page-v1/cards.html?client_id=C_AUTO_001&scenario=auto
```

## Included Blocks (v1)

1. Top Summary
2. Current Data Overview
3. Document List
4. Structured Extraction
5. Timeline
6. Trend Chart
7. Atomic Profile Snapshot
8. Next Actions

Next Actions now navigate to dedicated route pages (`cards.html`, `draft.html`, `tasks.html`, `feedback.html`).
Each dedicated page fetches route-level summaries from backend route endpoints and can write UI action audit events.
Atomic Profile Snapshot supports inline filter inputs (`groups`, `tiers`, `flags`) and refreshes via the same page controls.

## State Handling

- `loading`: section skeletons
- `ready`: full render
- `partial_ready`: warning banner + partial content
- `empty`: empty-state hints + upload-first guidance
- `error`: explicit error banner + retry action

## Degrade Rules

- documents exist but structured fields missing: keep docs visible + show extraction pending hints
- structured fields exist but chart is empty: keep summaries + show chart unavailable hint
- timeline nodes are insufficient: keep timeline section with partial hint
- API failure: keep page shell and show retry

## Audit Hook Points (reserved)

The page writes UI action audit events to backend:

- `open-file` action
- `next-step` action

Current write endpoint:

- `POST /kb/v1/clients/:clientId/workspace-actions`

Stub-creating action types currently supported:

- `create_draft_stub`
- `create_task_stub`
- `create_feedback_stub`

All `create_*_stub` actions persist stubs into `kb_jobs` and return `created_stub.stub_id`.

## Atomic Profile API

- `GET /kb/v1/clients/:clientId/atomic-profile?scenario=auto&limit=120`
- Optional filters:
  - `atom_groups=profile,trend`
  - `confidence_tiers=L1,L2`
  - `quality_flags=needs_manual_review,potential_conflict`
- Returns atomicized client health data items (`atoms`) with `atom_group`, `atom_key`, `atom_value`, `confidence_tier`, and source trace fields.
- Current standard version: `health-visible-atom-v1`.
- `atoms` now include:
  - `atom_code` (stable code-friendly key)
  - `normalized_unit` (normalized unit label)
  - `quality_flags` (manual review/conflict/normalization hints)
  - `normalization_meta` (rule version + derivation metadata)
- Response also includes:
  - `total_after_filter`
  - `applied_filters`
  - `stats.by_quality_flag`
