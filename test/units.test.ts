/**
 * Unit tests: statistics, CSV parsing, record validation, attribution precedence and conflicts, commit trailers,
 * CI first-pass edge cases, config validation.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config.js";
import { parseAttribution, parseCsv, toPullRequest, toRun } from "../src/input/read.js";
import { extent, firstPass, median, nearestRank, round } from "../src/metrics/metrics.js";
import { reportJson, tempFiles } from "./helpers.js";

const sha = (c: string): string => c.repeat(40);

/** Minimal valid merged PR record with commits. */
function pr(n: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number: n,
    title: `PR ${n}`,
    state: "MERGED",
    isDraft: false,
    createdAt: "2026-09-01T00:00:00Z",
    closedAt: "2026-09-01T02:00:00Z",
    mergedAt: "2026-09-01T02:00:00Z",
    author: { is_bot: false, login: "a" },
    labels: [],
    additions: 1,
    deletions: 0,
    reviews: [],
    commits: [
      {
        oid: sha(String(n % 10)),
        committedDate: "2026-08-31T00:00:00Z",
        messageHeadline: "x",
        messageBody: "",
      },
    ],
    ...extra,
  };
}

describe("statistics", () => {
  it("median, nearest-rank percentiles and rounding", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(nearestRank([1, 2, 3, 4, 5], 0.75)).toBe(4);
    expect(nearestRank([1, 2, 3, 4, 5], 0.9)).toBe(5);
    expect(nearestRank([7], 0.9)).toBe(7);
    expect(nearestRank([1, 2, 3, 4], 0.75)).toBe(3);
    expect(round(2 / 3, 4)).toBe(0.6667);
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(-1.5, 0)).toBe(-2);
    expect(round(1e-7, 4)).toBe(0);
    expect(round(0, 2)).toBe(0);
  });

  it("extent handles very large arrays without spreading them into arguments", () => {
    const values = Array.from({ length: 600_000 }, (_, i) => (i * 7919) % 1_000_003);
    expect(extent(values)).toEqual({ min: 0, max: values.reduce((a, b) => (b > a ? b : a)) });
    expect(extent([])).toBeNull();
  });
});

describe("input parsing", () => {
  it("CSV: quotes, escaped quotes, CRLF, blank lines", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n\r\n1,\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["1", ""],
    ]);
  });

  it("attribution: CSV and JSON; invalid rows counted", () => {
    const csv = parseAttribution(
      "PR,AI_Assisted,cost,currency\n1,true,2.5,usd\n2,false,,\n3,maybe,,\n4,true,-1,USD\n5,true,3,\nx,true,,\n6,unknown,,\n",
      "a.csv"
    );
    expect(csv.rows).toEqual([
      { pr: 1, aiAssisted: true, cost: 2.5, currency: "USD" },
      { pr: 2, aiAssisted: false, cost: null, currency: null },
      { pr: 6, aiAssisted: null, cost: null, currency: null },
    ]);
    expect(csv.invalid).toBe(4);
    const json = parseAttribution(
      JSON.stringify([
        { pr: 7, ai_assisted: true, cost: 1, currency: "EUR" },
        { pr: 0, ai_assisted: true },
      ]),
      "a.json"
    );
    expect(json.rows).toHaveLength(1);
    expect(json.invalid).toBe(1);
  });

  it("PR and run validation", () => {
    expect(toPullRequest(pr(1))).not.toBeNull();
    expect(toPullRequest(pr(1, { state: "MERGED", mergedAt: null }))).toBeNull();
    expect(toPullRequest(pr(1, { number: 1.5 }))).toBeNull();
    expect(toPullRequest(pr(1, { author: { is_bot: false, login: "app/renovate" } }))?.isBot).toBe(true);
    expect(toPullRequest(pr(1, { reviews: undefined }))?.reviews).toBeNull();
    expect(toPullRequest(pr(1, { additions: undefined }))?.size).toBeNull();
    expect(toPullRequest(pr(1, { commits: [{ oid: "not-a-sha" }] }))?.commits).toEqual([]);
    expect(toRun({ headSha: "zz" })).toBeNull();
    expect(toRun({ headSha: sha("a"), conclusion: "SUCCESS", status: "completed" })).toMatchObject({
      attempt: 1,
      conclusion: "success",
    });
  });
});

describe("CI first pass", () => {
  const p = toPullRequest(
    pr(1, {
      commits: [
        { oid: sha("b"), committedDate: "2026-08-31T02:00:00Z" },
        { oid: sha("a"), committedDate: "2026-08-31T01:00:00Z" },
      ],
    })
  )!;
  const runs = (list: [string, string, number, string?][]) => {
    const map = new Map<string, ReturnType<typeof toRun>[]>();
    for (const [s, conclusion, attempt, status] of list) {
      map.set(s, [
        ...(map.get(s) ?? []),
        toRun({ headSha: s, conclusion, attempt, status: status ?? "completed" }),
      ]);
    }
    return map as Map<string, NonNullable<ReturnType<typeof toRun>>[]>;
  };
  it("uses the earliest tested commit by committedDate", () => {
    expect(
      firstPass(
        p,
        runs([
          [sha("a"), "failure", 1],
          [sha("b"), "success", 1],
        ])
      )
    ).toBe(false);
    expect(firstPass(p, runs([[sha("b"), "success", 1]]))).toBe(true);
  });
  it("ignores cancelled/skipped first attempts and in-progress runs; re-runs count as not first-pass", () => {
    expect(
      firstPass(
        p,
        runs([
          [sha("a"), "cancelled", 1],
          [sha("b"), "success", 1],
        ])
      )
    ).toBe(true);
    expect(firstPass(p, runs([[sha("a"), "", 1, "in_progress"]]))).toBeNull();
    expect(firstPass(p, runs([[sha("a"), "success", 2]]))).toBe(false);
    expect(
      firstPass(
        p,
        runs([
          [sha("a"), "success", 1],
          [sha("a"), "timed_out", 1],
        ])
      )
    ).toBe(false);
    expect(firstPass(p, runs([]))).toBeNull();
  });
});

