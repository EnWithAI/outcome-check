# Architecture

```
cli/run.ts ── analyze.ts ─┬─ input/read.ts        (size caps, JSON arrays, per-record validation, CSV/JSON attribution)
                          ├─ metrics/metrics.ts   (catalog, statistics, first-pass, revert matching, sample rules)
                          └─ report/{json,markdown,html,format,escape}.ts
```

- **Inputs are exports, not API calls.** Users control and can inspect what is analyzed. No tokens are ever needed.
- **Identity firewall.** `input/read.ts` keeps logins/titles/messages in memory for aggregate logic only. Report types
  have no field that could carry them, and tests scan every output format for the fixture identities.
- **Definitions live next to code.** Each `MetricDef` carries its title, definition, unit, status and anchor. The
  same text is printed in reports and by `outcome-check metrics`.
- **Statistics:** median (mean of the two middle values) and nearest-rank percentiles. Decimal rounding is done on the
  decimal representation (`1.005 → 1.01`).
- **Sample-size rule** is applied in one place (`toValue`). Withheld values expose only `n`.
- **Zero runtime dependencies.** Small RFC 4180 CSV reader instead of a CSV library.
- **Deterministic:** identical inputs give identical JSON except `generated_at`/`duration_ms`. Markdown and HTML contain
  no timestamps.

## Shared contract with Impact Check and Spec Check

`status` (`verified_static_fact` / `hypothesis` / `unknown`), `coverage_limitations[]` with codes and counts,
`run_metadata` with `network: false`, `executed_code: false`, `model_usage: null`, and the same exit-code style.
Outcome Check adds `identities_in_output: false`.

## Not in alpha

OpenTelemetry GenAI ingestion: all relevant `gen_ai.*` attributes are still at Development stability (checked
2026-10-09). A future opt-in importer would map `gen_ai.usage.*_tokens` per PR via an explicit join key. Also not in
alpha: a GitHub Action (exports need a token with `pull-requests: read`, which belongs to the user's own workflow)
and threshold gating (deliberately absent).
