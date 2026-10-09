/**
 * Metric catalog and computation (docs/SPEC.md §5). Each metric maps a set of PRs to a rate (numerator/denominator)
 * or a distribution (median/p75/p90). Statistics: median = mean of the two middle values for even n; p75/p90 by
 * nearest rank. Hours and lines are rounded to 2 decimals, ratios to 4.
 */
import type { PullRequest, Run } from "../input/read.js";
import type { Anchor, MetricValue, Status } from "../types.js";

const HOUR = 3_600_000;

/**
 * Rounds to a fixed number of decimals, half away from zero, on the decimal representation (so 1.005 → 1.01,
 * which naive `Math.round(x * 100) / 100` gets wrong because of binary floating point).
 */
export function round(value: number, decimals: number): number {
  const shifted = Number(`${Math.abs(value)}e${decimals}`);
  if (!Number.isFinite(shifted)) return Math.round(value * 10 ** decimals) / 10 ** decimals; // e.g. 1e-7
  return Math.sign(value) * Number(`${Math.round(shifted)}e-${decimals}`);
}

/** Minimum and maximum without spreading into arguments (safe for very large arrays); null when empty. */
export function extent(values: readonly number[]): { min: number; max: number } | null {
  if (values.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/** Median (mean of the two middle values for even n). Input need not be sorted. */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Nearest-rank percentile: the ceil(p·n)-th smallest value (p in 0..1). */
export function nearestRank(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(p * s.length) - 1)] as number;
}

/** Shared context for metric computation. */
export interface MetricContext {
  runsBySha: Map<string, Run[]> | null;
  /** Reverted title → latest merge time of a merged `Revert "<title>"` PR anywhere in the export. */
  revertedTitles: Map<string, number>;
  reviewsExported: boolean;
  commitsExported: boolean;
}

/** Result of a metric over one PR set, before sample-size rules. */
export type Computed =
  | { kind: "rate"; numerator: number[]; denominator: number[] }
  | { kind: "distribution"; values: { pr: number; value: number }[] }
  | { kind: "unavailable"; reason: string };

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

/** Reviews by someone other than the PR author that were actually submitted. */
function nonAuthorReviews(pr: PullRequest): { state: string; submittedAt: number }[] {
  return (pr.reviews ?? [])
    .filter(
      (r) =>
        r.state !== "PENDING" && r.submittedAt !== null && (r.login === null || r.login !== pr.authorLogin)
    )
    .map((r) => ({ state: r.state, submittedAt: r.submittedAt as number }));
}

/** Earliest non-author review time, or null. */
function firstReview(pr: PullRequest): number | null {
  return extent(nonAuthorReviews(pr).map((r) => r.submittedAt))?.min ?? null;
}

const IGNORED_CONCLUSIONS = new Set(["cancelled", "skipped", "neutral", "stale"]);

/** First-pass CI result for a PR: true/false, or null when no counted run is linked. */
export function firstPass(pr: PullRequest, runsBySha: Map<string, Run[]>): boolean | null {
  const commits = [...(pr.commits ?? [])]
    .map((c, index) => ({ ...c, index }))
    .sort((a, b) => (a.committedDate ?? Infinity) - (b.committedDate ?? Infinity) || a.index - b.index);
  for (const commit of commits) {
    const counted = (runsBySha.get(commit.oid) ?? []).filter(
      (r) => r.status === "completed" && !(r.attempt === 1 && IGNORED_CONCLUSIONS.has(r.conclusion))
    );
    if (counted.length > 0) return counted.every((r) => r.attempt === 1 && r.conclusion === "success");
  }
  return null;
}

/** Revert PR title pattern used by GitHub's "Revert" button. */
export const REVERT_TITLE = /^Revert "(.+)"$/;

const merged = (prs: PullRequest[]): PullRequest[] => prs.filter((p) => p.mergedAt !== null);

