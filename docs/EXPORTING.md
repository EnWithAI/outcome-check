# Exporting data

Outcome Check reads files; it never talks to GitHub. You choose what to export and you can inspect it first.

## Pull requests (required)

```bash
gh pr list --repo OWNER/REPO --state all --limit 1000 \
  --json number,title,state,isDraft,createdAt,closedAt,mergedAt,author,labels,additions,deletions,reviews,commits > prs.json
```

- `--limit` defaults to **30**. An export with exactly 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 5000 or 10000
  records is flagged as `possible-truncated-export`.
- `reviews` and `commits` are capped at **100 per PR** by gh (`reviews(first: 100)`, `commits(first: 100)`). PRs at
  the cap are flagged (`reviews-truncated`, `commits-truncated`).
- Leaving out `reviews` makes the review and rework metrics `unknown`. Leaving out `commits` makes CI first-pass and
  post-review commits `unknown`.
- Field shapes were verified against the gh source (`cli/cli`, `api/query_builder.go`, `api/export_pr.go`, Oct 2026).
  Bots serialize as `{"is_bot": true, "login": "app/<name>"}` and are excluded unless `include_bots` is set.

## CI runs (optional)

```bash
gh run list --repo OWNER/REPO --limit 1000 \
  --json databaseId,headSha,event,status,conclusion,attempt,createdAt,workflowName > runs.json
```

- Default `--limit` is **20**.
- Runs are linked to PRs by `headSha` ∈ the PR's commit `oid`s. Runs on rebased or force-pushed commits that are no
  longer in the PR's commit list cannot be linked (`runs-not-linked` counts every unlinked run).
- gh reports each run once, with its **latest** attempt. A run with `attempt > 1` therefore counts as not first-pass
  (re-running a green run is rare but would be counted the same way).

## Attribution (optional)

AI assistance is `unknown` unless one of these says otherwise (precedence top to bottom):

1. **Attribution file** (`--attribution`): CSV with a header, or a JSON array of objects with the same keys.

   ```csv
   pr,ai_assisted,cost,currency,tool
   101,true,2.40,USD,claude-code
   102,false,,,
   103,,,,
   ```

   `ai_assisted`: `true`, `false`, or empty/`unknown`. `cost` needs a three-letter `currency`. Costs are summed per
   currency, never converted. Invalid rows are counted (`invalid-attribution-row`). Rows for PR numbers missing from
   the export are counted (`attribution-unmatched`).

2. **Labels** (`attribution.labels` in the config), e.g. `{ "ai-assisted": true, "human-only": false }`. A PR with
   both a true and a false label stays unknown. File/label disagreements are counted (`attribution-conflict`).
3. **Commit trailers** (`attribution.commit_trailers`), e.g. `["Co-Authored-By: Claude"]`. A commit message line
   starting with the prefix (case-insensitive) marks the PR as AI-assisted. Trailers never mark a PR as _not_
   AI-assisted, because absence proves nothing.

Inspect your files before sharing reports: the report itself contains no identities, but the exports do.
