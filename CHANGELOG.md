# Changelog

All notable changes are documented here. The format follows Keep a Changelog; versions follow SemVer (pre-1.0:
minor versions may break the report schema, which carries its own `schema_version`).

## Unreleased

- Export guidance: `gh pr list --json …,commits` fails above 49 PRs ("exceeds the maximum limit of 500,000" nodes), so
  the documented `--limit 1000` command did not work. docs/EXPORTING.md, the README and `--help` now give a paginated,
  read-only `gh api graphql --paginate` query that exports the full history with commits in the `gh pr list --json`
  record shape (verified on 223- and 750-PR public repositories), plus a quick `gh pr list` command without `commits`
  and exactly what it loses: CI first-pass rate, commits after first review, CI run linking and commit-trailer
  attribution.
- `--prs` and `--runs` accept JSON Lines (one JSON object per non-blank line) as well as a JSON array. A file that is a
  single JSON value must still be an array. Report output is unchanged.

## 0.1.0 — 2026-10-12

First release without a pre-release suffix, so `npm install @enwithai/outcome-check` and `npx @enwithai/outcome-check` work without a
tag. No functional changes from 0.1.0-alpha.1. Still pre-1.0: the report schema and command options may change in minor
versions.

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
