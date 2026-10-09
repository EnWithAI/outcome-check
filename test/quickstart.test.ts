/**
 * README quickstart with the built CLI as a separate process: regenerating the demo data and running the demo
 * command must reproduce the committed sample reports byte for byte (apart from normalized run metadata).
 * Skipped when dist/ has not been built.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs helper without type declarations
import { DEMO_ARGS, normalizeJson } from "../scripts/generate-demo-output.mjs";
import { tempFiles } from "./helpers.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const bin = join(root, "dist/cli/main.js");
const sample = (name: string): string => readFileSync(join(root, "examples/demo/output", name), "utf8");

describe.runIf(existsSync(bin))("README quickstart with the built CLI", () => {
  it("regenerates identical demo data and reproduces the committed reports", () => {
    const demo = tempFiles({});
    cpSync(join(root, "examples/demo/generate-data.mjs"), join(demo, "generate-data.mjs"));
    const env = { PATH: process.env["PATH"] ?? "" };
    const gen = spawnSync(process.execPath, ["generate-data.mjs"], { cwd: demo, encoding: "utf8", env });
    expect(gen.status, gen.stderr).toBe(0);
    for (const file of ["prs.json", "runs.json", "attribution.csv"]) {
      expect(readFileSync(join(demo, "data", file), "utf8"), file).toBe(
        readFileSync(join(root, "examples/demo/data", file), "utf8")
      );
    }
    const args = DEMO_ARGS as string[];
    const md = spawnSync(process.execPath, [bin, ...args], { cwd: demo, encoding: "utf8", env });
    expect(md.status, md.stderr).toBe(0);
    expect(md.stdout).toBe(sample("outcome-check-report.md"));
    const json = spawnSync(process.execPath, [bin, ...args, "--format", "json"], {
      cwd: demo,
      encoding: "utf8",
      env,
    });
    expect((normalizeJson as (t: string) => string)(json.stdout)).toBe(sample("outcome-check-report.json"));
    const html = spawnSync(process.execPath, [bin, ...args, "--format", "html"], {
      cwd: demo,
      encoding: "utf8",
      env,
    });
    expect(html.stdout).toBe(sample("outcome-check-report.html"));
  });
});
