import { ResultType } from "../../core/http/envelope";
import { WorkspaceRouteTarget, WorkspaceScenario } from "./workspace.schema";
import {
  createWorkspaceJobStub,
  getWorkspaceCardsSummary,
  getWorkspaceDocumentStats,
  getWorkspaceJobsSummary,
  getWorkspaceLastUpdatedAt,
  getWorkspaceLatestFeedback,
  getWorkspaceVersionStats,
  hasWorkspaceFeedbackStub,
  hasWorkspaceDraftStub,
  hasWorkspaceTaskStub,
  listWorkspaceChartSeries,
  listWorkspaceDocuments,
  listWorkspaceTimelineDocumentEvents,
  listWorkspaceTimelineVersionEvents,
  listWorkspaceVersions,
  WorkspaceDocument,
  WorkspaceDocumentStats,
  WorkspaceVersion,
  WorkspaceVersionStats,
  WorkspaceJobsSummary,
  WorkspaceLatestFeedback
} from "./workspace.repo";

type WorkspaceSummaryPayload = {
  client_profile: {
    client_id: string;
    client_name: string;
    client_status: "new" | "active" | "needs_review";
    last_updated_at: string;
    profile_completion_hint: string;
    latest_mainline_hint: string;
  };
  document_list: Array<{
    document_id: string;
    report_type: "checkup" | "lab_test" | "medical_record";
    source_file_name: string;
    report_date: string;
    extraction_status: "succeeded" | "pending" | "failed";
  }>;
  extraction_results: {
    summary_conclusion: string | null;
    summary_recommendation: string | null;
    abnormal_item_summary: string | null;
    test_items_summary: string | null;
    chief_complaint: string | null;
    present_illness_summary: string | null;
    treatment_advice: string | null;
    failed_count: number;
    manual_fill_needed_count: number;
  };
  timeline_items: Array<{
    event_date: string;
    event_type: "checkup" | "lab_test" | "medical_record" | "followup";
    event_title: string;
    event_summary: string;
  }>;
  chart_ready_items: Array<{
    item_name: string;
    item_value: number;
    report_date: string;
    reference_range: string;
    abnormal_flag: boolean;
  }>;
  latest_cards_summary: {
    has_cards: boolean;
    total_cards: number;
    latest_card_title: string | null;
    updated_at: string | null;
  };
  latest_draft_summary: {
    has_draft: boolean;
    draft_status: "none" | "draft" | "reviewing";
    draft_updated_at: string | null;
  };
  current_tasks_summary: {
    open_count: number;
    delayed_count: number;
    done_count: number;
    next_task_hint: string;
  };
  latest_feedback_summary: {
    has_feedback: boolean;
    latest_feedback_at: string | null;
    latest_feedback_hint: string | null;
  };
  page_state: "ready" | "partial_ready" | "empty";
};

export type WorkspaceSummaryResponse = {
  result_type: ResultType;
  error_hint: string | null;
  data: WorkspaceSummaryPayload;
};

export type WorkspaceRouteResponse = {
  result_type: ResultType;
  error_hint: string | null;
  data: {
    client_id: string;
    route: WorkspaceRouteTarget;
    route_ready: boolean;
    route_url: string;
    route_title: string;
    route_summary: string;
    route_payload: Record<string, unknown>;
  };
};

export type WorkspaceCreatedStub = {
  kind: "draft_stub" | "task_stub" | "feedback_stub";
  stub_id: string;
};

export type WorkspaceAtomicValueType = "string" | "number" | "boolean" | "date" | "datetime";

export type WorkspaceAtomicConfidenceTier = "L1" | "L2" | "L3" | "system";

export type WorkspaceAtomQualityFlag =
  | "needs_manual_review"
  | "potential_conflict"
  | "derived_from_summary"
  | "normalized_unit_inferred"
  | "missing_observed_at"
  | "out_of_reference_range";

export type WorkspaceAtom = {
  atom_id: string;
  atom_code: string;
  atom_group: "profile" | "document" | "extraction" | "trend" | "cards" | "draft" | "tasks" | "feedback";
  atom_key: string;
  atom_value: string | number | boolean;
  value_type: WorkspaceAtomicValueType;
  unit: string | null;
  normalized_unit: string | null;
  observed_at: string | null;
  confidence_tier: WorkspaceAtomicConfidenceTier;
  quality_flags: WorkspaceAtomQualityFlag[];
  normalization_meta: {
    rule_version: string;
    derived_from: string | null;
    notes: string | null;
  };
  source: {
    source_type: string;
    source_id: string | null;
  };
};

export type WorkspaceAtomicProfileResponse = {
  result_type: ResultType;
  error_hint: string | null;
  data: {
    client_id: string;
    scenario_used: WorkspaceScenario;
    atomic_standard_version: string;
    atom_count: number;
    total_after_filter: number;
    truncated: boolean;
    applied_filters: {
      atom_groups: WorkspaceAtom["atom_group"][];
      confidence_tiers: WorkspaceAtomicConfidenceTier[];
      quality_flags: WorkspaceAtomQualityFlag[];
    };
    atoms: WorkspaceAtom[];
    stats: {
      by_group: Record<string, number>;
      by_confidence_tier: Record<string, number>;
      by_quality_flag: Record<string, number>;
    };
  };
};

function isoNow(): string {
  return new Date().toISOString();
}

function asIsoOrNow(value: string | null): string {
  if (!value || value.startsWith("1970-01-01")) {
    return isoNow();
  }
  return value;
}

function safeDateCompareDesc(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) && Number.isNaN(tb)) {
    return b.localeCompare(a);
  }
  if (Number.isNaN(ta)) {
    return 1;
  }
  if (Number.isNaN(tb)) {
    return -1;
  }
  return tb - ta;
}

