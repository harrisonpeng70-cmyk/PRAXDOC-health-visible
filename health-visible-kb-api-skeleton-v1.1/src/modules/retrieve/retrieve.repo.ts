import { query } from "../../config/db";

type SearchInput = {
  tenantId: string;
  actorType: string;
  actorId: string;
  clientId: string | null;
  approvedOnly: boolean;
  queryText: string;
  filters: {
    layers?: Array<"L1" | "L2" | "L3">;
    claim_types?: Array<"judgment" | "procedure">;
    topics?: string[];
    evidence_levels?: string[];
  };
  weights: {
    r_struct: number;
    r_keyword: number;
    r_vector: number;
    r_quality: number;
    w_layer: { L1: number; L2: number; L3: number };
    w_evidence: Record<string, number>;
    conflict_penalty: number;
  };
  topK: number;
};

type HitRow = {
  entry_id: string;
  version_id: string;
  kb_id: string;
  layer: "L1" | "L2" | "L3";
  claim_type: "judgment" | "procedure";
  topic: string;
  statement: string;
  applicability: string | null;
  contraindication: string | null;
  evidence_level: string;
  confidence_score: string;
  source_name: string;
  source_url: string;
  source_version: string | null;
  publication_date: string | null;
  citation_span: string | null;
  score_struct: string;
  score_keyword: string;
  score_vector: string;
  score_quality: string;
  score_final: string;
  conflict_flag: string;
  conflict_penalty: string;
};