/** The metric catalog, in report order. */
export const METRICS: MetricDef[] = [
  {
    id: "acceptance_rate",
    title: "PR acceptance rate",
    definition: "Merged PRs ÷ PRs closed (merged or not) in the window.",
    unit: "ratio",
    kind: "rate",
    status: "verified_static_fact",
    anchor: "closed",
    compute: (prs) => ({
      kind: "rate",
      numerator: merged(prs).map((p) => p.number),
      denominator: prs.map((p) => p.number),
    }),
  },
  {
    id: "cycle_time_hours",
    title: "Cycle time (created → merged)",
    definition: "Hours from createdAt to mergedAt for PRs merged in the window; median, p75, p90.",
    unit: "hours",
    kind: "distribution",
    status: "verified_static_fact",
    anchor: "merged",
    compute: (prs) => ({
      kind: "distribution",
      values: prs
        .map((p) => ({ pr: p.number, value: ((p.mergedAt as number) - p.createdAt) / HOUR }))
        .filter((v) => v.value >= 0),
    }),
  },
  {
    id: "time_to_first_review_hours",
    title: "Time to first review",
    definition:
      "Hours from createdAt to the first submitted review by someone other than the author, for merged PRs that had one.",
    unit: "hours",
    kind: "distribution",
    status: "verified_static_fact",
    anchor: "merged",
    compute: (prs, ctx) => {
      if (!ctx.reviewsExported) return { kind: "unavailable", reason: "field-not-exported" };
      return {
        kind: "distribution",
        values: prs.flatMap((p) => {
          const first = firstReview(p);
          return first === null || first < p.createdAt
            ? []
            : [{ pr: p.number, value: (first - p.createdAt) / HOUR }];
        }),
      };
    },
  },
  {
    id: "unreviewed_merge_rate",
    title: "Merged without review",
    definition: "Merged PRs with no submitted review by someone other than the author ÷ merged PRs.",
    unit: "ratio",
    kind: "rate",
    status: "verified_static_fact",
    anchor: "merged",
    compute: (prs, ctx) =>
      ctx.reviewsExported
        ? {
            kind: "rate",
            numerator: prs.filter((p) => firstReview(p) === null).map((p) => p.number),
            denominator: prs.map((p) => p.number),
          }
        : { kind: "unavailable", reason: "field-not-exported" },
  },
  {
    id: "changes_requested_rate",
    title: "Changes requested (rework proxy)",
    definition:
      "Merged PRs with at least one CHANGES_REQUESTED review ÷ merged PRs. A proxy for rework, not a quality score.",
    unit: "ratio",
    kind: "rate",
    status: "hypothesis",
    anchor: "merged",
    compute: (prs, ctx) =>
      ctx.reviewsExported
        ? {
            kind: "rate",
            numerator: prs
              .filter((p) => nonAuthorReviews(p).some((r) => r.state === "CHANGES_REQUESTED"))
              .map((p) => p.number),
            denominator: prs.map((p) => p.number),
          }
        : { kind: "unavailable", reason: "field-not-exported" },
  },
  {
    id: "post_review_commit_rate",
    title: "Commits after first review (rework proxy)",
    definition:
      "Merged PRs with a commit dated after the first non-author review ÷ merged PRs that had such a review. A proxy for rework.",
    unit: "ratio",
    kind: "rate",
    status: "hypothesis",
    anchor: "merged",
    compute: (prs, ctx) => {
      if (!ctx.reviewsExported || !ctx.commitsExported)
        return { kind: "unavailable", reason: "field-not-exported" };
      const reviewed = prs.filter((p) => firstReview(p) !== null);
      return {
        kind: "rate",
        numerator: reviewed
          .filter((p) =>
            (p.commits ?? []).some(
              (c) => c.committedDate !== null && c.committedDate > (firstReview(p) as number)
            )
          )
          .map((p) => p.number),
        denominator: reviewed.map((p) => p.number),
      };
    },
  },
  {
    id: "ci_first_pass_rate",
    title: "CI first-pass rate",
    definition:
      "Merged PRs whose first CI-tested commit passed every counted run on the first attempt ÷ merged PRs with linked CI runs.",
    unit: "ratio",
    kind: "rate",
    status: "verified_static_fact",
    anchor: "merged",
    compute: (prs, ctx) => {
      if (ctx.runsBySha === null) return { kind: "unavailable", reason: "input-not-provided" };
      if (!ctx.commitsExported) return { kind: "unavailable", reason: "field-not-exported" };
      const results = prs.map((p) => ({
        pr: p.number,
        pass: firstPass(p, ctx.runsBySha as Map<string, Run[]>),
      }));
      const linked = results.filter((r) => r.pass !== null);
      return {
        kind: "rate",
        numerator: linked.filter((r) => r.pass).map((r) => r.pr),
        denominator: linked.map((r) => r.pr),
      };
    },
  },
  {
    id: "revert_rate",
    title: "Reverted PRs (proxy)",
    definition:
      'Merged non-revert PRs whose exact title T is reverted by a later-merged PR titled Revert "T" anywhere in the export ÷ merged non-revert PRs. Only GitHub-style revert titles are detected.',
    unit: "ratio",
    kind: "rate",
    status: "hypothesis",
    anchor: "merged",
    compute: (prs, ctx) => {
      const candidates = prs.filter((p) => !REVERT_TITLE.test(p.title));
      return {
        kind: "rate",
        numerator: candidates
          .filter((p) => (ctx.revertedTitles.get(p.title) ?? -Infinity) > (p.mergedAt as number))
          .map((p) => p.number),
        denominator: candidates.map((p) => p.number),
      };
    },
  },
  {
    id: "pr_size_lines",
    title: "PR size (lines changed)",
    definition:
      "additions + deletions of merged PRs; median, p75, p90. Context for the other metrics, not an outcome.",
    unit: "lines",
    kind: "distribution",
    status: "verified_static_fact",
    anchor: "merged",
    compute: (prs) => ({
      kind: "distribution",
      values: prs.filter((p) => p.size !== null).map((p) => ({ pr: p.number, value: p.size as number })),
    }),
  },
];