function buildBase(clientId: string, lastUpdatedAt: string): WorkspaceSummaryPayload {
  return {
    client_profile: {
      client_id: clientId,
      client_name: `Client ${clientId}`,
      client_status: "new",
      last_updated_at: lastUpdatedAt,
      profile_completion_hint: "Profile completeness 0%",
      latest_mainline_hint: "No structured evidence yet."
    },
    document_list: [],
    extraction_results: {
      summary_conclusion: null,
      summary_recommendation: null,
      abnormal_item_summary: null,
      test_items_summary: null,
      chief_complaint: null,
      present_illness_summary: null,
      treatment_advice: null,
      failed_count: 0,
      manual_fill_needed_count: 0
    },
    timeline_items: [],
    chart_ready_items: [],
    latest_cards_summary: {
      has_cards: false,
      total_cards: 0,
      latest_card_title: null,
      updated_at: null
    },
    latest_draft_summary: {
      has_draft: false,
      draft_status: "none",
      draft_updated_at: null
    },
    current_tasks_summary: {
      open_count: 0,
      delayed_count: 0,
      done_count: 0,
      next_task_hint: "No open task."
    },
    latest_feedback_summary: {
      has_feedback: false,
      latest_feedback_at: null,
      latest_feedback_hint: null
    },
    page_state: "empty"
  };
}

function withFullScenario(base: WorkspaceSummaryPayload): WorkspaceSummaryPayload {
  return {
    ...base,
    client_profile: {
      ...base.client_profile,
      client_name: "Demo Full Client",
      client_status: "active",
      profile_completion_hint: "Profile completeness 88%",
      latest_mainline_hint: "Latest lab trend updated on 2026-04-10."
    },
    document_list: [
      {
        document_id: "doc_checkup_001",
        report_type: "checkup",
        source_file_name: "checkup_2026-03-21.pdf",
        report_date: "2026-03-21",
        extraction_status: "succeeded"
      },
      {
        document_id: "doc_lab_001",
        report_type: "lab_test",
        source_file_name: "lab_2026-04-10.pdf",
        report_date: "2026-04-10",
        extraction_status: "succeeded"
      },
      {
        document_id: "doc_record_001",
        report_type: "medical_record",
        source_file_name: "record_2026-04-11.pdf",
        report_date: "2026-04-11",
        extraction_status: "succeeded"
      }
    ],
    extraction_results: {
      summary_conclusion: "Structured evidence is complete and can support assessment.",
      summary_recommendation: "Proceed to follow-up plan drafting.",
      abnormal_item_summary: "Abnormal glucose trend detected.",
      test_items_summary: "FPG 7.1 mmol/L, HbA1c 6.6%",
      chief_complaint: "Fatigue and dry mouth.",
      present_illness_summary: "Symptoms fluctuate over recent 2 months.",
      treatment_advice: "Continue lifestyle intervention and re-check in 2 weeks.",
      failed_count: 0,
      manual_fill_needed_count: 0
    },
    timeline_items: [
      {
        event_date: "2026-04-11",
        event_type: "medical_record",
        event_title: "Record updated",
        event_summary: "Follow-up notes are available."
      },
      {
        event_date: "2026-04-10",
        event_type: "lab_test",
        event_title: "Lab uploaded",
        event_summary: "Structured extraction succeeded."
      },
      {
        event_date: "2026-03-21",
        event_type: "checkup",
        event_title: "Checkup uploaded",
        event_summary: "Baseline metrics available."
      }
    ],
    chart_ready_items: [
      {
        item_name: "fasting_glucose",
        item_value: 6.4,
        report_date: "2026-02-15",
        reference_range: "3.9-6.1 mmol/L",
        abnormal_flag: true
      },
      {
        item_name: "fasting_glucose",
        item_value: 6.8,
        report_date: "2026-03-10",
        reference_range: "3.9-6.1 mmol/L",
        abnormal_flag: true
      },
      {
        item_name: "fasting_glucose",
        item_value: 7.1,
        report_date: "2026-04-10",
        reference_range: "3.9-6.1 mmol/L",
        abnormal_flag: true
      }
    ],
    latest_cards_summary: {
      has_cards: true,
      total_cards: 3,
      latest_card_title: "GLUCOSE_RISK_STRATIFICATION",
      updated_at: "2026-04-11T09:30:00Z"
    },
    latest_draft_summary: {
      has_draft: true,
      draft_status: "reviewing",
      draft_updated_at: "2026-04-11T10:00:00Z"
    },
    current_tasks_summary: {
      open_count: 2,
      delayed_count: 0,
      done_count: 4,
      next_task_hint: "Confirm follow-up schedule in next 48 hours."
    },
    latest_feedback_summary: {
      has_feedback: true,
      latest_feedback_at: "2026-04-12T02:00:00Z",
      latest_feedback_hint: "Client reports low adherence at dinner."
    },
    page_state: "ready"
  };
}

function withFilesOnlyScenario(base: WorkspaceSummaryPayload): WorkspaceSummaryPayload {
  return {
    ...base,
    client_profile: {
      ...base.client_profile,
      client_name: "Demo Files-Only Client",
      client_status: "needs_review",
      profile_completion_hint: "Profile completeness 36%",
      latest_mainline_hint: "Documents uploaded, structured extraction pending."
    },
    document_list: [
      {
        document_id: "doc_checkup_010",
        report_type: "checkup",
        source_file_name: "checkup_2026-04-08.pdf",
        report_date: "2026-04-08",
        extraction_status: "pending"
      },
      {
        document_id: "doc_lab_010",
        report_type: "lab_test",
        source_file_name: "lab_2026-04-09.pdf",
        report_date: "2026-04-09",
        extraction_status: "pending"
      }
    ],
    extraction_results: {
      ...base.extraction_results,
      summary_recommendation: "Prioritize extraction queue and manual data fill.",
      manual_fill_needed_count: 2
    },
    timeline_items: [
      {
        event_date: "2026-04-09",
        event_type: "lab_test",
        event_title: "Lab uploaded",
        event_summary: "Waiting for extraction."
      }
    ],
    current_tasks_summary: {
      open_count: 1,
      delayed_count: 0,
      done_count: 0,
      next_task_hint: "Complete extraction queue."
    },
    page_state: "partial_ready"
  };
}

