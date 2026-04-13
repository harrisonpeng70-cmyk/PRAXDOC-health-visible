export type KbLayer = "L1" | "L2" | "L3";
export type ClaimType = "judgment" | "procedure";
export type ReviewStatus = "draft" | "reviewing" | "approved" | "rejected" | "deprecated";
export type ResultType = "success" | "partial" | "failed" | "manual_needed";

export interface RetrieveSearchWeights {
  r_struct: number;
  r_keyword: number;
  r_vector: number;
  r_quality: number;
  w_layer: {
    L1: number;
    L2: number;
    L3: number;
  };
  w_evidence: Record<string, number>;
  conflict_penalty: number;
}
