# Changelog

All notable changes are documented here. The format follows Keep a Changelog; versions follow SemVer (pre-1.0:
minor versions may break the report schema, which carries its own `schema_version`).

## Unreleased

## 0.1.0-alpha.1 — 2026-10-10

Documentation-only release, so the npm page shows the current project information. No code or report changes.

- Maintainer and security contact: Koushik Ramani (@aiwithrk), EnWithAI Technologies; contact hello@enwithai.com.
- GitHub private vulnerability reporting enabled and documented in SECURITY.md.

## 0.1.0-alpha.0 — 2026-10-10 (published to npm)

First alpha.

- `outcome-check report|metrics|schema` with Markdown, JSON (schema 1.0) and self-contained HTML output.
- Metrics: acceptance rate, cycle time, time to first review, merged without review, changes requested (proxy),
  commits after first review (proxy), CI first-pass rate, reverted PRs (proxy), PR size; AI cost as recorded.
- Segments (all / AI-assisted / not / unknown) and an optional baseline window; small samples withheld.
- Attribution from an explicit file, labels or commit trailers only; unknown by default.
- Data-quality limitations for truncated exports, missing fields, unlinked runs, invalid records.
- `--audit` lists the PR numbers behind each value.
- Zero runtime dependencies; offline; no identities in output.