function withPartialScenario(base: WorkspaceSummaryPayload): WorkspaceSummaryPayload {
  return {
    ...base,
    client_profile: {
      ...base.client_profile,
      client_name: "Demo Partial Client",
      client_status: "needs_review",
      profile_completion_hint: "Profile completeness 54%",
      latest_mainline_hint: "Partial structured output available."
    },
    document_list: [
      {
        document_id: "doc_record_020",
        report_type: "medical_record",
        source_file_name: "record_2026-04-01.pdf",
        report_date: "2026-04-01",
        extraction_status: "succeeded"
      },
      {
        document_id: "doc_lab_020",
        report_type: "lab_test",
        source_file_name: "lab_2026-04-03.pdf",
        report_date: "2026-04-03",
        extraction_status: "failed"
      }
    ],
    extraction_results: {
      summary_conclusion: "Some structured evidence exists but confidence is limited.",
      summary_recommendation: "Fill missing critical fields before final drafting.",
      abnormal_item_summary: "One key extraction failed.",
      test_items_summary: null,
      chief_complaint: "Fatigue, sleep quality decline.",
      present_illness_summary: "Symptoms fluctuate in the last month.",
      treatment_advice: null,
      failed_count: 1,
      manual_fill_needed_count: 1
    },
    timeline_items: [
      {
        event_date: "2026-04-03",
        event_type: "lab_test",
        event_title: "Extraction failed",
        event_summary: "Manual fill needed."
      },
      {
        event_date: "2026-04-01",
        event_type: "medical_record",
        event_title: "Record extracted",
        event_summary: "Initial summary available."
      }
    ],
    current_tasks_summary: {
      open_count: 2,
      delayed_count: 1,
      done_count: 1,
      next_task_hint: "Fill missing lab fields first."
    },
    page_state: "partial_ready"
  };
}

function withEmptyScenario(base: WorkspaceSummaryPayload): WorkspaceSummaryPayload {
  return {
    ...base,
    client_profile: {
      ...base.client_profile,
      client_name: "New Client",
      client_status: "new",
      profile_completion_hint: "Profile completeness 0%",
      latest_mainline_hint: "Upload checkup/lab/record documents first."
    },
    current_tasks_summary: {
      open_count: 0,
      delayed_count: 0,
      done_count: 0,
      next_task_hint: "Upload the first document."
    },
    page_state: "empty"
  };
}

function buildWorkspaceSummaryMock(
  clientId: string,
  scenario: Exclude<WorkspaceScenario, "auto">
): WorkspaceSummaryResponse {
  if (scenario === "error") {
    throw new Error("workspace_summary_unavailable");
  }

  const base = buildBase(clientId, isoNow());
  let payload: WorkspaceSummaryPayload;
  let resultType: ResultType = "success";
  let errorHint: string | null = null;

  switch (scenario) {
    case "full":
      payload = withFullScenario(base);
      break;
    case "files_only":
      payload = withFilesOnlyScenario(base);
      resultType = "partial";
      errorHint = "structured_data_pending";
      break;
    case "partial":
      payload = withPartialScenario(base);
      resultType = "partial";
      errorHint = "partial_structured_data_available";
      break;
    case "empty":
      payload = withEmptyScenario(base);
      break;
    default:
      payload = withFullScenario(base);
      break;
  }

  return {
    result_type: resultType,
    error_hint: errorHint,
    data: payload
  };
}

