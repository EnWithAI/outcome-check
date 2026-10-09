# Outcome Check — behavior specification (alpha 0.1)

Status: written **before** implementation (spec-first). Acceptance tests in `test/acceptance/` encode section 8 with
hand-computed expected values and were committed failing before the metrics existed.

## 1. Problem and user

Engineering leads and platform teams want to know what AI-assisted (and other) work actually delivered, not how many
tokens were spent. Outcome Check turns **files you export yourself** (`gh pr list --json …`, `gh run list --json …`,
an optional attribution file) into delivery-outcome metrics with stated definitions, denominators, exclusions,
windows and sample sizes.

It is offline and read-only. It never calls GitHub or any other API, never phones home and never runs anything.

## 2. Principles (from the brief and addendum; binding)

- **Definitions over dashboards.** Every metric publishes its formula, anchor date, numerator, denominator, `n` and
  exclusions. No composite score.
- **No people metrics.** Logins, names, emails, titles and commit messages are read only to compute aggregates (bot
  detection, self-review exclusion, revert matching, trailer attribution) and **never appear in any output**. No
  per-person breakdown, no ranking.
- **Attribution is `unknown` unless explicit.** AI assistance comes only from an attribution file, configured labels or
  configured commit-trailer prefixes. Absence of a signal is never "not AI".
- **Not causal.** Segment and baseline values are shown side by side as descriptions. No "AI improved X by Y%" claims.
  Small samples are withheld, not extrapolated.
- **Proxies are labelled.** Rework and revert metrics are `hypothesis` (indirect indicators); direct computations are
  `verified_static_fact`; unavailable metrics are `unknown` with a reason.
- **Costs only as recorded.** Costs come from the attribution file in their own currency. No conversion, no labor
  costs, no ROI.

## 3. Inputs

| Input                    | Flag                               | Shape                                                                                                                                                                         |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull requests (required) | `--prs <file>`                     | JSON array as written by `gh pr list --state all --limit <N> --json number,title,state,isDraft,createdAt,closedAt,mergedAt,author,labels,additions,deletions,reviews,commits` |
| CI runs (optional)       | `--runs <file>`                    | JSON array from `gh run list --limit <N> --json databaseId,headSha,event,status,conclusion,attempt,createdAt,workflowName`                                                    |
| Attribution (optional)   | `--attribution <file>`             | CSV with header `pr,ai_assisted[,cost,currency,tool]` or a JSON array of the same keys. `ai_assisted`: `true`, `false` or empty/`unknown`.                                    |
| Config (optional)        | `--config` / `.outcome-check.json` | data-only JSON (section 7)                                                                                                                                                    |

Required per PR: `number` (positive integer), `state` (`OPEN`/`CLOSED`/`MERGED`), `createdAt`. Records failing
validation are excluded and counted (`invalid-record`). Optional fields that are absent from **every** record make the
dependent metrics `unknown` (for example, no `reviews` means no review metrics).

## 4. Population and windows

1. Drop invalid records, duplicates (first occurrence kept), bot authors (`author.is_bot` or login starting with
   `app/`; `include_bots: true` keeps them), drafts (`isDraft: true`) and PRs carrying an `exclude_labels` label. Each
   exclusion is counted.
2. Window `--since YYYY-MM-DD` / `--until YYYY-MM-DD`, inclusive, UTC. Default: unbounded, reported as the min/max
   observed dates.
3. **Closed population:** PRs whose `closedAt` (or `mergedAt` when `closedAt` is missing) falls in the window.
   **Merged population:** PRs with `mergedAt` in the window. Open PRs are counted, never used as outcomes.
4. Optional baseline window `--baseline-since` / `--baseline-until` with the same rules.

## 5. Metrics

Statistics: median (mean of the two middle values for even n); p75/p90 by nearest rank (`ceil(p·n)`-th smallest).
Hours and lines rounded to 2 decimals, ratios to 4.