export async function runHybridSearch(input: SearchInput): Promise<{
  queryId: string;
  hits: Array<{
    rank: number;
    entry_id: string;
    version_id: string;
    kb_id: string;
    layer: "L1" | "L2" | "L3";
    claim_type: "judgment" | "procedure";
    topic: string;
    statement: string;
    applicability: string | null;
    contraindication: string | null;
    evidence_level: string;
    confidence_score: number;
    source: {
      name: string;
      url: string;
      version: string | null;
      publication_date: string | null;
      citation_span: string | null;
    };
    scores: {
      struct: number;
      keyword: number;
      vector: number;
      quality: number;
      layer_weight: number;
      evidence_weight: number;
      conflict_penalty: number;
      final: number;
    };
    conflict_flag: boolean;
    labels: string[];
  }>;
}> {
  const startedAt = Date.now();
  const queryLogResult = await query<{ query_id: string }>(
    `
      INSERT INTO kb_query_logs (
        query_id, tenant_id, actor_type, actor_id, client_id, query_text, query_filters, top_k, result_type
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, $7, 'partial'
      )
      RETURNING query_id::text
    `,
    [
      input.tenantId,
      input.actorType,
      input.actorId,
      input.clientId,
      input.queryText,
      JSON.stringify(input.filters),
      input.topK
    ]
  );

  const queryId = queryLogResult.rows[0].query_id;

  try {
    const topics = input.filters.topics ?? [];
    const layers = input.filters.layers ?? [];
    const claimTypes = input.filters.claim_types ?? [];
    const evidenceLevels = input.filters.evidence_levels ?? [];

    const hitResult = await query<HitRow>(
      `
      WITH open_conflicts AS (
        SELECT DISTINCT topic
        FROM kb_conflicts
        WHERE tenant_id = $1
          AND resolution_status = 'open'
      ),
      candidates AS (
        SELECT
          e.entry_id::text,
          v.version_id::text,
          e.kb_id,
          e.layer::text AS layer,
          e.claim_type::text AS claim_type,
          e.topic,
          v.statement,
          v.applicability,
          v.contraindication,
          v.evidence_level,
          v.confidence_score::text,
          v.source_name,
          v.source_url,
          v.source_version,
          to_char(v.publication_date, 'YYYY-MM-DD') AS publication_date,
          v.citation_span,
          CASE WHEN cardinality($3::text[]) > 0 AND e.topic = ANY($3::text[]) THEN 0.90 ELSE 0.60 END::text AS score_struct,
          ts_rank(v.tsv, websearch_to_tsquery('simple', $2))::text AS score_keyword,
          0.50::text AS score_vector,
          v.confidence_score::text AS score_quality,
          CASE WHEN oc.topic IS NULL THEN 'false' ELSE 'true' END AS conflict_flag,
          CASE WHEN oc.topic IS NULL THEN '1.0' ELSE $18::text END AS conflict_penalty,
          (
            (
              $8::numeric * (CASE WHEN cardinality($3::text[]) > 0 AND e.topic = ANY($3::text[]) THEN 0.90 ELSE 0.60 END)::numeric
              + $9::numeric * ts_rank(v.tsv, websearch_to_tsquery('simple', $2))::numeric
              + $10::numeric * 0.50::numeric
              + $11::numeric * v.confidence_score::numeric
            )
            * (CASE e.layer
                WHEN 'L1' THEN $12::numeric
                WHEN 'L2' THEN $13::numeric
                ELSE $14::numeric
              END)
            * (CASE v.evidence_level
                WHEN 'A' THEN COALESCE($15::numeric, 1.0)
                WHEN 'B' THEN COALESCE($16::numeric, 0.85)
                ELSE COALESCE($17::numeric, 0.70)
              END)
            * (CASE WHEN oc.topic IS NULL THEN 1.0 ELSE $18::numeric END)
          )::text AS score_final
        FROM kb_entries e
        JOIN kb_entry_versions v ON v.entry_id = e.entry_id
        LEFT JOIN open_conflicts oc ON oc.topic = e.topic
        WHERE e.tenant_id = $1
          AND (
            ($19::boolean = true AND v.review_status = 'approved')
            OR ($19::boolean = false AND v.review_status IN ('approved', 'reviewing', 'draft'))
          )
          AND (v.valid_from IS NULL OR v.valid_from <= now())
          AND (v.valid_to IS NULL OR v.valid_to > now())
          AND (cardinality($3::text[]) = 0 OR e.topic = ANY($3::text[]))
          AND (cardinality($4::text[]) = 0 OR e.layer::text = ANY($4::text[]))
          AND (cardinality($5::text[]) = 0 OR e.claim_type::text = ANY($5::text[]))
          AND (cardinality($6::text[]) = 0 OR v.evidence_level = ANY($6::text[]))
      )
      SELECT *
      FROM candidates
      ORDER BY score_final::numeric DESC
      LIMIT $7
    `,
      [
        input.tenantId,
        input.queryText,
        topics,
        layers,
        claimTypes,
        evidenceLevels,
        input.topK,
        input.weights.r_struct,
        input.weights.r_keyword,
        input.weights.r_vector,
        input.weights.r_quality,
        input.weights.w_layer.L1,
        input.weights.w_layer.L2,
        input.weights.w_layer.L3,
        input.weights.w_evidence.A ?? 1.0,
        input.weights.w_evidence.B ?? 0.85,
        input.weights.w_evidence.C ?? 0.7,
        input.weights.conflict_penalty,
        input.approvedOnly
      ]
    );

    const hits = hitResult.rows.map((row: HitRow, idx: number) => {
      const layerWeight = row.layer === "L1" ? input.weights.w_layer.L1 : row.layer === "L2" ? input.weights.w_layer.L2 : input.weights.w_layer.L3;
      const evidenceWeight =
        row.evidence_level === "A"
          ? input.weights.w_evidence.A ?? 1.0
          : row.evidence_level === "B"
            ? input.weights.w_evidence.B ?? 0.85
            : input.weights.w_evidence.C ?? 0.7;

      return {
        rank: idx + 1,
        entry_id: row.entry_id,
        version_id: row.version_id,
        kb_id: row.kb_id,
        layer: row.layer,
        claim_type: row.claim_type,
        topic: row.topic,
        statement: row.statement,
        applicability: row.applicability,
        contraindication: row.contraindication,
        evidence_level: row.evidence_level,
        confidence_score: Number(row.confidence_score),
        source: {
          name: row.source_name,
          url: row.source_url,
          version: row.source_version,
          publication_date: row.publication_date,
          citation_span: row.citation_span
        },
        scores: {
          struct: Number(row.score_struct),
          keyword: Number(row.score_keyword),
          vector: Number(row.score_vector),
          quality: Number(row.score_quality),
          layer_weight: layerWeight,
          evidence_weight: evidenceWeight,
          conflict_penalty: Number(row.conflict_penalty),
          final: Number(row.score_final)
        },
        conflict_flag: row.conflict_flag === "true",
        labels: row.layer === "L3" ? ["exploratory_non_firstline"] : []
      };
    });

    for (const hit of hits) {
      await query(
        `
        INSERT INTO kb_hit_logs (
          hit_id, query_id, tenant_id, version_id, rank_no,
          score_struct, score_keyword, score_vector, score_quality,
          score_final, layer_weight, evidence_weight, conflict_penalty
        ) VALUES (
          gen_random_uuid(), $1, $2, $3::uuid, $4,
          $5, $6, $7, $8, $9, $10, $11, $12
        )
      `,
        [
          queryId,
          input.tenantId,
          hit.version_id,
          hit.rank,
          hit.scores.struct,
          hit.scores.keyword,
          hit.scores.vector,
          hit.scores.quality,
          hit.scores.final,
          hit.scores.layer_weight,
          hit.scores.evidence_weight,
          hit.scores.conflict_penalty
        ]
      );
    }

    return { queryId, hits };
  } catch (err) {
    await updateQueryLogResult(input.tenantId, queryId, "failed", Date.now() - startedAt);
    throw err;
  }
}