describe("attribution precedence", () => {
  it("file > labels > trailers; label conflicts counted; trailers only set true", async () => {
    const prs = [
      pr(1, { labels: [{ name: "ai" }] }),
      pr(2, { labels: [{ name: "ai" }] }),
      pr(3, {
        commits: [
          {
            oid: sha("3"),
            committedDate: "2026-08-31T00:00:00Z",
            messageHeadline: "x",
            messageBody: "body\n  co-authored-by: Claude <x>",
          },
        ],
      }),
      pr(4, { labels: [{ name: "human" }] }),
      pr(5, { labels: [{ name: "ai" }, { name: "human" }] }),
      pr(6),
    ];
    const dir = tempFiles({
      "prs.json": prs,
      "attr.csv": "pr,ai_assisted\n2,false\n",
      "c.json": {
        attribution: { labels: { ai: true, human: false }, commit_trailers: ["Co-Authored-By: Claude"] },
        min_sample: 1,
      },
    });
    const report = await reportJson(dir, [
      "report",
      "--prs",
      "prs.json",
      "--attribution",
      "attr.csv",
      "--config",
      "c.json",
      "--audit",
    ]);
    expect(report.attribution).toEqual({
      sources: ["file", "labels", "commit-trailers"],
      ai_assisted: 2,
      not_ai_assisted: 2,
      unknown: 2,
      conflicts: 1,
      unmatched_rows: 0,
    });
    const acc = report.metrics.find((m) => m.id === "acceptance_rate")!;
    expect(acc.segments.ai_assisted.audit_denominator).toEqual([1, 3]);
    expect(acc.segments.not_ai_assisted.audit_denominator).toEqual([2, 4]);
    expect(acc.segments.unknown_attribution.audit_denominator).toEqual([5, 6]);
  });

  it("include_bots and exclude_labels", async () => {
    const prs = [
      pr(1, { author: { is_bot: true, login: "app/bot" } }),
      pr(2, { labels: [{ name: "dependencies" }] }),
      pr(3),
    ];
    const dir = tempFiles({
      "prs.json": prs,
      "c.json": { include_bots: true, exclude_labels: ["dependencies"] },
    });
    const report = await reportJson(dir, ["report", "--prs", "prs.json", "--config", "c.json"]);
    expect(report.population).toMatchObject({ bots_excluded: 0, label_excluded: 1, merged_in_window: 2 });
  });
});

describe("revert detection", () => {
  it("counts a revert only when it was merged after the reverted PR", async () => {
    const prs = [
      pr(1, { title: "Feature A", mergedAt: "2026-09-02T00:00:00Z", closedAt: "2026-09-02T00:00:00Z" }),
      pr(2, {
        title: 'Revert "Feature A"',
        mergedAt: "2026-09-03T00:00:00Z",
        closedAt: "2026-09-03T00:00:00Z",
      }),
      pr(3, { title: "Feature B", mergedAt: "2026-09-05T00:00:00Z", closedAt: "2026-09-05T00:00:00Z" }),
      pr(4, {
        title: 'Revert "Feature B"',
        mergedAt: "2026-09-04T00:00:00Z",
        closedAt: "2026-09-04T00:00:00Z",
      }),
      pr(5, { title: "Feature C" }),
      pr(6, {
        title: 'Revert "Feature C"',
        state: "CLOSED",
        mergedAt: null,
        closedAt: "2026-09-04T00:00:00Z",
      }),
    ];
    const report = await reportJson(tempFiles({ "prs.json": prs }), [
      "report",
      "--prs",
      "prs.json",
      "--audit",
    ]);
    const revert = report.metrics.find((m) => m.id === "revert_rate")!.segments.all;
    expect(revert.audit_numerator).toEqual([1]);
    expect(revert.audit_denominator).toEqual([1, 3, 5]);
  });
});

describe("config validation", () => {
  it("the documented example config is valid", () => {
    const example = JSON.parse(
      readFileSync(new URL("../.outcome-check.example.json", import.meta.url), "utf8")
    );
    expect(validateConfig(example).commitTrailers).toHaveLength(2);
  });

  it("accepts valid config and rejects bad values", () => {
    expect(
      validateConfig({
        attribution: { labels: { a: true }, commit_trailers: ["x"] },
        exclude_labels: ["d"],
        include_bots: false,
        min_sample: 5,
      }).minSample
    ).toBe(5);
    for (const bad of [
      [],
      { other: 1 },
      { attribution: [] },
      { attribution: { other: 1 } },
      { attribution: { labels: { a: "yes" } } },
      { attribution: { labels: [] } },
      { attribution: { commit_trailers: [""] } },
      { exclude_labels: "x" },
      { include_bots: 1 },
      { min_sample: 0 },
      { min_sample: 1.5 },
    ]) {
      expect(() => validateConfig(bad), JSON.stringify(bad)).toThrow(/Invalid config/);
    }
  });
});
