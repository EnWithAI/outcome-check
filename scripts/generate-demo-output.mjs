// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Regenerates the committed sample outputs in examples/demo/output/ with the built CLI. Run-specific metadata
 * (generated_at, duration_ms, node_version) is normalized so the samples are byte-reproducible.
 * Usage: npm run build && node scripts/generate-demo-output.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const demo = `${root}examples/demo`;
const bin = `${root}dist/cli/main.js`;

/** Arguments of the README demo command. */
export const DEMO_ARGS = [
  "report",
  "--prs",
  "data/prs.json",
  "--runs",
  "data/runs.json",
  "--attribution",
  "data/attribution.csv",
  "--since",
  "2026-09-01",
  "--until",
  "2026-09-30",
  "--baseline-since",
  "2026-08-01",
  "--baseline-until",
  "2026-08-31",
  "--quiet",
];

/** Normalizes run-specific metadata in a JSON report. */
export function normalizeJson(text) {
  const report = JSON.parse(text);
  report.run_metadata = {
    ...report.run_metadata,
    generated_at: "2026-01-01T00:00:00.000Z",
    duration_ms: 0,
    node_version: "normalized",
  };
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** Runs the CLI in the demo directory and returns stdout. */
function runCli(args) {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd: demo, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(`${demo}/output/outcome-check-report.md`, runCli(DEMO_ARGS));
  writeFileSync(
    `${demo}/output/outcome-check-report.json`,
    normalizeJson(runCli([...DEMO_ARGS, "--format", "json"]))
  );
  writeFileSync(`${demo}/output/outcome-check-report.html`, runCli([...DEMO_ARGS, "--format", "html"]));
  console.log("Wrote examples/demo/output/*");
}
