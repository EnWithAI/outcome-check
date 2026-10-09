/**
 * Analysis pipeline: read inputs → validate records → population filters → attribution → windows → metrics per
 * segment and baseline → AI cost → data-quality limitations and notices. Pure apart from reading inputs and the clock.
 */
import { basename } from "node:path";
import type { Config } from "./config.js";
import { usageError } from "./errors.js";
import {
  parseAttribution,
  parseJsonArray,
  readInput,
  toPullRequest,
  toRun,
  type AttributionRow,
  type PullRequest,
  type Run,
} from "./input/read.js";
import { METRICS, REVERT_TITLE, round, toValue, type MetricContext } from "./metrics/metrics.js";
import type { AiCost, Limitation, Metric, Report, SegmentName } from "./types.js";
import { TOOL_VERSION } from "./version.js";

/** Options for one report. */
export interface AnalyzeOptions {
  prsPath: string;
  runsPath: string | null;
  attributionPath: string | null;
  since: string | null;
  until: string | null;
  baselineSince: string | null;
  baselineUntil: string | null;
  config: Config;
  configSource: string;
  audit: boolean;
  now?: () => Date;
}

/** Fixed statements printed in every report. */
export const NOTICES = [
  "Descriptive, not causal: differences between segments or windows do not show that AI assistance (or anything else) caused them.",
  "AI attribution is unknown unless an attribution file, a configured label or a configured commit trailer says otherwise.",
  "Rework and revert metrics are proxies (status: hypothesis), not quality judgements.",
  "No per-person data: identities are read only to compute aggregates and never appear in this report.",
];

const DAY = 86_400_000;
const ROUND_LIMITS = new Set([20, 30, 50, 100, 200, 300, 500, 1000, 2000, 5000, 10000]);

/** Parses a YYYY-MM-DD flag into [start, endExclusive) epoch ms; null when absent. */
function day(value: string | null, flag: string, end: boolean): number | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
    throw usageError(`${flag} must be a date in YYYY-MM-DD format`);
  const start = Date.parse(`${value}T00:00:00Z`);
  return end ? start + DAY : start;
}

/** True when `t` falls in [since, until). */
const inWindow = (t: number | null, since: number | null, until: number | null): boolean =>
  t !== null && (since === null || t >= since) && (until === null || t < until);

/** Display path: the file name only (no absolute paths in reports). */
const shown = (path: string): string => basename(path);

