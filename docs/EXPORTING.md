# Exporting data

Outcome Check reads files; it never talks to GitHub. You choose what to export and you can inspect it first.

## Pull requests (required)

### Full history, with commits (recommended)

`gh pr list --json …,commits` cannot export more than **49 PRs**: gh asks for 100 commit authors per commit, and from
`--limit 50` GitHub rejects the query ("requesting up to 505,050 possible nodes which exceeds the maximum limit of
500,000"). Use this paginated, read-only GraphQL query instead. It fetches 50 PRs per request, asks only for the fields
Outcome Check reads (about 15,000 possible nodes per page), and prints the records in the same shape as
`gh pr list --json`, one per line (JSON Lines). It needs only `gh`, no `jq`.

```bash
gh api graphql --paginate -F owner=OWNER -F name=REPO -f query='
  query($owner: String!, $name: String!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 50, after: $endCursor, orderBy: {field: CREATED_AT, direction: DESC}) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number title state isDraft createdAt closedAt mergedAt additions deletions
          author { __typename login }
          labels(first: 100) { nodes { name } }
          reviews(first: 100) { nodes { author { login } state submittedAt } }
          commits(first: 100) { nodes { commit { oid committedDate messageHeadline messageBody } } }
        }
      }
    }
  }' --jq '.data.repository.pullRequests.nodes[] | {number, title, state, isDraft, createdAt, closedAt, mergedAt,
    additions, deletions, labels: .labels.nodes, reviews: .reviews.nodes, commits: [.commits.nodes[].commit],
    author: (if .author == null then null elif .author.__typename == "Bot"
      then {is_bot: true, login: ("app/" + .author.login)} else {is_bot: false, login: .author.login} end)}' > prs.jsonl
```

Then pass the file as usual: `outcome-check report --prs prs.jsonl`. `--prs` and `--runs` accept a JSON array or JSON
Lines (one JSON object per non-blank line); a file that is one JSON value must be an array.

- Verified on 2026-10-28 with gh 2.102.0 against `cli/go-gh` (223 PRs, all exported) and `sindresorhus/execa` (750
  PRs, 1,596 commits, about 80 s). For the newest 30 PRs of `cli/go-gh`, every field Outcome Check reads (including bot
  authors) was identical to `gh pr list --json`.
- It is read-only and runs one request per 50 PRs against your GraphQL rate limit (5,000 points per hour); each page
  costs a few points. If a large repository times out, lower `first: 50`.
- Bots are mapped to `{"is_bot": true, "login": "app/<name>"}`, as gh does. The records leave out fields Outcome Check
  never reads (ids, emails, commit authors).
- An empty repository writes an empty file, which is rejected; a repository with exactly one PR writes one object,
  which is also rejected. Wrap it in `[` `]` in that case.

### Without commits (quick, but CI and post-review metrics are lost)

```bash
gh pr list --repo OWNER/REPO --state all --limit 1000 \
  --json number,title,state,isDraft,createdAt,closedAt,mergedAt,author,labels,additions,deletions,reviews > prs.json
```

Leaving out `commits` loses exactly this:

- **CI first-pass rate** becomes `unknown` (`field-not-exported`): runs are linked to PRs through commit SHAs, so every
  run in `--runs` is counted as `runs-not-linked`.
- **Commits after first review** (rework proxy) becomes `unknown` (`field-not-exported`).
- **Commit-trailer attribution** (`attribution.commit_trailers`) cannot mark any PR as AI-assisted; only the
  attribution file and labels still work.
- The report adds the `commits-not-exported` limitation, and `commits-truncated` can no longer be detected.

Acceptance rate, cycle time, review metrics, changes requested, reverted PRs and PR size are unaffected.

### Notes for both exports

- `gh pr list --limit` defaults to **30**. An export with exactly 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 5000 or
  10000 records is flagged as `possible-truncated-export`.
- `reviews` and `commits` are capped at **100 per PR** (`reviews(first: 100)`, `commits(first: 100)`). PRs at the cap
  are flagged (`reviews-truncated`, `commits-truncated`).
- Leaving out `reviews` makes the review and rework metrics `unknown`.
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
