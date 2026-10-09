/**
 * CLI contract: help/version, commands, exit codes for usage and input errors, config handling, window validation
 * and output files.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, copyFixture, reportJson } from "./helpers.js";

describe("CLI contract", () => {
  it("help, version, metrics and schema", async () => {
    const dir = copyFixture("o1");
    const help = await cli(["--help"], dir);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("gh pr list --state all");
    expect((await cli(["-v"], dir)).stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect((await cli(["metrics"], dir)).stdout).toContain("ci_first_pass_rate");
    expect(JSON.parse((await cli(["schema"], dir)).stdout).title).toBe("Outcome Check report");
    const none = await cli([], dir);
    expect(none.code).toBe(2);
  });

  it("usage errors exit 2", async () => {
    const dir = copyFixture("o1");
    for (const args of [
      ["frobnicate"],
      ["report"],
      ["report", "--prs", "prs.json", "--format", "pdf"],
      ["report", "--prs", "prs.json", "--since", "2026-13-40"],
      ["report", "--prs", "prs.json", "--since", "09/01/2026"],
      ["report", "--prs", "prs.json", "--since", "2026-09-30", "--until", "2026-09-01"],
      ["report", "--prs", "prs.json", "--baseline-since", "2026-08-01"],
      ["report", "--prs", "prs.json", "--baseline-since", "2026-08-31", "--baseline-until", "2026-08-01"],
      ["report", "--prs", "prs.json", "--min-sample", "0"],
      ["report", "--prs", "prs.json", "--min-sample", "abc"],
      ["report", "--prs", "prs.json", "--bogus"],
      ["report", "--prs", "prs.json", "--config", "missing.json"],
      ["report", "--prs", "prs.json", "--output", "nope/out.md"],
      ["metrics", "extra"],
    ]) {
      const result = await cli(args, dir);
      expect(result.code, args.join(" ")).toBe(2);
      expect(result.stderr).toContain("outcome-check: error:");
    }
  });

  it("reads .outcome-check.json from the working directory; --config overrides it", async () => {
    const dir = copyFixture("o1");
    writeFileSync(
      join(dir, ".outcome-check.json"),
      JSON.stringify({ attribution: { labels: { "ai-assisted": true } }, min_sample: 1 })
    );
    const implicit = await reportJson(dir, ["report", "--prs", "prs.json"]);
    expect(implicit.run_metadata.config_source).toBe(".outcome-check.json");
    expect(implicit.run_metadata.min_sample).toBe(1);
    expect(implicit.attribution.sources).toEqual(["labels"]);
    const explicit = await reportJson(dir, ["report", "--prs", "prs.json", "--config", "config.json"]);
    expect(explicit.run_metadata.config_source).toBe("--config");
    writeFileSync(join(dir, ".outcome-check.json"), "{ nope");
    expect((await cli(["report", "--prs", "prs.json"], dir)).code).toBe(2);
  });

  it("--output writes the file; stdout stays empty; summary goes to stderr", async () => {
    const dir = copyFixture("o1");
    const result = await cli(["report", "--prs", "prs.json", "--format", "html", "--output", "r.html"], dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("PR record(s)");
    expect(readFileSync(join(dir, "r.html"), "utf8")).toContain("<!doctype html>");
    expect(existsSync(join(dir, "outcome-check-report.md"))).toBe(false);
  });

  it("unbounded window reports observed dates; --no-branding removes the footer link", async () => {
    const dir = copyFixture("o1");
    const report = await reportJson(dir, ["report", "--prs", "prs.json"]);
    expect(report.window).toMatchObject({
      since: null,
      until: null,
      observed_first: "2026-08-20",
      observed_last: "2026-10-02",
    });
    expect(report.population.closed_in_window).toBe(9);
    const md = (await cli(["report", "--prs", "prs.json", "--no-branding", "--quiet"], dir)).stdout;
    expect(md).not.toContain("crewpe.ai");
  });
});