export async function updateQueryLogResult(
  tenantId: string,
  queryId: string,
  resultType: "success" | "partial" | "failed" | "manual_needed",
  latencyMs: number
): Promise<void> {
  await query(
    `
      UPDATE kb_query_logs
      SET
        result_type = $1,
        latency_ms = $2
      WHERE tenant_id = $3
        AND query_id = $4
    `,
    [resultType, latencyMs, tenantId, queryId]
  );
}

export async function findEntryById(
  tenantId: string,
  entryId: string
): Promise<unknown | null> {
  const result = await query(
    `
      SELECT
        entry_id::text,
        kb_id,
        layer::text,
        claim_type::text,
        topic,
        tags,
        current_version_no,
        is_active
      FROM kb_entries
      WHERE tenant_id = $1
        AND entry_id = $2
      LIMIT 1
    `,
    [tenantId, entryId]
  );

  return result.rows[0] ?? null;
}

export async function listVersions(
  tenantId: string,
  entryId: string
): Promise<unknown[]> {
  const result = await query(
    `
      SELECT
        version_id::text,
        version_no,
        review_status::text,
        evidence_level,
        to_char(publication_date, 'YYYY-MM-DD') AS publication_date,
        created_at
      FROM kb_entry_versions
      WHERE tenant_id = $1
        AND entry_id = $2
      ORDER BY version_no DESC
    `,
    [tenantId, entryId]
  );

  return result.rows;
}

export async function listConflicts(
  tenantId: string,
  resolutionStatus?: "open" | "resolved" | "ignored",
  severityGte?: number
): Promise<unknown[]> {
  const result = await query(
    `
      SELECT
        conflict_id::text,
        topic,
        conflict_type,
        severity,
        resolution_status,
        created_at
      FROM kb_conflicts
      WHERE tenant_id = $1
        AND ($2::text IS NULL OR resolution_status = $2::text)
        AND ($3::int IS NULL OR severity >= $3::int)
      ORDER BY severity DESC, created_at DESC
      LIMIT 200
    `,
    [tenantId, resolutionStatus ?? null, severityGte ?? null]
  );

  return result.rows;
}
