// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Report contract types. Mirrors schema/outcome-check-report.schema.json (schema_version 1.0).
 */

/** verified_static_fact = computed directly from exported fields; hypothesis = proxy indicator; unknown = not computable. */
export type Status = "verified_static_fact" | "hypothesis" | "unknown";
/** Population a metric is computed over. */
export type Anchor = "closed" | "merged";
/** Segment names. */
export type SegmentName = "all" | "ai_assisted" | "not_ai_assisted" | "unknown_attribution";

/** One metric value for one segment or the baseline. Rates use numerator/denominator/value; distributions use median/p75/p90. */
export interface MetricValue {
  n: number;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  median: number | null;
  p75: number | null;
  p90: number | null;
  /** Why the value is null: no-data, insufficient-sample, field-not-exported, input-not-provided. */
  unavailable_reason: string | null;
  small_sample: boolean;
  /** PR numbers (only with --audit): numerator members for rates, all members for distributions. */
  audit_numerator?: number[];
  audit_denominator?: number[];
}

/** One metric with its definition and per-segment values. */
export interface Metric {
  id: string;
  title: string;
  definition: string;
  unit: "ratio" | "hours" | "lines";
  kind: "rate" | "distribution";
  status: Status;
  anchor: Anchor;
  segments: Record<SegmentName, MetricValue>;
  baseline: MetricValue | null;
  exclusions: { reason: string; count: number }[];
}

/** Recorded AI cost for merged AI-assisted PRs, per currency (no conversion). */
export interface AiCost {
  currency: string;
  total: number;
  prs_with_cost: number;
  ai_assisted_merged: number;
  per_pr: number;
}

/** Something the data could not support, stated explicitly. */
export interface Limitation {
  code: string;
  message: string;
  count: number;
}

/** Summary of one input file. */
export interface InputSummary {
  path: string;
  sha256: string;
  records: number;
}

/** The complete Outcome Check report. */
export interface Report {
  schema_version: "1.0";
  inputs: { prs: InputSummary; runs: InputSummary | null; attribution: InputSummary | null };
  window: {
    since: string | null;
    until: string | null;
    observed_first: string | null;
    observed_last: string | null;
    baseline_since: string | null;
    baseline_until: string | null;
  };
  population: {
    records: number;
    invalid: number;
    duplicates: number;
    bots_excluded: number;
    drafts_excluded: number;
    label_excluded: number;
    open: number;
    closed_in_window: number;
    merged_in_window: number;
  };
  attribution: {
    sources: string[];
    ai_assisted: number;
    not_ai_assisted: number;
    unknown: number;
    conflicts: number;
    unmatched_rows: number;
  };
  metrics: Metric[];
  ai_cost: AiCost[];
  coverage_limitations: Limitation[];
  notices: string[];
  run_metadata: {
    tool: "outcome-check";
    tool_version: string;
    generated_at: string;
    duration_ms: number;
    node_version: string;
    config_source: string;
    min_sample: number;
    audit: boolean;
    network: false;
    executed_code: false;
    model_usage: null;
    identities_in_output: false;
  };
}
