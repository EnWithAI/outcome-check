# Contributing to Outcome Check

Thanks for helping! Outcome Check aims to stay **small, deterministic and honest** about what it knows.

## Ground rules

- Every metric needs a written definition, unit, anchor and status (`hypothesis` for proxies). Prefer a data
  limitation over guessing.
- **Never add identity fields, per-person breakdowns, rankings, causal claims, invented costs or thresholds.**
- No network access, telemetry, child processes or runtime dependencies without an issue discussing it first.
- Fixtures must be **synthetic**. Never commit real exports (they contain names), secrets or personal data.
- Report schema changes must bump `schema_version` and update `schema/` and `src/types.ts` together.
- **Metric changes need hand-computed expectations first:** update `test/acceptance/expected/` (or a unit case),
  watch it fail, then implement.

## Development

```bash
npm ci --ignore-scripts
npm run check:all                     # typecheck, lint, format check, build, tests with coverage
node scripts/license-audit.mjs --all
node scripts/generate-demo-output.mjs # after changing report output; commit the updated samples
```

## Pull requests

- Keep PRs focused; include tests that assert behavior.
- Describe user-visible changes in `CHANGELOG.md` under "Unreleased".
- By contributing you agree your contribution is licensed under the MIT License.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