/** A withheld value: only n is shown (no numerator or PR numbers, so small groups cannot be singled out). */
function withheld(n: number): MetricValue {
  return {
    n,
    numerator: null,
    denominator: null,
    value: null,
    median: null,
    p75: null,
    p90: null,
    unavailable_reason: "insufficient-sample",
    small_sample: true,
  };
}

/** Turns a computed result into a MetricValue, applying the sample-size rule. */
export function toValue(
  computed: Computed,
  unit: MetricDef["unit"],
  minSample: number,
  withhold: boolean,
  audit: boolean
): MetricValue {
  const empty = {
    numerator: null,
    denominator: null,
    value: null,
    median: null,
    p75: null,
    p90: null,
  };
  if (computed.kind === "unavailable") {
    return { n: 0, ...empty, unavailable_reason: computed.reason, small_sample: false };
  }
  const decimals = unit === "ratio" ? 4 : 2;
  if (computed.kind === "rate") {
    const n = computed.denominator.length;
    const base: MetricValue = {
      n,
      ...empty,
      numerator: computed.numerator.length,
      denominator: n,
      unavailable_reason: null,
      small_sample: n < minSample,
      ...(audit
        ? {
            audit_numerator: [...computed.numerator].sort((a, b) => a - b),
            audit_denominator: [...computed.denominator].sort((a, b) => a - b),
          }
        : {}),
    };
    if (n === 0) return { ...base, unavailable_reason: "no-data", small_sample: false };
    if (withhold && n < minSample) return withheld(n);
    return { ...base, value: round(computed.numerator.length / n, decimals) };
  }
  const values = computed.values.map((v) => v.value);
  const n = values.length;
  const base: MetricValue = {
    n,
    ...empty,
    unavailable_reason: null,
    small_sample: n < minSample,
    ...(audit ? { audit_denominator: computed.values.map((v) => v.pr).sort((a, b) => a - b) } : {}),
  };
  if (n === 0) return { ...base, unavailable_reason: "no-data", small_sample: false };
  if (withhold && n < minSample) return withheld(n);
  return {
    ...base,
    median: round(median(values), decimals),
    p75: round(nearestRank(values, 0.75), decimals),
    p90: round(nearestRank(values, 0.9), decimals),
  };
}