function computeProfileCompletion(docStats: WorkspaceDocumentStats, versionStats: WorkspaceVersionStats): number {
  const checks = [
    docStats.total > 0,
    docStats.total > 0 && docStats.pending_count === 0,
    versionStats.approved_count > 0,
    versionStats.reviewing_count === 0
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

function computeClientStatus(
  docStats: WorkspaceDocumentStats,
  versionStats: WorkspaceVersionStats,
  jobsSummary: WorkspaceJobsSummary
): "new" | "active" | "needs_review" {
  if (docStats.total === 0 && versionStats.approved_count === 0) {
    return "new";
  }

  if (docStats.pending_count > 0 || versionStats.reviewing_count > 0 || jobsSummary.delayed_count > 0) {
    return "needs_review";
  }

  return "active";
}

function computePageState(
  documents: WorkspaceDocument[],
  versions: WorkspaceVersion[],
  docStats: WorkspaceDocumentStats
): "ready" | "partial_ready" | "empty" {
  if (documents.length === 0 && versions.length === 0) {
    return "empty";
  }

  const hasApprovedL1 = versions.some((v) => v.layer === "L1" && v.review_status === "approved");
  if (documents.length > 0 && docStats.pending_count === 0 && hasApprovedL1) {
    return "ready";
  }

  return "partial_ready";
}

function pickMainlineHint(
  pageState: "ready" | "partial_ready" | "empty",
  latestReportDate: string | null,
  versions: WorkspaceVersion[]
): string {
  if (pageState === "empty") {
    return "No document has been uploaded yet.";
  }

  const latestApproved = versions.find((v) => v.layer === "L1" && v.review_status === "approved");
  if (latestApproved) {
    return `Latest approved L1 card: ${latestApproved.kb_id}.`;
  }

  if (versions.length > 0) {
    return `Latest knowledge update: ${versions[0].kb_id} (${versions[0].review_status}).`;
  }

  if (latestReportDate) {
    return `Latest report date ${latestReportDate}, waiting for more structured output.`;
  }

  return "Structured signals are still limited.";
}

function buildExtractionSummary(
  docStats: WorkspaceDocumentStats,
  versions: WorkspaceVersion[],
  jobsSummary: WorkspaceJobsSummary
): WorkspaceSummaryPayload["extraction_results"] {
  const hasL1Approved = versions.some((v) => v.layer === "L1" && v.review_status === "approved");
  const hasStructuredData = versions.length > 0 || docStats.total > 0;

  const summaryConclusion = hasL1Approved
    ? "Approved high-confidence evidence is available."
    : hasStructuredData
      ? "Partial structured evidence is available."
      : null;

  const summaryRecommendation =
    docStats.pending_count > 0
      ? "Finish pending extraction and manual fill first."
      : hasL1Approved
        ? "Proceed to draft and follow-up execution."
        : hasStructuredData
          ? "Complete review workflow to raise confidence."
          : null;

  const abnormalItemSummary =
    jobsSummary.delayed_count > 0
      ? `${jobsSummary.delayed_count} processing job(s) failed and need intervention.`
      : docStats.pending_count > 0
        ? `${docStats.pending_count} document(s) still pending extraction.`
        : null;

  const testItemsSummary =
    docStats.total > 0
      ? `Documents: ${docStats.total} (checkup ${docStats.checkup_count}, lab ${docStats.lab_test_count}, record ${docStats.medical_record_count}).`
      : null;

  const latestL1Judgment = versions.find((v) => v.layer === "L1" && v.claim_type === "judgment");
  const treatmentAdvice = hasL1Approved ? "Use approved L1 cards as the first-line guidance." : null;

  return {
    summary_conclusion: summaryConclusion,
    summary_recommendation: summaryRecommendation,
    abnormal_item_summary: abnormalItemSummary,
    test_items_summary: testItemsSummary,
    chief_complaint: latestL1Judgment ? latestL1Judgment.statement.slice(0, 120) : null,
    present_illness_summary: null,
    treatment_advice: treatmentAdvice,
    failed_count: jobsSummary.delayed_count,
    manual_fill_needed_count: docStats.pending_count
  };
}

function pickNextTaskHint(
  docStats: WorkspaceDocumentStats,
  versionStats: WorkspaceVersionStats,
  jobsSummary: WorkspaceJobsSummary
): string {
  if (docStats.total === 0) {
    return "Upload the first document to start analysis.";
  }
  if (jobsSummary.delayed_count > 0) {
    return "Handle failed processing jobs first.";
  }
  if (docStats.pending_count > 0) {
    return "Complete pending extraction/manual fill.";
  }
  if (versionStats.reviewing_count > 0) {
    return "Review and approve pending knowledge versions.";
  }
  return "No blocking task. You can continue with follow-up drafting.";
}

function buildChartItems(chartSeries: Array<{ report_date: string; item_value: number }>) {
  return [...chartSeries]
    .sort((a, b) => a.report_date.localeCompare(b.report_date))
    .map((point) => ({
      item_name: "query_score_final",
      item_value: Number(point.item_value.toFixed(3)),
      report_date: point.report_date,
      reference_range: "0.000-1.000",
      abnormal_flag: point.item_value < 0.3
    }));
}

function buildTimelineItems(
  docEvents: Array<{
    event_date: string;
    event_type: "checkup" | "lab_test" | "medical_record" | "followup";
    event_title: string;
    event_summary: string;
    sort_at: string;
  }>,
  versionEvents: Array<{
    event_date: string;
    event_type: "checkup" | "lab_test" | "medical_record" | "followup";
    event_title: string;
    event_summary: string;
    sort_at: string;
  }>
): WorkspaceSummaryPayload["timeline_items"] {
  return [...docEvents, ...versionEvents]
    .sort((a, b) => safeDateCompareDesc(a.sort_at, b.sort_at))
    .slice(0, 8)
    .map((item) => ({
      event_date: item.event_date,
      event_type: item.event_type,
      event_title: item.event_title,
      event_summary: item.event_summary
    }));
}

function buildDraftSummary(
  versionStats: WorkspaceVersionStats,
  versions: WorkspaceVersion[]
): WorkspaceSummaryPayload["latest_draft_summary"] {
  const hasDraft = versions.some((v) => v.review_status === "draft" || v.review_status === "reviewing");
  const draftStatus: "none" | "draft" | "reviewing" =
    versionStats.reviewing_count > 0 ? "reviewing" : hasDraft ? "draft" : "none";
  const draftCandidate = versions.find((v) => v.review_status === "reviewing" || v.review_status === "draft");

  return {
    has_draft: hasDraft,
    draft_status: draftStatus,
    draft_updated_at: versionStats.latest_reviewing_at ?? draftCandidate?.sort_at ?? null
  };
}

function toResultType(
  pageState: "ready" | "partial_ready" | "empty"
): { result_type: ResultType; error_hint: string | null } {
  if (pageState === "partial_ready") {
    return {
      result_type: "partial",
      error_hint: "partial_structured_data_available"
    };
  }
  return {
    result_type: "success",
    error_hint: null
  };
}

async function buildWorkspaceSummaryFromDb(
  tenantId: string,
  clientId: string
): Promise<WorkspaceSummaryResponse> {
  const [
    documents,
    docStats,
    versions,
    docEvents,
    versionEvents,
    chartSeries,
    cardsSummary,
    versionStats,
    jobsSummary,
    latestFeedback,
    lastUpdatedAt
  ] = await Promise.all([
    listWorkspaceDocuments(tenantId, 20),
    getWorkspaceDocumentStats(tenantId),
    listWorkspaceVersions(tenantId, 120),
    listWorkspaceTimelineDocumentEvents(tenantId, 8),
    listWorkspaceTimelineVersionEvents(tenantId, 8),
    listWorkspaceChartSeries(tenantId, clientId, 6),
    getWorkspaceCardsSummary(tenantId),
    getWorkspaceVersionStats(tenantId),
    getWorkspaceJobsSummary(tenantId, clientId),
    getWorkspaceLatestFeedback(tenantId, clientId),
    getWorkspaceLastUpdatedAt(tenantId)
  ]);

  const pageState = computePageState(documents, versions, docStats);
  const completion = computeProfileCompletion(docStats, versionStats);
  const status = computeClientStatus(docStats, versionStats, jobsSummary);
  const timelineItems = buildTimelineItems(docEvents, versionEvents);
  const chartItems = buildChartItems(chartSeries);
  const extractionResults = buildExtractionSummary(docStats, versions, jobsSummary);
  const draftSummary = buildDraftSummary(versionStats, versions);
  const resultMeta = toResultType(pageState);

  const payload: WorkspaceSummaryPayload = {
    ...buildBase(clientId, asIsoOrNow(lastUpdatedAt)),
    client_profile: {
      client_id: clientId,
      client_name: `Client ${clientId}`,
      client_status: status,
      last_updated_at: asIsoOrNow(lastUpdatedAt),
      profile_completion_hint: `Profile completeness ${completion}%.`,
      latest_mainline_hint: pickMainlineHint(pageState, docStats.latest_report_date, versions)
    },
    document_list: documents.map((doc) => ({
      document_id: doc.document_id,
      report_type: doc.report_type,
      source_file_name: doc.source_file_name,
      report_date: doc.report_date,
      extraction_status: doc.extraction_status
    })),
    extraction_results: extractionResults,
    timeline_items: timelineItems,
    chart_ready_items: chartItems,
    latest_cards_summary: {
      has_cards: cardsSummary.total_cards > 0,
      total_cards: cardsSummary.total_cards,
      latest_card_title: cardsSummary.latest_card_title,
      updated_at: cardsSummary.updated_at
    },
    latest_draft_summary: draftSummary,
    current_tasks_summary: {
      open_count: jobsSummary.open_count,
      delayed_count: jobsSummary.delayed_count,
      done_count: jobsSummary.done_count,
      next_task_hint: pickNextTaskHint(docStats, versionStats, jobsSummary)
    },
    latest_feedback_summary: {
      has_feedback: Boolean(latestFeedback),
      latest_feedback_at: latestFeedback?.latest_feedback_at ?? null,
      latest_feedback_hint: latestFeedback?.latest_feedback_hint ?? null
    },
    page_state: pageState
  };

  return {
    result_type: resultMeta.result_type,
    error_hint: resultMeta.error_hint,
    data: payload
  };
}

function isLikelyDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }

  return (
    "code" in err ||
    "severity" in err ||
    "routine" in err
  );
}

