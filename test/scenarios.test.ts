// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Scenarios O5–O7 (docs/SPEC.md §8): missing fields and truncated exports, adversarial and malformed input,
 * privacy (no identities in any output), schema validation, determinism and audit reproducibility.
 */
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";
import { cli, copyFixture, reportJson, tempFiles } from "./helpers.js";
import type { Report } from "../src/types.js";

const schema = JSON.parse(
  readFileSync(new URL("../schema/outcome-check-report.schema.json", import.meta.url), "utf8")
);
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => void;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
function assertValid(report: unknown): void {
  if (!validate(report)) throw new Error(JSON.stringify(validate.errors, null, 2));
}

const O1 = [
  "report",
  "--prs",
  "prs.json",
  "--runs",
  "runs.json",
  "--attribution",
  "attribution.csv",
  "--config",
  "config.json",
  "--since",
  "2026-09-01",
  "--until",
  "2026-09-30",
];

/** A minimal valid gh PR record. */
function pr(n: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number: n,
    title: `PR ${n}`,
    state: "MERGED",
    isDraft: false,
    createdAt: "2026-09-01T00:00:00Z",
    closedAt: "2026-09-01T05:00:00Z",
    mergedAt: "2026-09-01T05:00:00Z",
    author: { is_bot: false, login: "zq-dev-login", id: "U_dev", name: "Dev" },
    labels: [],
    additions: 1,
    deletions: 1,
    ...extra,
  };
}

describe("O5: missing fields and truncated exports", () => {
  it("marks review, rework and CI metrics unknown with reasons and flags a 30-record export", async () => {
    const prs = Array.from({ length: 30 }, (_, i) => pr(i + 1));
    const report = await reportJson(tempFiles({ "prs.json": prs }), ["report", "--prs", "prs.json"]);
    assertValid(report);
    const byId = Object.fromEntries(report.metrics.map((m) => [m.id, m]));
    for (const id of [
      "time_to_first_review_hours",
      "unreviewed_merge_rate",
      "changes_requested_rate",
      "post_review_commit_rate",
    ]) {
      expect(byId[id]!.segments.all.unavailable_reason, id).toBe("field-not-exported");
      expect(byId[id]!.status, id).toBe("unknown");
    }
    expect(byId["ci_first_pass_rate"]!.segments.all.unavailable_reason).toBe("input-not-provided");
    expect(byId["acceptance_rate"]!.segments.all).toMatchObject({
      value: 1,
      numerator: 30,
      denominator: 30,
      small_sample: false,
    });
    expect(byId["cycle_time_hours"]!.segments.all).toMatchObject({ median: 5, n: 30 });
    const codes = report.coverage_limitations.map((l) => l.code);
    expect(codes).toEqual(
      expect.arrayContaining(["commits-not-exported", "possible-truncated-export", "reviews-not-exported"])
    );
  });

  it("flags review/commit lists at the gh cap of 100 and runs files at a round limit", async () => {
    const reviews = Array.from({ length: 100 }, (_, i) => ({
      author: { login: `r${i}` },
      state: "COMMENTED",
      submittedAt: "2026-09-01T01:00:00Z",
    }));
    const commits = Array.from({ length: 100 }, (_, i) => ({
      oid: i.toString(16).padStart(40, "a"),
      committedDate: "2026-08-31T00:00:00Z",
    }));
    const runs = Array.from({ length: 20 }, () => ({
      headSha: "f".repeat(40),
      status: "completed",
      conclusion: "success",
      attempt: 1,
    }));
    const report = await reportJson(
      tempFiles({ "prs.json": [pr(1, { reviews, commits })], "runs.json": runs }),
      ["report", "--prs", "prs.json", "--runs", "runs.json"]
    );
    const codes = report.coverage_limitations.map((l) => l.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "commits-truncated",
        "possible-truncated-runs",
        "reviews-truncated",
        "runs-not-linked",
      ])
    );
  });
});

