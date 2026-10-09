# Threat model

Assets: the people whose work is measured, the integrity of the numbers, the user's machine, and readers' trust.

| Threat                                                               | Mitigation                                                                                                                           | Test                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Surveillance / ranking of individuals                                | No identity fields in the report types; no per-person segments; withheld small groups reveal only n; `--audit` lists PR numbers only | `scenarios.test.ts` (O6, O7 privacy scans in all formats) |
| Misleading causal claims                                             | Fixed notices in every report; no deltas labelled as effects; segments withheld below `min_sample`; denominators always printed      | acceptance O3                                             |
| Goodhart / gaming                                                    | No thresholds, scores or failing exit codes for metric values                                                                        | CLI contract                                              |
| Fabricated attribution or cost                                       | Attribution unknown by default; trailers can only set true; costs only as recorded, per currency                                     | `units.test.ts`                                           |
| Truncated or partial exports read as complete                        | `possible-truncated-*`, `*-truncated`, `*-not-exported`, `runs-not-linked` limitations                                               | O5                                                        |
| Malformed or hostile input (wrong types, prototype keys, huge files) | `JSON.parse` only; per-record validation; 100 MiB / 200,000-record caps; invalid records counted                                     | O6                                                        |
| HTML/Markdown injection via titles or labels                         | Titles/labels never rendered; all rendered strings escaped; HTML has no JS and a `default-src 'none'` CSP                            | O6                                                        |
| Code execution / network                                             | No `child_process`, `vm`, `eval`, dynamic `import()` or network modules in `src/`                                                    | `security.test.ts`                                        |
| Trojan Source in this repository                                     | Test rejects bidi/invisible characters in `src/` and `test/` (it caught a literal BOM during development)                            | `security.test.ts`                                        |

Residual risks: the exports themselves contain identities, so users must handle them carefully. Proxy metrics can be
misread despite labels. Segment differences can reflect confounders that no tool can remove.