export async function getWorkspaceSummaryService(input: {
  tenantId: string;
  clientId: string;
  scenario: WorkspaceScenario;
}): Promise<WorkspaceSummaryResponse> {
  if (input.scenario !== "auto") {
    return buildWorkspaceSummaryMock(input.clientId, input.scenario);
  }

  try {
    return await buildWorkspaceSummaryFromDb(input.tenantId, input.clientId);
  } catch (err) {
    if (isLikelyDbError(err)) {
      throw new Error("workspace_summary_unavailable");
    }
    throw err;
  }
}

function mergeRouteResult(
  baseResultType: ResultType,
  baseErrorHint: string | null,
  routeReady: boolean,
  routeErrorHint: string
): { result_type: ResultType; error_hint: string | null } {
  if (!routeReady) {
    return {
      result_type: "partial",
      error_hint: routeErrorHint
    };
  }

  if (baseResultType === "partial") {
    return {
      result_type: "partial",
      error_hint: baseErrorHint ?? "partial_structured_data_available"
    };
  }

  if (baseResultType === "failed") {
    return {
      result_type: "failed",
      error_hint: baseErrorHint ?? "workspace_summary_failed"
    };
  }

  return {
    result_type: "success",
    error_hint: null
  };
}

export async function getWorkspaceRouteSummaryService(input: {
  tenantId: string;
  clientId: string;
  scenario: WorkspaceScenario;
  route: WorkspaceRouteTarget;
}): Promise<WorkspaceRouteResponse> {
  const summary = await getWorkspaceSummaryService({
    tenantId: input.tenantId,
    clientId: input.clientId,
    scenario: input.scenario
  });

  const routeUrl = `/kb/v1/clients/${encodeURIComponent(input.clientId)}/${input.route}`;

  let routeReady = false;
  let routeTitle = "";
  let routeSummary = "";
  let routePayload: Record<string, unknown> = {};
  let routeErrorHint = "route_not_ready";
  const [hasDraftStub, hasTaskStub, hasFeedbackStub] = await Promise.all([
    hasWorkspaceDraftStub(input.tenantId, input.clientId),
    hasWorkspaceTaskStub(input.tenantId, input.clientId),
    hasWorkspaceFeedbackStub(input.tenantId, input.clientId)
  ]);

  switch (input.route) {
    case "cards":
      routeReady = summary.data.latest_cards_summary.has_cards;
      routeTitle = "Cards Workspace";
      routeSummary = routeReady
        ? `Cards ready. latest=${summary.data.latest_cards_summary.latest_card_title ?? "-"}`
        : "Cards not ready yet. Keep building from current workspace evidence.";
      routePayload = summary.data.latest_cards_summary as unknown as Record<string, unknown>;
      routeErrorHint = "cards_not_ready";
      break;
    case "draft":
      routeReady = summary.data.latest_draft_summary.has_draft || hasDraftStub;
      routeTitle = "Draft Workspace";
      routeSummary = routeReady
        ? `Draft status=${summary.data.latest_draft_summary.draft_status}${hasDraftStub ? " (stub available)" : ""}`
        : "Draft not ready yet. Finish structured review first.";
      routePayload = {
        ...(summary.data.latest_draft_summary as unknown as Record<string, unknown>),
        has_draft_stub: hasDraftStub
      };
      routeErrorHint = "draft_not_ready";
      break;
    case "tasks":
      routeReady =
        summary.data.current_tasks_summary.open_count +
          summary.data.current_tasks_summary.delayed_count +
          summary.data.current_tasks_summary.done_count >
          0 || hasTaskStub;
      routeTitle = "Tasks Workspace";
      routeSummary = routeReady
        ? `Tasks found. next=${summary.data.current_tasks_summary.next_task_hint}${hasTaskStub ? " (stub available)" : ""}`
        : "Task list is empty. Start by creating first follow-up task.";
      routePayload = {
        ...(summary.data.current_tasks_summary as unknown as Record<string, unknown>),
        has_task_stub: hasTaskStub
      };
      routeErrorHint = "tasks_not_ready";
      break;
    case "feedback":
      routeReady = summary.data.latest_feedback_summary.has_feedback || hasFeedbackStub;
      routeTitle = "Feedback Workspace";
      routeSummary = routeReady
        ? `Latest feedback at ${summary.data.latest_feedback_summary.latest_feedback_at ?? "-"}${hasFeedbackStub ? " (stub available)" : ""}`
        : "No feedback record yet. Capture first feedback after intervention.";
      routePayload = {
        ...(summary.data.latest_feedback_summary as unknown as Record<string, unknown>),
        has_feedback_stub: hasFeedbackStub
      };
      routeErrorHint = "feedback_not_ready";
      break;
    default:
      routeReady = false;
      routeTitle = "Workspace Route";
      routeSummary = "Unknown route target.";
      routePayload = {};
      routeErrorHint = "route_not_ready";
      break;
  }

  const merged = mergeRouteResult(summary.result_type, summary.error_hint, routeReady, routeErrorHint);

  return {
    result_type: merged.result_type,
    error_hint: merged.error_hint,
    data: {
      client_id: input.clientId,
      route: input.route,
      route_ready: routeReady,
      route_url: routeUrl,
      route_title: routeTitle,
      route_summary: routeSummary,
      route_payload: routePayload
    }
  };
}