/** Runs the analysis and returns a report. */
export function analyze(options: AnalyzeOptions): Report {
  const now = options.now ?? (() => new Date());
  const started = Date.now();
  const { config } = options;
  const since = day(options.since, "--since", false);
  const until = day(options.until, "--until", true);
  const bSince = day(options.baselineSince, "--baseline-since", false);
  const bUntil = day(options.baselineUntil, "--baseline-until", true);
  if (since !== null && until !== null && since >= until) throw usageError("--since must not be after --until");
  if ((options.baselineSince === null) !== (options.baselineUntil === null))
    throw usageError("--baseline-since and --baseline-until must be given together");
  if (bSince !== null && bUntil !== null && bSince >= bUntil)
    throw usageError("--baseline-since must not be after --baseline-until");

  const limitations: Limitation[] = [];
  const limit = (code: string, message: string, count: number): void => {
    if (count > 0) limitations.push({ code, message, count });
  };

  // Pull requests.
  const prFile = readInput(options.prsPath, "--prs");
  const rawPrs = parseJsonArray(prFile.text, "--prs");
  const seen = new Set<number>();
  let invalid = 0;
  let duplicates = 0;
  const valid: PullRequest[] = [];
  for (const raw of rawPrs) {
    const pr = toPullRequest(raw);
    if (pr === null) invalid++;
    else if (seen.has(pr.number)) duplicates++;
    else {
      seen.add(pr.number);
      valid.push(pr);
    }
  }
  limit("invalid-record", "PR records without a valid number, state or timestamps were excluded.", invalid);
  limit("duplicate-pr", "Duplicate PR numbers were found; the first occurrence was kept.", duplicates);
  if (ROUND_LIMITS.has(rawPrs.length))
    limit(
      "possible-truncated-export",
      `The PR file has exactly ${rawPrs.length} records, a common --limit value; the export may be truncated. Re-export with a higher --limit.`,
      rawPrs.length
    );

  // Population filters.
  let bots = 0;
  let drafts = 0;
  let labelExcluded = 0;
  const population: PullRequest[] = [];
  for (const pr of valid) {
    if (pr.isBot && !config.includeBots) bots++;
    else if (pr.isDraft) drafts++;
    else if (pr.labels.some((l) => config.excludeLabels.includes(l))) labelExcluded++;
    else population.push(pr);
  }

  const reviewsExported = valid.some((p) => p.reviews !== null);
  const commitsExported = valid.some((p) => p.commits !== null);
  if (!reviewsExported) limit("reviews-not-exported", "No PR record includes `reviews`; review metrics are unavailable.", 1);
  if (!commitsExported)
    limit("commits-not-exported", "No PR record includes `commits`; CI and post-review metrics are unavailable.", 1);
  limit(
    "reviews-truncated",
    "Some PRs have exactly 100 reviews, the gh export cap; later reviews are missing.",
    valid.filter((p) => p.reviews?.length === 100).length
  );
  limit(
    "commits-truncated",
    "Some PRs have exactly 100 commits, the gh export cap; later commits are missing.",
    valid.filter((p) => p.commits?.length === 100).length
  );
  limit(
    "inconsistent-timestamps",
    "PRs merged before they were created were excluded from cycle time.",
    population.filter((p) => p.mergedAt !== null && p.mergedAt < p.createdAt).length
  );

  // CI runs.
  let runsSummary: Report["inputs"]["runs"] = null;
  let runsBySha: Map<string, Run[]> | null = null;
  if (options.runsPath !== null) {
    const runFile = readInput(options.runsPath, "--runs");
    const rawRuns = parseJsonArray(runFile.text, "--runs");
    const runs = rawRuns.map(toRun);
    limit("invalid-run", "Run records without a valid headSha were excluded.", runs.filter((r) => r === null).length);
    runsBySha = new Map();
    for (const run of runs) {
      if (run === null) continue;
      runsBySha.set(run.headSha, [...(runsBySha.get(run.headSha) ?? []), run]);
    }
    const prShas = new Set(valid.flatMap((p) => (p.commits ?? []).map((c) => c.oid)));
    limit(
      "runs-not-linked",
      "Runs whose headSha is not a commit of any exported PR (pushes to main, rebased commits) were not used.",
      [...runsBySha.entries()].filter(([sha]) => !prShas.has(sha)).reduce((n, [, r]) => n + r.length, 0)
    );
    if (ROUND_LIMITS.has(rawRuns.length))
      limit(
        "possible-truncated-runs",
        `The runs file has exactly ${rawRuns.length} records, a common --limit value; CI coverage may be incomplete.`,
        rawRuns.length
      );
    runsSummary = { path: shown(options.runsPath), sha256: runFile.sha256, records: rawRuns.length };
  }

  // Attribution.
  const sources: string[] = [];
  let attributionSummary: Report["inputs"]["attribution"] = null;
  const fileRows = new Map<number, AttributionRow>();
  let unmatched = 0;
  if (options.attributionPath !== null) {
    const file = readInput(options.attributionPath, "--attribution");
    const parsed = parseAttribution(file.text, options.attributionPath);
    limit("invalid-attribution-row", "Attribution rows with an invalid pr, ai_assisted, cost or currency were ignored.", parsed.invalid);
    for (const row of parsed.rows) if (!fileRows.has(row.pr)) fileRows.set(row.pr, row);
    unmatched = [...fileRows.keys()].filter((n) => !seen.has(n)).length;
    limit("attribution-unmatched", "Attribution rows referred to PR numbers that are not in the PR export.", unmatched);
    attributionSummary = { path: shown(options.attributionPath), sha256: file.sha256, records: parsed.rows.length + parsed.invalid };
    sources.push("file");
  }
  if (Object.keys(config.attributionLabels).length > 0) sources.push("labels");
  if (config.commitTrailers.length > 0) sources.push("commit-trailers");
  const trailers = config.commitTrailers.map((t) => t.toLowerCase());
  let conflicts = 0;
  const attribution = new Map<number, boolean | null>();
  for (const pr of population) {
    const fromFile = fileRows.get(pr.number)?.aiAssisted ?? null;
    const labelFlags = pr.labels.filter((l) => l in config.attributionLabels).map((l) => config.attributionLabels[l] as boolean);
    const fromLabel = labelFlags.length === 0 ? null : labelFlags.includes(true) && !labelFlags.includes(false) ? true : labelFlags.includes(false) && !labelFlags.includes(true) ? false : null;
    const fromTrailer =
      trailers.length > 0 &&
      (pr.commits ?? []).some((c) => c.message.split("\n").some((line) => trailers.some((t) => line.trim().toLowerCase().startsWith(t))))
        ? true
        : null;
    if (fromFile !== null && fromLabel !== null && fromFile !== fromLabel) conflicts++;
    attribution.set(pr.number, fromFile ?? fromLabel ?? fromTrailer);
  }
  limit("attribution-conflict", "The attribution file and a label disagreed; the file was used.", conflicts);
  const segmentOf = (pr: PullRequest): SegmentName => {
    const a = attribution.get(pr.number);
    return a === true ? "ai_assisted" : a === false ? "not_ai_assisted" : "unknown_attribution";
  };

  // Windows.
  const closed = (s: number | null, u: number | null): PullRequest[] =>
    population.filter((p) => p.state !== "OPEN" && inWindow(p.closedAt, s, u));
  const mergedIn = (s: number | null, u: number | null): PullRequest[] =>
    population.filter((p) => inWindow(p.mergedAt, s, u));
  const closedNow = closed(since, until);
  const mergedNow = mergedIn(since, until);
  if (closedNow.length === 0) limit("window-empty", "No PR closed in the window.", 1);

  // Context for revert detection: merged revert PRs anywhere in the export.
  const revertedTitles = new Set(
    valid
      .filter((p) => p.mergedAt !== null)
      .map((p) => REVERT_TITLE.exec(p.title)?.[1])
      .filter((t): t is string => t !== undefined)
  );
  const ctx: MetricContext = { runsBySha, revertedTitles, reviewsExported, commitsExported };

  const segmentNames: SegmentName[] = ["all", "ai_assisted", "not_ai_assisted", "unknown_attribution"];
  const metrics: Metric[] = METRICS.map((def) => {
    const base = def.anchor === "closed" ? closedNow : mergedNow;
    const segments = Object.fromEntries(
      segmentNames.map((seg) => {
        const prs = seg === "all" ? base : base.filter((p) => segmentOf(p) === seg);
        return [seg, toValue(def.compute(prs, ctx), def.unit, config.minSample, seg !== "all", options.audit)];
      })
    ) as Metric["segments"];
    const baseline =
      bSince === null
        ? null
        : toValue(
            def.compute(def.anchor === "closed" ? closed(bSince, bUntil) : mergedIn(bSince, bUntil), ctx),
            def.unit,
            config.minSample,
            true,
            options.audit
          );
    const exclusions = [
      { reason: "bot-author", count: bots },
      { reason: "draft", count: drafts },
      { reason: "excluded-label", count: labelExcluded },
      { reason: "invalid-record", count: invalid },
    ].filter((e) => e.count > 0);
    return {
      id: def.id,
      title: def.title,
      definition: def.definition,
      unit: def.unit,
      kind: def.kind,
      status: segments.all.unavailable_reason === "field-not-exported" || segments.all.unavailable_reason === "input-not-provided" ? "unknown" : def.status,
      anchor: def.anchor,
      segments,
      baseline,
      exclusions,
    };
  });

  // AI cost (as recorded; per currency).
  const aiMerged = mergedNow.filter((p) => attribution.get(p.number) === true);
  const byCurrency = new Map<string, { total: number; prs: number }>();
  for (const pr of aiMerged) {
    const row = fileRows.get(pr.number);
    if (row?.cost === null || row?.cost === undefined || row.currency === null) continue;
    const entry = byCurrency.get(row.currency) ?? { total: 0, prs: 0 };
    byCurrency.set(row.currency, { total: entry.total + row.cost, prs: entry.prs + 1 });
  }
  const aiCost: AiCost[] = [...byCurrency.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([currency, { total, prs }]) => ({
      currency,
      total: round(total, 2),
      prs_with_cost: prs,
      ai_assisted_merged: aiMerged.length,
      per_pr: round(total / prs, 2),
    }));

  const times = population.flatMap((p) => [p.createdAt, p.closedAt, p.mergedAt]).filter((t): t is number => t !== null);
  const iso = (t: number | null): string | null => (t === null ? null : new Date(t).toISOString().slice(0, 10));
  limitations.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const counts = { ai: 0, not: 0, unknown: 0 };
  for (const pr of population) {
    const a = attribution.get(pr.number);
    if (a === true) counts.ai++;
    else if (a === false) counts.not++;
    else counts.unknown++;
  }

  return {
    schema_version: "1.0",
    inputs: {
      prs: { path: shown(options.prsPath), sha256: prFile.sha256, records: rawPrs.length },
      runs: runsSummary,
      attribution: attributionSummary,
    },
    window: {
      since: options.since,
      until: options.until,
      observed_first: iso(times.length > 0 ? Math.min(...times) : null),
      observed_last: iso(times.length > 0 ? Math.max(...times) : null),
      baseline_since: options.baselineSince,
      baseline_until: options.baselineUntil,
    },
    population: {
      records: rawPrs.length,
      invalid,
      duplicates,
      bots_excluded: bots,
      drafts_excluded: drafts,
      label_excluded: labelExcluded,
      open: population.filter((p) => p.state === "OPEN").length,
      closed_in_window: closedNow.length,
      merged_in_window: mergedNow.length,
    },
    attribution: {
      sources,
      ai_assisted: counts.ai,
      not_ai_assisted: counts.not,
      unknown: counts.unknown,
      conflicts,
      unmatched_rows: unmatched,
    },
    metrics,
    ai_cost: aiCost,
    coverage_limitations: limitations,
    notices: NOTICES,
    run_metadata: {
      tool: "outcome-check",
      tool_version: TOOL_VERSION,
      generated_at: now().toISOString(),
      duration_ms: Math.max(0, Date.now() - started),
      node_version: process.version,
      config_source: options.configSource,
      min_sample: config.minSample,
      audit: options.audit,
      network: false,
      executed_code: false,
      model_usage: null,
      identities_in_output: false,
    },
  };
}