| id                                        | status                    | population                                      | definition                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acceptance_rate`                         | verified_static_fact      | closed                                          | merged ÷ closed                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `cycle_time_hours`                        | verified_static_fact      | merged                                          | `mergedAt − createdAt`; median/p75/p90. Negative durations excluded (`inconsistent-timestamps`).                                                                                                                                                                                                                                                                                                                                       |
| `time_to_first_review_hours`              | verified_static_fact      | merged with ≥1 non-author review                | `createdAt` → earliest `submittedAt` of a review by someone other than the PR author, state ≠ `PENDING`                                                                                                                                                                                                                                                                                                                                |
| `unreviewed_merge_rate`                   | verified_static_fact      | merged                                          | merged PRs with no non-author review ÷ merged                                                                                                                                                                                                                                                                                                                                                                                          |
| `changes_requested_rate`                  | hypothesis (rework proxy) | merged                                          | PRs with ≥1 `CHANGES_REQUESTED` review ÷ merged                                                                                                                                                                                                                                                                                                                                                                                        |
| `post_review_commit_rate`                 | hypothesis (rework proxy) | merged with ≥1 non-author review                | PRs with a commit `committedDate` later than the first non-author review ÷ that population                                                                                                                                                                                                                                                                                                                                             |
| `ci_first_pass_rate`                      | verified_static_fact      | merged PRs with ≥1 counted run on their commits | Runs are linked by `headSha` ∈ PR commit `oid`s. Runs with attempt 1 and conclusion `cancelled`, `skipped`, `neutral` or `stale` are ignored. The **first tested commit** is the earliest PR commit (by `committedDate`) with a counted run. The PR passes when every counted run on that commit has `attempt = 1` and `conclusion = success`. A run with `attempt > 1` counts as not first-pass (gh reports only the latest attempt). |
| `revert_rate`                             | hypothesis                | merged, excluding reverts                       | PRs whose exact title `T` is reverted by a PR titled `Revert "T"` merged later, anywhere in the export ÷ merged non-revert PRs                                                                                                                                                                                                                                                                                                         |
| `pr_size_lines`                           | verified_static_fact      | merged                                          | `additions + deletions`; median/p75/p90 (context, not an outcome)                                                                                                                                                                                                                                                                                                                                                                      |
| `ai_cost` (separate block, not segmented) | as recorded               | merged AI-assisted PRs with a recorded cost     | per currency: total ÷ PRs with cost; coverage = PRs with cost ÷ merged AI-assisted PRs                                                                                                                                                                                                                                                                                                                                                 |

Each metric is reported for segments `all`, `ai_assisted`, `not_ai_assisted` and `unknown_attribution`, and for the
baseline (`all` only). A **segment or baseline** value with `n < min_sample` (default 20) is withheld:
`value: null`, `unavailable_reason: "insufficient-sample"`. The `all` segment is always shown and flagged
`small_sample: true` below `min_sample`.

**Attribution precedence:** attribution file > label rule > trailer rule. Labels may map to `true` or `false`.
Trailers (a commit message line starting with a configured prefix, case-insensitive) can only set `true`. A
file/label disagreement is counted as `attribution-conflict`.

## 6. Outputs, commands and exit codes

```
outcome-check report --prs <file> [--runs <file>] [--attribution <file>] [--since D] [--until D]
                     [--baseline-since D] [--baseline-until D] [--min-sample N] [--audit]
                     [--format markdown|json|html] [--output <file>] [--config <file>] [--quiet]
outcome-check metrics   print metric definitions
outcome-check schema    print the JSON Schema
```

- JSON (`schema/outcome-check-report.schema.json`, `schema_version` "1.0"), Markdown, and a self-contained static
  HTML page (inline CSS, no JavaScript, no external requests).
- `--audit` adds, per metric and segment, the PR numbers in numerator and denominator (numbers only) so every value
  can be checked by hand.
- Exit codes: 0 ok · 1 internal error · 2 usage/config error · 3 input error (unreadable or malformed input file).
  There is no policy/threshold mode in alpha (to avoid turning outcome metrics into targets).
- Determinism: identical inputs give identical output except `run_metadata.generated_at`/`duration_ms`.

## 7. Configuration (`.outcome-check.json`, data only, unknown keys rejected)

`attribution.labels` (label → `true`/`false`), `attribution.commit_trailers` (prefix strings), `exclude_labels`,
`include_bots` (default false), `min_sample` (default 20, 1–10,000).

## 8. Acceptance scenarios (hand-computed; `test/acceptance/expected/`)

| #   | Fixture                                                                           | Expected                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O1  | 12 synthetic PRs, 9 runs, attribution CSV, window 2026-09                         | every `all` metric equals the hand-computed value (acceptance 5/7; cycle median 10 h; first review median 3 h; CI first pass 3/5; revert 1/4; size median 120; cost 2.50 USD over 2 of 3 AI PRs) |
| O2  | O1 with `--min-sample 1`                                                          | segment values for `ai_assisted` (3 merged), `not_ai_assisted` (1), `unknown_attribution` (1)                                                                                                    |
| O3  | O1 with default `min_sample` 20                                                   | all segments and the baseline withheld (`insufficient-sample`); `all.small_sample = true`                                                                                                        |
| O4  | baseline window 2026-08                                                           | baseline acceptance 1/1, cycle 120 h (with `--min-sample 1`)                                                                                                                                     |
| O5  | PR export without `reviews`/`commits`, no runs, exactly 30 records                | review, rework, CI metrics `unknown` with reasons; `possible-truncated-export`                                                                                                                   |
| O6  | malformed records, duplicates, negative durations, HTML in titles, non-array file | exclusions counted; no title/login/email in any output; HTML escaped; non-array input → exit 3                                                                                                   |
| O7  | any                                                                               | JSON validates against the schema; deterministic; `--audit` numbers reproduce every ratio                                                                                                        |

## 9. Non-goals

Live API collection, dashboards or a hosted service, developer ranking or per-person metrics, causal attribution,
ROI or labor-cost estimates, OpenTelemetry ingestion (all relevant `gen_ai.*` attributes are Development stability;
planned as a later opt-in), threshold gating.

## 10. Misuse cases

- **Surveillance:** no identity fields in output; aggregates only; `--audit` shows PR numbers, not people.
- **Gaming / Goodhart:** no thresholds or scores; the report states that these are descriptive signals.
- **Misleading comparisons:** small samples withheld; no causal language; denominators always printed.
- **Injection via exported text:** titles and logins are never rendered. All rendered strings are escaped
  (Markdown and HTML), and the HTML has no scripts.
- **Malicious input files:** size cap (100 MiB per file), record cap (200,000), strict per-record validation,
  `JSON.parse` only (no eval). CSV is parsed by a small RFC 4180 reader; nothing is executed.
