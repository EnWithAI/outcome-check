# Release readiness — Outcome Check 0.1.0-alpha.0

Date: 2026-10-09 · Branch `alpha/outcome-check-0.1` · **Verdict: READY FOR HUMAN REVIEW** (not published; publication
needs explicit approval).

## Verified (commands rerun on 2026-10-09, Node v25.9.0, npm 11.12.1)

| Check                   | Command                                                                   | Result                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Full gate               | `npm run check:all`                                                       | exit 0: typecheck, lint, format, build; 6 files / 33 tests passed; lines 97.71%, branches 87.63%                 |
| Acceptance O1–O4        | `npx vitest run test/acceptance`                                          | pass. Expected values were hand-computed from `docs/SPEC.md` and committed failing first (`cb9a64c`: 4 failed).  |
| Scenarios O5–O7         | `test/scenarios.test.ts`                                                  | missing fields/truncation, malformed and hostile input, schema, determinism, audit, privacy scans of all formats |
| Independent cross-check | separate Python computation over the demo data                            | acceptance 75/81, cycle median 31 h / p90 58 h, CI first pass 60/75, unreviewed 5/75; all match                  |
| Licenses                | `node scripts/license-audit.mjs` / `--all`                                | 0 production packages; dev MIT 39, BSD-3-Clause 1, Apache-2.0 1; disallowed 0                                    |
| Vulnerabilities         | `npm audit`                                                               | 0                                                                                                                |
| Package                 | `npm pack`                                                                | 36 files, 29.7 kB                                                                                                |
| Clean install + offline | tgz → empty dir → `sandbox-exec (deny network*)` HTML report on demo data | exit 0; 1 package installed; uninstall clean                                                                     |
| Quickstart              | `test/quickstart.test.ts` (built CLI)                                     | regenerated demo data identical; Markdown/JSON/HTML byte-identical to committed samples                          |
| Scale                   | 100,000 PRs + 100,000 runs (47 MB + 11 MB JSON)                           | 0.72 s, ~600 MB RSS; spot values correct                                                                         |
| Secret scan             | regex over tracked files                                                  | none                                                                                                             |

## Gate checklist

- [x] Offline, no token, no API, no runtime dependencies, no telemetry.
- [x] Every metric has a published definition, unit, anchor, status, n, numerator/denominator and exclusions.
- [x] AI attribution `unknown` by default. Trailers can only set true. Costs only as recorded, per currency.
- [x] No identities in any output (tested for JSON, Markdown and HTML, with `--audit`).
- [x] Small samples withheld without leaking numerators. Fixed non-causal notices. No thresholds or scores.
- [x] Data-quality limitations: truncated exports, capped reviews/commits, missing fields, unlinked runs, invalid
      records, duplicates, inconsistent timestamps, attribution conflicts and unmatched rows.
- [x] Docs: README with a 60-second demo, SPEC, EXPORTING, CONFIG, ARCHITECTURE, THREAT_MODEL, SECURITY,
      CONTRIBUTING, CODE_OF_CONDUCT, CHANGELOG, LICENSE (MIT), issue/PR templates, CI (actions pinned by SHA).
- [ ] CI matrix on Node 22/24/26: not executed remotely (no repository; publication gate).
- [ ] Validation on a real repository export: not done. It needs the user's own `gh` export, since the agent has no
      GitHub access.
- [ ] Trademark check for "Outcome Check": not done. `@enwithai/outcome-check` was free when checked (D-049).

## Known limitations and risks

- Linking CI runs to PRs needs the commit SHAs in the PR export. Rebased or force-pushed commits are lost
  (`runs-not-linked`).
- gh reports only each run's latest attempt, so a re-run green run counts as not first-pass.
- Revert detection only recognizes GitHub-style `Revert "<title>"` titles.
- Time to first review is measured on merged PRs only (survivorship), as documented.
- No GitHub Action and no OpenTelemetry import in alpha (both documented as later, opt-in work).

## Self-review fixes made before this report

1. Revert counted even when merged before its target → order enforced (test written first).
2. `Math.min(...array)` overflowed the call stack at ~300k timestamps → loop-based `extent()` (test first).
3. Binary float rounding (`1.005 → 1.00`) → decimal-representation rounding with an exponent-notation guard.
4. A literal BOM character in source → escaped; caught by the Trojan Source guard test.
5. Run grouping was quadratic (array spread per insert) → push.
6. Withheld small-sample values exposed their numerator and audit lists → only `n` is shown.

## Requested external actions (none taken)

Create the repository (layout to be confirmed), push, run CI, publish `@enwithai/outcome-check@0.1.0-alpha.0`.
Each needs explicit approval.
