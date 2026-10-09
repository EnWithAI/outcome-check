# Outcome Check report

> Descriptive, not causal: differences between segments or windows do not show that AI assistance (or anything else) caused them.
> AI attribution is unknown unless an attribution file, a configured label or a configured commit trailer says otherwise.
> Rework and revert metrics are proxies (status: hypothesis), not quality judgements.
> No per-person data: identities are read only to compute aggregates and never appear in this report.

Window: 2026-09-01 to 2026-09-30 · baseline 2026-08-01 to 2026-08-31 · min_sample 20

| Records | Invalid | Duplicates | Bots excl. | Drafts excl. | Label excl. | Open | Closed in window | Merged in window |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 166 | 0 | 0 | 6 | 2 | 0 | 3 | 81 | 75 |

Attribution (file, labels): AI-assisted 75 · not AI-assisted 52 · unknown 31

## Metrics

| Metric | Status | All PRs | AI-assisted | Not AI-assisted | Attribution unknown | Baseline (all) |
|---|---|---|---|---|---|---|
| PR acceptance rate | measured | 92.59% (75/81) | 91.89% (34/37) | 96.3% (26/27) | — (withheld: sample below min_sample, n=17) | 91.89% (68/74) |
| Cycle time (created → merged) | measured | median 31 h · p75 46 · p90 58 (n=75) | median 28 h · p75 38 · p90 42 (n=34) | median 34.5 h · p75 49 · p90 54 (n=26) | — (withheld: sample below min_sample, n=15) | median 35 h · p75 44 · p90 63 (n=68) |
| Time to first review | measured | median 9.5 h · p75 14 · p90 17 (n=70) | median 8 h · p75 11 · p90 13 (n=30) | median 10.5 h · p75 15 · p90 16 (n=26) | — (withheld: sample below min_sample, n=14) | median 11 h · p75 13 · p90 19 (n=59) |
| Merged without review | measured | 6.67% (5/75) | 11.76% (4/34) | 0% (0/26) | — (withheld: sample below min_sample, n=15) | 13.24% (9/68) |
| Changes requested (rework proxy) | proxy | 21.33% (16/75) | 26.47% (9/34) | 11.54% (3/26) | — (withheld: sample below min_sample, n=15) | 22.06% (15/68) |
| Commits after first review (rework proxy) | proxy | 22.86% (16/70) | 30% (9/30) | 11.54% (3/26) | — (withheld: sample below min_sample, n=14) | 25.42% (15/59) |
| CI first-pass rate | measured | 80% (60/75) | 73.53% (25/34) | 88.46% (23/26) | — (withheld: sample below min_sample, n=15) | 70.59% (48/68) |
| Reverted PRs (proxy) | proxy | 1.35% (1/74) | 0% (0/34) | 0% (0/25) | — (withheld: sample below min_sample, n=15) | 0% (0/68) |
| PR size (lines changed) | measured | median 238 · p75 316 · p90 345 (n=75) | median 205 · p75 272 · p90 342 (n=34) | median 290.5 · p75 335 · p90 353 (n=26) | — (withheld: sample below min_sample, n=15) | median 178.5 · p75 254 · p90 321 (n=68) |

## AI cost (as recorded)

- `USD`: total 51.21, 2.05 per merged AI-assisted PR with a recorded cost (25 of 34 merged AI-assisted PRs have a cost). No conversion, no labor costs.

## Definitions

- **PR acceptance rate** (`acceptance_rate`): Merged PRs ÷ PRs closed (merged or not) in the window.
- **Cycle time (created → merged)** (`cycle_time_hours`): Hours from createdAt to mergedAt for PRs merged in the window; median, p75, p90.
- **Time to first review** (`time_to_first_review_hours`): Hours from createdAt to the first submitted review by someone other than the author, for merged PRs that had one.
- **Merged without review** (`unreviewed_merge_rate`): Merged PRs with no submitted review by someone other than the author ÷ merged PRs.
- **Changes requested (rework proxy)** (`changes_requested_rate`): Merged PRs with at least one CHANGES\_REQUESTED review ÷ merged PRs. A proxy for rework, not a quality score.
- **Commits after first review (rework proxy)** (`post_review_commit_rate`): Merged PRs with a commit dated after the first non-author review ÷ merged PRs that had such a review. A proxy for rework.
- **CI first-pass rate** (`ci_first_pass_rate`): Merged PRs whose first CI-tested commit passed every counted run on the first attempt ÷ merged PRs with linked CI runs.
- **Reverted PRs (proxy)** (`revert_rate`): Merged non-revert PRs whose exact title T is reverted by a later-merged PR titled Revert "T" anywhere in the export ÷ merged non-revert PRs. Only GitHub-style revert titles are detected.
- **PR size (lines changed)** (`pr_size_lines`): additions + deletions of merged PRs; median, p75, p90. Context for the other metrics, not an outcome.

## Data limitations

None detected.

<sub>Outcome Check 0.1.0-alpha.0 · offline · inputs: `prs.json`, `runs.json`, `attribution.csv` · Built by EnWithAI · Part of CrewPE Engineering Commons · [crewpe.ai](https://crewpe.ai)</sub>