function inferAtomValueType(value: string | number | boolean): WorkspaceAtomicValueType {
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "date";
  }
  if (!Number.isNaN(Date.parse(value)) && value.includes("T")) {
    return "datetime";
  }
  return "string";
}

function parseCompletionHintAsNumber(hint: string): number | null {
  const match = /(\d{1,3})%/.exec(hint);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function toAtomCode(group: WorkspaceAtom["atom_group"], key: string): string {
  const normalizedKey = key
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return `HV_ATOM_${group.toUpperCase()}_${normalizedKey}`;
}

function normalizeUnitLabel(unit: string | null): { normalized_unit: string | null; inferred: boolean } {
  if (!unit) {
    return { normalized_unit: null, inferred: false };
  }

  const raw = unit.trim();
  if (!raw) {
    return { normalized_unit: null, inferred: false };
  }

  const lower = raw.toLowerCase();
  if (lower === "percent" || raw === "%") {
    return {
      normalized_unit: "%",
      inferred: raw !== "%"
    };
  }

  if (/^\d+(\.\d+)?-\d+(\.\d+)?\s*[a-zA-Z%/]+$/.test(raw)) {
    const parts = raw.split(/\s+/);
    const extracted = parts[parts.length - 1];
    return {
      normalized_unit: extracted,
      inferred: extracted !== raw
    };
  }

  if (/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(raw)) {
    return {
      normalized_unit: null,
      inferred: true
    };
  }

  return {
    normalized_unit: raw,
    inferred: false
  };
}

function buildWorkspaceAtomsFromSummary(summary: WorkspaceSummaryPayload): WorkspaceAtom[] {
  const atoms: WorkspaceAtom[] = [];
  let seq = 1;

  const pushAtom = (
    atom: Omit<
      WorkspaceAtom,
      "atom_id" | "atom_code" | "value_type" | "normalized_unit" | "quality_flags" | "normalization_meta"
    > & {
      quality_flags?: WorkspaceAtomQualityFlag[];
      derived_from?: string | null;
      notes?: string | null;
    }
  ): void => {
    const { quality_flags: inputFlags, derived_from, notes, ...baseAtom } = atom;
    const normalized = normalizeUnitLabel(baseAtom.unit);
    const flags = new Set<WorkspaceAtomQualityFlag>(inputFlags ?? []);
    if (normalized.inferred) {
      flags.add("normalized_unit_inferred");
    }
    if (!baseAtom.observed_at) {
      flags.add("missing_observed_at");
    }

    atoms.push({
      atom_id: `ATOM-${seq.toString().padStart(4, "0")}`,
      atom_code: toAtomCode(baseAtom.atom_group, baseAtom.atom_key),
      value_type: inferAtomValueType(baseAtom.atom_value),
      normalized_unit: normalized.normalized_unit,
      quality_flags: Array.from(flags),
      normalization_meta: {
        rule_version: "atom-rule-v1.1",
        derived_from: derived_from ?? null,
        notes: notes ?? null
      },
      ...baseAtom
    });
    seq += 1;
  };

  pushAtom({
    atom_group: "profile",
    atom_key: "client_status",
    atom_value: summary.client_profile.client_status,
    unit: null,
    observed_at: summary.client_profile.last_updated_at,
    confidence_tier: "system",
    derived_from: "workspace.client_profile.client_status",
    source: { source_type: "workspace_summary", source_id: summary.client_profile.client_id }
  });

  const completionPct = parseCompletionHintAsNumber(summary.client_profile.profile_completion_hint);
  if (completionPct !== null) {
    pushAtom({
      atom_group: "profile",
      atom_key: "profile_completion_pct",
      atom_value: completionPct,
      unit: "percent",
      observed_at: summary.client_profile.last_updated_at,
      confidence_tier: "system",
      derived_from: "workspace.client_profile.profile_completion_hint",
      source: { source_type: "workspace_summary", source_id: summary.client_profile.client_id }
    });
  }

  pushAtom({
    atom_group: "profile",
    atom_key: "page_state",
    atom_value: summary.page_state,
    unit: null,
    observed_at: summary.client_profile.last_updated_at,
    confidence_tier: "system",
    derived_from: "workspace.page_state",
    source: { source_type: "workspace_summary", source_id: summary.client_profile.client_id }
  });

  for (const doc of summary.document_list) {
    const needsManual = doc.extraction_status !== "succeeded";

    pushAtom({
      atom_group: "document",
      atom_key: `${doc.document_id}.report_type`,
      atom_value: doc.report_type,
      unit: null,
      observed_at: doc.report_date,
      confidence_tier: "L2",
      derived_from: "workspace.document_list",
      source: { source_type: "document", source_id: doc.document_id }
    });
    pushAtom({
      atom_group: "document",
      atom_key: `${doc.document_id}.extraction_status`,
      atom_value: doc.extraction_status,
      unit: null,
      observed_at: doc.report_date,
      confidence_tier: "L2",
      quality_flags: needsManual ? ["needs_manual_review"] : [],
      derived_from: "workspace.document_list",
      source: { source_type: "document", source_id: doc.document_id }
    });
  }

  const extraction = summary.extraction_results;
  const extractionScalarAtoms: Array<{ key: string; value: string | number | boolean; confidence: WorkspaceAtomicConfidenceTier }> = [
    { key: "failed_count", value: extraction.failed_count, confidence: "system" },
    { key: "manual_fill_needed_count", value: extraction.manual_fill_needed_count, confidence: "system" }
  ];

  if (extraction.summary_conclusion) {
    extractionScalarAtoms.push({ key: "summary_conclusion", value: extraction.summary_conclusion, confidence: "L2" });
  }
  if (extraction.summary_recommendation) {
    extractionScalarAtoms.push({ key: "summary_recommendation", value: extraction.summary_recommendation, confidence: "L2" });
  }
  if (extraction.abnormal_item_summary) {
    extractionScalarAtoms.push({ key: "abnormal_item_summary", value: extraction.abnormal_item_summary, confidence: "L2" });
  }
  if (extraction.test_items_summary) {
    extractionScalarAtoms.push({ key: "test_items_summary", value: extraction.test_items_summary, confidence: "L2" });
  }
  if (extraction.chief_complaint) {
    extractionScalarAtoms.push({ key: "chief_complaint", value: extraction.chief_complaint, confidence: "L2" });
  }
  if (extraction.present_illness_summary) {
    extractionScalarAtoms.push({ key: "present_illness_summary", value: extraction.present_illness_summary, confidence: "L2" });
  }
  if (extraction.treatment_advice) {
    extractionScalarAtoms.push({ key: "treatment_advice", value: extraction.treatment_advice, confidence: "L1" });
  }

  for (const item of extractionScalarAtoms) {
    pushAtom({
      atom_group: "extraction",
      atom_key: item.key,
      atom_value: item.value,
      unit: null,
      observed_at: summary.client_profile.last_updated_at,
      confidence_tier: item.confidence,
      quality_flags:
        item.key === "failed_count" && Number(item.value) > 0
          ? ["needs_manual_review", "potential_conflict"]
          : item.key === "manual_fill_needed_count" && Number(item.value) > 0
            ? ["needs_manual_review"]
            : item.key === "abnormal_item_summary"
              ? ["potential_conflict", "derived_from_summary"]
              : ["derived_from_summary"],
      derived_from: "workspace.extraction_results",
      source: { source_type: "workspace_summary", source_id: summary.client_profile.client_id }
    });
  }

  for (const trend of summary.chart_ready_items) {
    pushAtom({
      atom_group: "trend",
      atom_key: trend.item_name,
      atom_value: trend.item_value,
      unit: trend.reference_range || null,
      observed_at: trend.report_date,
      confidence_tier: trend.abnormal_flag ? "L1" : "L2",
      quality_flags: trend.abnormal_flag ? ["out_of_reference_range"] : [],
      derived_from: "workspace.chart_ready_items",
      source: { source_type: "chart", source_id: trend.item_name }
    });
  }

  pushAtom({
    atom_group: "cards",
    atom_key: "has_cards",
    atom_value: summary.latest_cards_summary.has_cards,
    unit: null,
    observed_at: summary.latest_cards_summary.updated_at,
    confidence_tier: "L1",
    derived_from: "workspace.latest_cards_summary",
    source: { source_type: "cards", source_id: summary.latest_cards_summary.latest_card_title }
  });
  pushAtom({
    atom_group: "cards",
    atom_key: "total_cards",
    atom_value: summary.latest_cards_summary.total_cards,
    unit: null,
    observed_at: summary.latest_cards_summary.updated_at,
    confidence_tier: "L1",
    derived_from: "workspace.latest_cards_summary",
    source: { source_type: "cards", source_id: summary.latest_cards_summary.latest_card_title }
  });

  pushAtom({
    atom_group: "draft",
    atom_key: "draft_status",
    atom_value: summary.latest_draft_summary.draft_status,
    unit: null,
    observed_at: summary.latest_draft_summary.draft_updated_at,
    confidence_tier: "L2",
    derived_from: "workspace.latest_draft_summary",
    source: { source_type: "draft", source_id: summary.client_profile.client_id }
  });

  pushAtom({
    atom_group: "tasks",
    atom_key: "open_count",
    atom_value: summary.current_tasks_summary.open_count,
    unit: null,
    observed_at: summary.client_profile.last_updated_at,
    confidence_tier: "L3",
    derived_from: "workspace.current_tasks_summary",
    source: { source_type: "tasks", source_id: summary.client_profile.client_id }
  });
  pushAtom({
    atom_group: "tasks",
    atom_key: "delayed_count",
    atom_value: summary.current_tasks_summary.delayed_count,
    unit: null,
    observed_at: summary.client_profile.last_updated_at,
    confidence_tier: "L3",
    quality_flags:
      summary.current_tasks_summary.delayed_count > 0 ? ["needs_manual_review", "potential_conflict"] : [],
    derived_from: "workspace.current_tasks_summary",
    source: { source_type: "tasks", source_id: summary.client_profile.client_id }
  });
  pushAtom({
    atom_group: "tasks",
    atom_key: "done_count",
    atom_value: summary.current_tasks_summary.done_count,
    unit: null,
    observed_at: summary.client_profile.last_updated_at,
    confidence_tier: "L3",
    derived_from: "workspace.current_tasks_summary",
    source: { source_type: "tasks", source_id: summary.client_profile.client_id }
  });

  pushAtom({
    atom_group: "feedback",
    atom_key: "has_feedback",
    atom_value: summary.latest_feedback_summary.has_feedback,
    unit: null,
    observed_at: summary.latest_feedback_summary.latest_feedback_at,
    confidence_tier: "L3",
    derived_from: "workspace.latest_feedback_summary",
    source: { source_type: "feedback", source_id: summary.client_profile.client_id }
  });

  if (summary.latest_feedback_summary.latest_feedback_hint) {
    pushAtom({
      atom_group: "feedback",
      atom_key: "latest_feedback_hint",
      atom_value: summary.latest_feedback_summary.latest_feedback_hint,
      unit: null,
      observed_at: summary.latest_feedback_summary.latest_feedback_at,
      confidence_tier: "L3",
      quality_flags: ["derived_from_summary"],
      derived_from: "workspace.latest_feedback_summary",
      source: { source_type: "feedback", source_id: summary.client_profile.client_id }
    });
  }

  return atoms;
}

function buildAtomStats(atoms: WorkspaceAtom[]): {
  by_group: Record<string, number>;
  by_confidence_tier: Record<string, number>;
  by_quality_flag: Record<string, number>;
} {
  const byGroup: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const byQualityFlag: Record<string, number> = {};

  for (const atom of atoms) {
    byGroup[atom.atom_group] = (byGroup[atom.atom_group] ?? 0) + 1;
    byTier[atom.confidence_tier] = (byTier[atom.confidence_tier] ?? 0) + 1;
    for (const flag of atom.quality_flags) {
      byQualityFlag[flag] = (byQualityFlag[flag] ?? 0) + 1;
    }
  }

  return {
    by_group: byGroup,
    by_confidence_tier: byTier,
    by_quality_flag: byQualityFlag
  };
}

function filterWorkspaceAtoms(
  atoms: WorkspaceAtom[],
  filters: {
    atomGroups?: WorkspaceAtom["atom_group"][];
    confidenceTiers?: WorkspaceAtomicConfidenceTier[];
    qualityFlags?: WorkspaceAtomQualityFlag[];
  }
): WorkspaceAtom[] {
  const allowedGroups = new Set(filters.atomGroups ?? []);
  const allowedTiers = new Set(filters.confidenceTiers ?? []);
  const requiredFlags = new Set(filters.qualityFlags ?? []);

  return atoms.filter((atom) => {
    if (allowedGroups.size > 0 && !allowedGroups.has(atom.atom_group)) {
      return false;
    }
    if (allowedTiers.size > 0 && !allowedTiers.has(atom.confidence_tier)) {
      return false;
    }
    if (requiredFlags.size > 0) {
      for (const flag of requiredFlags) {
        if (!atom.quality_flags.includes(flag)) {
          return false;
        }
      }
    }
    return true;
  });
}

export async function getWorkspaceAtomicProfileService(input: {
  tenantId: string;
  clientId: string;
  scenario: WorkspaceScenario;
  limit: number;
  atomGroups?: WorkspaceAtom["atom_group"][];
  confidenceTiers?: WorkspaceAtomicConfidenceTier[];
  qualityFlags?: WorkspaceAtomQualityFlag[];
}): Promise<WorkspaceAtomicProfileResponse> {
  const summary = await getWorkspaceSummaryService({
    tenantId: input.tenantId,
    clientId: input.clientId,
    scenario: input.scenario
  });

  const allAtoms = buildWorkspaceAtomsFromSummary(summary.data);
  const filteredAtoms = filterWorkspaceAtoms(allAtoms, {
    atomGroups: input.atomGroups,
    confidenceTiers: input.confidenceTiers,
    qualityFlags: input.qualityFlags
  });
  const truncated = filteredAtoms.length > input.limit;
  const atoms = filteredAtoms.slice(0, input.limit);

  return {
    result_type: summary.result_type,
    error_hint: summary.error_hint,
    data: {
      client_id: input.clientId,
      scenario_used: input.scenario,
      atomic_standard_version: "health-visible-atom-v1",
      atom_count: atoms.length,
      total_after_filter: filteredAtoms.length,
      truncated,
      applied_filters: {
        atom_groups: input.atomGroups ?? [],
        confidence_tiers: input.confidenceTiers ?? [],
        quality_flags: input.qualityFlags ?? []
      },
      atoms,
      stats: buildAtomStats(atoms)
    }
  };
}

export async function createWorkspaceDraftStubService(input: {
  tenantId: string;
  clientId: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}): Promise<WorkspaceCreatedStub> {
  const created = await createWorkspaceJobStub({
    tenantId: input.tenantId,
    actorId: input.actorId,
    clientId: input.clientId,
    jobType: "draft_stub",
    payload: input.metadata ?? {}
  });

  return {
    kind: "draft_stub",
    stub_id: created.job_id
  };
}

export async function createWorkspaceTaskStubService(input: {
  tenantId: string;
  clientId: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}): Promise<WorkspaceCreatedStub> {
  const created = await createWorkspaceJobStub({
    tenantId: input.tenantId,
    actorId: input.actorId,
    clientId: input.clientId,
    jobType: "task_stub",
    payload: input.metadata ?? {}
  });

  return {
    kind: "task_stub",
    stub_id: created.job_id
  };
}

export async function createWorkspaceFeedbackStubService(input: {
  tenantId: string;
  clientId: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}): Promise<WorkspaceCreatedStub> {
  const created = await createWorkspaceJobStub({
    tenantId: input.tenantId,
    actorId: input.actorId,
    clientId: input.clientId,
    jobType: "feedback_stub",
    payload: input.metadata ?? {}
  });

  return {
    kind: "feedback_stub",
    stub_id: created.job_id
  };
}

// Kept for backwards compatibility with older smoke tests/imports.
export function buildWorkspaceSummary(
  clientId: string,
  scenarioInput: WorkspaceScenario
): WorkspaceSummaryResponse {
  const scenario: Exclude<WorkspaceScenario, "auto"> = scenarioInput === "auto" ? "full" : scenarioInput;
  return buildWorkspaceSummaryMock(clientId, scenario);
}
