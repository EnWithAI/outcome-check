/**
 * Plain-text formatting of metric values shared by the Markdown and HTML reporters.
 */
import type { Metric, MetricValue } from "../types.js";
/** Formats one metric value as text, e.g. "71.43% (5/7)" or "median 10 h · p75 24 · p90 48 (n=5)". */
export declare function formatValue(metric: Pick<Metric, "unit" | "kind">, v: MetricValue | null): string;
/** Human labels for segments. */
export declare const SEGMENT_LABELS: {
    readonly all: "All PRs";
    readonly ai_assisted: "AI-assisted";
    readonly not_ai_assisted: "Not AI-assisted";
    readonly unknown_attribution: "Attribution unknown";
};
