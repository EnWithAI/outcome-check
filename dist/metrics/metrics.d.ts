/**
 * Metric catalog and computation (docs/SPEC.md §5). Each metric maps a set of PRs to a rate (numerator/denominator)
 * or a distribution (median/p75/p90). Statistics: median = mean of the two middle values for even n; p75/p90 by
 * nearest rank. Hours and lines are rounded to 2 decimals, ratios to 4.
 */
import type { PullRequest, Run } from "../input/read.js";
import type { Anchor, MetricValue, Status } from "../types.js";
/**
 * Rounds to a fixed number of decimals, half away from zero, on the decimal representation (so 1.005 → 1.01,
 * which naive `Math.round(x * 100) / 100` gets wrong because of binary floating point).
 */
export declare function round(value: number, decimals: number): number;
/** Minimum and maximum without spreading into arguments (safe for very large arrays); null when empty. */
export declare function extent(values: readonly number[]): {
    min: number;
    max: number;
} | null;
/** Median (mean of the two middle values for even n). Input need not be sorted. */
export declare function median(values: number[]): number;
/** Nearest-rank percentile: the ceil(p·n)-th smallest value (p in 0..1). */
export declare function nearestRank(values: number[], p: number): number;
/** Shared context for metric computation. */
export interface MetricContext {
    runsBySha: Map<string, Run[]> | null;
    /** Reverted title → latest merge time of a merged `Revert "<title>"` PR anywhere in the export. */
    revertedTitles: Map<string, number>;
    reviewsExported: boolean;
    commitsExported: boolean;
}
/** Result of a metric over one PR set, before sample-size rules. */
export type Computed = {
    kind: "rate";
    numerator: number[];
    denominator: number[];
} | {
    kind: "distribution";
    values: {
        pr: number;
        value: number;
    }[];
} | {
    kind: "unavailable";
    reason: string;
};
/** Static metric description. */
export interface MetricDef {
    id: string;
    title: string;
    definition: string;
    unit: "ratio" | "hours" | "lines";
    kind: "rate" | "distribution";
    status: Status;
    anchor: Anchor;
    compute: (prs: PullRequest[], ctx: MetricContext) => Computed;
}
/** First-pass CI result for a PR: true/false, or null when no counted run is linked. */
export declare function firstPass(pr: PullRequest, runsBySha: Map<string, Run[]>): boolean | null;
/** Revert PR title pattern used by GitHub's "Revert" button. */
export declare const REVERT_TITLE: RegExp;
/** The metric catalog, in report order. */
export declare const METRICS: MetricDef[];
/** Turns a computed result into a MetricValue, applying the sample-size rule. */
export declare function toValue(computed: Computed, unit: MetricDef["unit"], minSample: number, withhold: boolean, audit: boolean): MetricValue;
