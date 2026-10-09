# Outcome Check

**What did the work actually deliver? Delivery-outcome metrics from data you export yourself, with every definition, denominator and sample size shown. Offline, and no per-person data.**

Outcome Check reads a `gh pr list --json` export (plus, optionally, a `gh run list --json` export and an AI-attribution file) and reports:

| Metric                                                                      | Kind               |
| --------------------------------------------------------------------------- | ------------------ |
| PR acceptance rate (merged ÷ closed)                                        | measured           |
| Cycle time, created → merged (median, p75, p90)                             | measured           |
| Time to first review by someone other than the author                       | measured           |
| Merged without review                                                       | measured           |
| Changes requested · commits after first review                              | rework **proxies** |
| CI first-pass rate (first tested commit green on the first attempt)         | measured           |
| Reverted PRs (GitHub-style `Revert "…"` titles)                             | **proxy**          |
| PR size (lines changed)                                                     | context            |
| AI cost per merged AI-assisted PR, **as recorded** in your attribution file | as recorded        |

Each value is shown for all PRs, AI-assisted, not AI-assisted and attribution-unknown PRs, and optionally for a baseline window. Groups smaller than `min_sample` (default 20) are withheld rather than extrapolated.

What it refuses to do: rank or name people, claim that AI _caused_ a difference, invent costs or ROI, or guess whether a PR was AI-assisted. Attribution is **unknown** unless your attribution file, a label or a commit trailer you configure says otherwise.

> Status: **alpha** (`0.1.0-alpha.0`, report schema 1.0). Not yet published to npm; see [Install](#install).

## 60-second demo

Requires Node.js 22, 24 or ≥ 26. No runtime dependencies. The demo data is synthetic and generated deterministically.

```bash
git clone <this repository> outcome-check && cd outcome-check
npm ci --ignore-scripts && npm run build
cd examples/demo
node ../../dist/cli/main.js report --prs data/prs.json --runs data/runs.json --attribution data/attribution.csv \
  --since 2026-09-01 --until 2026-09-30 --baseline-since 2026-08-01 --baseline-until 2026-08-31
```

The output matches [`examples/demo/output/outcome-check-report.md`](examples/demo/output/outcome-check-report.md) byte for byte (also as [JSON](examples/demo/output/outcome-check-report.json) and a self-contained [HTML page](examples/demo/output/outcome-check-report.html)). An excerpt:

```text
| Metric             | Status   | All PRs                      | AI-assisted                  | Not AI-assisted              | Attribution unknown                          |
| PR acceptance rate | measured | 92.59% (75/81)               | 91.89% (34/37)               | 96.3% (26/27)                | — (withheld: sample below min_sample, n=17)  |
| CI first-pass rate | measured | 80% (60/75)                  | 73.53% (25/34)               | 88.46% (23/26)               | — (withheld: sample below min_sample, n=15)  |
```

## Export your data

Outcome Check never calls an API. Export with the GitHub CLI (or produce the same JSON shape another way):

```bash
gh pr list --state all --limit 1000 \
  --json number,title,state,isDraft,createdAt,closedAt,mergedAt,author,labels,additions,deletions,reviews,commits > prs.json
gh run list --limit 1000 \
  --json databaseId,headSha,event,status,conclusion,attempt,createdAt,workflowName > runs.json
```

`gh` returns 30 PRs and 20 runs by default, and at most 100 reviews and 100 commits per PR. Outcome Check flags exports that look truncated. See [docs/EXPORTING.md](docs/EXPORTING.md) for details and the attribution file format (`pr,ai_assisted,cost,currency`).

## Install

Until a release is published, install from a local build:

```bash
npm ci --ignore-scripts && npm run build && npm pack
npm install --global ./enwithai-outcome-check-0.1.0-alpha.0.tgz
outcome-check --help
```

Uninstall with `npm uninstall --global @enwithai/outcome-check`.

## Usage

```bash
outcome-check report --prs prs.json [--runs runs.json] [--attribution attribution.csv] \
  [--since YYYY-MM-DD --until YYYY-MM-DD] [--baseline-since … --baseline-until …] \
  [--min-sample 20] [--audit] [--format markdown|json|html] [--output file]
outcome-check metrics    # definitions
outcome-check schema     # JSON Schema of the report
```

`--audit` adds the PR numbers behind each value, so anyone can recompute it by hand. Exit codes: 0 ok · 1 internal error · 2 usage/config error · 3 input error. There is deliberately no threshold or "fail the build" mode: these are signals for conversation, not targets. Configuration (`.outcome-check.json`): [docs/CONFIG.md](docs/CONFIG.md).

## Reading the numbers responsibly

- Segments differ in more than AI use: size, type of work, who picked it up, when. Treat differences as questions, not conclusions.
- Proxies (rework, reverts) can move for good reasons, such as more thorough review.
- The `Data limitations` section lists exclusions and gaps. Read it before the metrics.

## Privacy and security

No network access, telemetry, child processes or `eval`. Logins, names, emails, titles and commit messages are read only to compute aggregates (bot exclusion, self-review exclusion, revert matching, trailer attribution). **They never appear in any output.** Tests check this for every format. The HTML report has no JavaScript and a restrictive Content-Security-Policy. See [SECURITY.md](SECURITY.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Documentation

[Specification](docs/SPEC.md) · [Exporting data](docs/EXPORTING.md) · [Configuration](docs/CONFIG.md) · [Architecture](docs/ARCHITECTURE.md) · [Threat model](docs/THREAT_MODEL.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

## License

MIT © EnWithAI Technologies. Not affiliated with or endorsed by GitHub.

---

<sub>Built by EnWithAI · Part of CrewPE Engineering Commons · [crewpe.ai](https://crewpe.ai) · Enterprise advisory: [NetworkGain](https://networkgain.com)</sub>
