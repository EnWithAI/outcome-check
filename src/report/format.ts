// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Plain-text formatting of metric values shared by the Markdown and HTML reporters.
 */
import type { Metric, MetricValue } from "../types.js";

const REASONS: Record<string, string> = {
  "no-data": "no data",
  "insufficient-sample": "withheld: sample below min_sample",
  "field-not-exported": "field not in export",
  "input-not-provided": "input not provided",
};

/** Formats a number without trailing zeros. */
const num = (n: number): string => String(n);

/** Formats one metric value as text, e.g. "71.43% (5/7)" or "median 10 h · p75 24 · p90 48 (n=5)". */
export function formatValue(metric: Pick<Metric, "unit" | "kind">, v: MetricValue | null): string {
  if (v === null) return "—";
  if (v.unavailable_reason !== null) {
    const reason = REASONS[v.unavailable_reason] ?? v.unavailable_reason;
    return v.unavailable_reason === "insufficient-sample" ? `— (${reason}, n=${v.n})` : `— (${reason})`;
  }
  const flag = v.small_sample ? " ⚠ small sample" : "";
  if (metric.kind === "rate") {
    const pct = Math.round((v.value as number) * 10000) / 100;
    return `${num(pct)}% (${v.numerator}/${v.denominator})${flag}`;
  }
  const unit = metric.unit === "hours" ? " h" : "";
  return `median ${num(v.median as number)}${unit} · p75 ${num(v.p75 as number)} · p90 ${num(v.p90 as number)} (n=${v.n})${flag}`;
}

/** Human labels for segments. */
export const SEGMENT_LABELS = {
  all: "All PRs",
  ai_assisted: "AI-assisted",
  not_ai_assisted: "Not AI-assisted",
  unknown_attribution: "Attribution unknown",
} as const;
