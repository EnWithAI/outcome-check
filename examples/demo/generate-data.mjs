/**
 * Writes a synthetic, deterministic demo dataset (gh-shaped PR and run exports plus an attribution file) to
 * examples/demo/data/. A seeded generator makes every run identical. No real repository or person is described.
 * Usage: node examples/demo/generate-data.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";

let seed = 20261009;
/** Deterministic pseudo-random number in [0, 1) (LCG). */
const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (list) => list[Math.floor(rand() * list.length)];
const iso = (ms) => new Date(ms).toISOString().replace(".000Z", "Z");
const sha = (n, k) => (n * 7919 + k * 104729).toString(16).padStart(40, "0").slice(-40);

const HOUR = 3_600_000;
const start = Date.parse("2026-08-01T08:00:00Z");
const devs = ["dev-a", "dev-b", "dev-c", "dev-d", "dev-e"];
const prs = [];
const runs = [];
const attribution = ["pr,ai_assisted,cost,currency"];
let runId = 5000;
let feature41End = 0;

for (let n = 1; n <= 160; n++) {
  const author = pick(devs);
  const ai = rand() < 0.5;
  const randomCreated = start + Math.floor(rand() * 58 * 24) * HOUR;
  // The demo revert (#77) is opened a day after Feature 41 merged.
  const created = n === 77 ? feature41End + 24 * HOUR : randomCreated;
  const roll = rand();
  const state = n === 41 || n === 77 ? "MERGED" : roll < 0.05 ? "OPEN" : roll < 0.17 ? "CLOSED" : "MERGED";
  const cycle = Math.round((ai ? 6 : 9) + rand() * (ai ? 40 : 60));
  const end = created + cycle * HOUR;
  if (n === 41) feature41End = end;
  const reviewer = pick(devs.filter((d) => d !== author));
  const reviewed = rand() < 0.9;
  const changes = rand() < (ai ? 0.3 : 0.2);
  const firstReview = created + Math.max(1, Math.round(cycle * 0.3)) * HOUR;
  const reviews =
    !reviewed || state === "OPEN"
      ? []
      : [
          ...(changes
            ? [{ author: { login: reviewer }, state: "CHANGES_REQUESTED", submittedAt: iso(firstReview) }]
            : []),
          {
            author: { login: reviewer },
            state: "APPROVED",
            submittedAt: iso(changes ? end - HOUR : firstReview),
          },
        ];
  const commits = [
    { oid: sha(n, 1), committedDate: iso(created - HOUR), messageHeadline: "change", messageBody: "" },
  ];
  if (changes)
    commits.push({
      oid: sha(n, 2),
      committedDate: iso(firstReview + HOUR),
      messageHeadline: "address review",
      messageBody: "",
    });
  const title = n === 77 ? 'Revert "Feature 41"' : `Feature ${n}`;
  prs.push({
    number: n,
    title,
    state,
    isDraft: state === "OPEN" && rand() < 0.3,
    createdAt: iso(created),
    closedAt: state === "OPEN" ? null : iso(end),
    mergedAt: state === "MERGED" ? iso(end) : null,
    author: { is_bot: false, login: author, id: `U_${author}`, name: author },
    labels: ai ? [{ name: "ai-assisted" }] : rand() < 0.6 ? [{ name: "human-only" }] : [],
    additions: Math.round(5 + rand() * 300),
    deletions: Math.round(rand() * 120),
    reviews,
    commits,
  });
  const fail = rand() < (ai ? 0.25 : 0.2);
  runs.push({
    databaseId: runId++,
    headSha: sha(n, 1),
    event: "pull_request",
    status: "completed",
    conclusion: fail ? "failure" : "success",
    attempt: 1,
    createdAt: iso(created),
    workflowName: "CI",
  });
  if (ai && rand() < 0.7) attribution.push(`${n},true,${(0.4 + rand() * 3).toFixed(2)},USD`);
}
for (let n = 161; n <= 166; n++) {
  const created = start + n * 6 * HOUR;
  prs.push({
    number: n,
    title: `Bump dependency ${n}`,
    state: "MERGED",
    isDraft: false,
    createdAt: iso(created),
    closedAt: iso(created + HOUR),
    mergedAt: iso(created + HOUR),
    author: { is_bot: true, login: "app/dependabot" },
    labels: [{ name: "dependencies" }],
    additions: 2,
    deletions: 2,
    reviews: [],
    commits: [],
  });
}

const out = new URL("./data/", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL("prs.json", out), `${JSON.stringify(prs, null, 2)}\n`);
writeFileSync(new URL("runs.json", out), `${JSON.stringify(runs, null, 2)}\n`);
writeFileSync(new URL("attribution.csv", out), `${attribution.join("\n")}\n`);
writeFileSync(
  new URL("../.outcome-check.json", out),
  `${JSON.stringify({ attribution: { labels: { "ai-assisted": true, "human-only": false } } }, null, 2)}\n`
);
console.log(`Wrote ${prs.length} PRs, ${runs.length} runs, ${attribution.length - 1} attribution rows`);
