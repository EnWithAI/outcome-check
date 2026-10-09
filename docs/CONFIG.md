# Configuration

`.outcome-check.json` in the current directory, or `--config <file>`. Data only: JSON, strictly validated, unknown
keys rejected (exit 2).

| Key                           | Default | Meaning                                                                                                                |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `attribution.labels`          | `{}`    | Label name → `true` (AI-assisted) / `false` (not AI-assisted).                                                         |
| `attribution.commit_trailers` | `[]`    | Commit-message line prefixes that mark a PR as AI-assisted (case-insensitive).                                         |
| `exclude_labels`              | `[]`    | PRs with any of these labels are excluded and counted (`label_excluded`).                                              |
| `include_bots`                | `false` | Keep bot-authored PRs (`is_bot` or `app/` logins).                                                                     |
| `min_sample`                  | `20`    | Segment and baseline values below this n are withheld; the `all` value is flagged `small_sample`. Also `--min-sample`. |

Example: [`.outcome-check.example.json`](../.outcome-check.example.json).

`min_sample` is a guard against reading noise, not a statistical test. Lowering it is useful for exploring small
teams. Withheld values never reveal their numerator, so small groups cannot be singled out.