describe("O6: adversarial and malformed input", () => {
  const evil = "<script>alert(1)</script>";
  const prs = [
    pr(1, {
      title: evil,
      author: { is_bot: false, login: "<img src=x onerror=alert(1)>", name: "Mallory Example" },
      labels: [{ name: evil }],
    }),
    pr(2, {
      createdAt: "2026-09-02T00:00:00Z",
      mergedAt: "2026-09-01T00:00:00Z",
      closedAt: "2026-09-01T00:00:00Z",
    }),
    pr(1, { title: "zq-dup-title" }),
    { ...pr(3), createdAt: undefined },
    { ...pr(4), number: "4" },
    { ...pr(5), state: "weird" },
    { ...pr(6), mergedAt: "yesterday" },
    null,
    [1, 2],
    "x",
  ];

  it("counts invalid, duplicate and inconsistent records and never renders identities or titles", async () => {
    const dir = tempFiles({ "prs.json": prs });
    const report = await reportJson(dir, ["report", "--prs", "prs.json"]);
    assertValid(report);
    expect(report.population).toMatchObject({ records: 10, invalid: 7, duplicates: 1, merged_in_window: 2 });
    expect(report.metrics.find((m) => m.id === "cycle_time_hours")!.segments.all.n).toBe(1);
    expect(report.coverage_limitations.map((l) => l.code)).toEqual(
      expect.arrayContaining(["duplicate-pr", "inconsistent-timestamps", "invalid-record"])
    );
    for (const format of ["json", "markdown", "html"]) {
      const out = (await cli(["report", "--prs", "prs.json", "--format", format, "--quiet", "--audit"], dir))
        .stdout;
      for (const secret of ["<script", "onerror", "Mallory", "img src", "zq-dup-title", "zq-dev-login"]) {
        expect(out.toLowerCase(), `${format}: ${secret}`).not.toContain(secret.toLowerCase());
      }
    }
  });

  it("HTML is self-contained: no scripts, no external URLs except the footer link, strict CSP", async () => {
    const out = (await cli([...O1, "--format", "html", "--quiet"], copyFixture("o1"))).stdout;
    expect(out).toContain("Content-Security-Policy");
    expect(out).not.toMatch(/<script|<link|<img|<iframe|@import|url\(/i);
    expect([...out.matchAll(/https?:\/\/[^"'\s<]+/g)].map((m) => m[0])).toEqual(["https://crewpe.ai"]);
  });

  it("non-array, invalid JSON, missing and oversized-structure inputs exit 3 with a message", async () => {
    const dir = tempFiles({
      "obj.json": { prs: [] },
      "bad.json": "{",
      "ok.json": [pr(1)],
      "attr.csv": "number,flag\n1,true\n",
    });
    for (const args of [
      ["report", "--prs", "obj.json"],
      ["report", "--prs", "bad.json"],
      ["report", "--prs", "missing.json"],
      ["report", "--prs", "ok.json", "--runs", "obj.json"],
      ["report", "--prs", "ok.json", "--attribution", "attr.csv"],
      ["report", "--prs", "ok.json", "--attribution", "missing.csv"],
    ]) {
      const result = await cli(args, dir);
      expect(result.code, args.join(" ")).toBe(3);
      expect(result.stderr).toContain("outcome-check: error:");
    }
  });
});

describe("O7: schema, determinism and audit", () => {
  it("O1 reports validate in every mode and are deterministic", async () => {
    const variants = [
      O1,
      [...O1, "--min-sample", "1"],
      [
        ...O1,
        "--min-sample",
        "1",
        "--baseline-since",
        "2026-08-01",
        "--baseline-until",
        "2026-08-31",
        "--audit",
      ],
    ];
    for (const args of variants) {
      const a = await reportJson(copyFixture("o1"), args);
      const b = await reportJson(copyFixture("o1"), args);
      assertValid(a);
      const strip = (r: Report): string =>
        JSON.stringify({ ...r, run_metadata: { ...r.run_metadata, duration_ms: 0 } });
      expect(strip(a)).toBe(strip(b));
    }
  });

  it("--audit lists PR numbers that reproduce every ratio; withheld values list nothing", async () => {
    const report = await reportJson(copyFixture("o1"), [...O1, "--audit"]);
    for (const m of report.metrics) {
      const all = m.segments.all;
      if (m.kind === "rate" && all.value !== null) {
        expect(all.audit_numerator!.length, m.id).toBe(all.numerator);
        expect(all.audit_denominator!.length, m.id).toBe(all.denominator);
        expect(
          all.audit_numerator!.every((n) => all.audit_denominator!.includes(n)),
          m.id
        ).toBe(true);
      }
      for (const seg of ["ai_assisted", "not_ai_assisted", "unknown_attribution"] as const) {
        const v = m.segments[seg];
        if (v.unavailable_reason !== "insufficient-sample") continue;
        expect(v.audit_numerator, `${m.id}/${seg}`).toBeUndefined();
        expect(v.audit_denominator, `${m.id}/${seg}`).toBeUndefined();
        expect(v.numerator, `${m.id}/${seg}`).toBeNull();
      }
    }
    expect(report.metrics.find((m) => m.id === "ci_first_pass_rate")!.segments.all.audit_numerator).toEqual([
      1, 3, 6,
    ]);
    expect(report.metrics.find((m) => m.id === "revert_rate")!.segments.all.audit_numerator).toEqual([5]);
  });

  it("no identities, titles, emails or commit messages from O1 appear in any format", async () => {
    const dir = copyFixture("o1");
    for (const format of ["json", "markdown", "html"]) {
      const out = (await cli([...O1, "--min-sample", "1", "--audit", "--format", format, "--quiet"], dir))
        .stdout;
      for (const s of [
        "alice",
        "bob",
        "carol",
        "Example",
        "@example.com",
        "Add CSV parser",
        "Refactor billing",
        "Add export",
        "noreply@anthropic.com",
        "dependabot",
        "Co-Authored-By",
      ]) {
        expect(out, `${format}: ${s}`).not.toContain(s);
      }
    }
  });
});
