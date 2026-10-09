# CLAUDE.md — Outcome Check repository conventions

These conventions apply inside this repository. They never override the CrewPE Engineering Commons launch pack
(`../START_HERE.md`, `../MASTER_PROMPT.md`, `../PHASE_GATES.md`) or the user's explicit instructions.

## Commands

- Install: `npm ci --ignore-scripts`
- Full gate: `npm run check:all` (typecheck → lint → format check → build → tests with coverage ≥ 80% lines)
- Licenses: `node scripts/license-audit.mjs --all` (there are no production dependencies)
- Sample outputs: `npm run build && node scripts/generate-demo-output.mjs` (commit when report output changes)

## Scope

Offline delivery-outcome metrics from user-exported gh JSON (+ optional runs and attribution). Out of scope for alpha:
API collection, OTel ingestion, GitHub Action, thresholds/gating, per-person metrics, causal claims, ROI, telemetry.

## Invariants (tests enforce most of these)

- No network modules, `child_process`, `vm`, `eval` or dynamic `import()` in `src/` (`test/security.test.ts`).
- No runtime dependencies.
- **No identities in any output** (logins, names, emails, titles, commit messages); scenario tests scan every format.
- Every metric has a definition, unit, anchor and status; proxies are `hypothesis`. Small samples withheld.
- Output is deterministic except `generated_at`/`duration_ms`; Markdown/HTML have no timestamps.
- Fixtures and demo data are synthetic only. Metric changes start with a hand-computed failing expectation.

## Permission gates

Local commits on the work branch are fine. **Pushing, creating remotes/repos, publishing to npm, opening external
issues/PRs, or enabling third-party services requires explicit user approval for that specific action.**
