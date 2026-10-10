// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Test helpers: run the CLI in-process, copy fixtures into temporary directories and load reports.
 */
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../src/cli/run.js";
import type { Report } from "../src/types.js";

/** Absolute path of a fixture directory. */
export const fixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** Result of an in-process CLI run. */
export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs the CLI in-process with a fixed clock. */
export async function cli(args: string[], cwd: string): Promise<CliResult> {
  let stdout = "";
  let stderr = "";
  const code = await run(args, {
    stdout: (t) => (stdout += t),
    stderr: (t) => (stderr += t),
    cwd,
    now: () => new Date("2026-10-09T00:00:00.000Z"),
  });
  return { code, stdout, stderr };
}

/** Copies a fixture into a fresh temporary directory and returns its path. */
export function copyFixture(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), "outcome-check-"));
  cpSync(fixture(name), dir, { recursive: true });
  return dir;
}

/** Creates a temporary directory containing the given files (objects are written as JSON). */
export function tempFiles(files: Record<string, string | unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "outcome-check-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
}

/** Runs `report --format json` and parses the report. */
export async function reportJson(cwd: string, args: string[]): Promise<Report> {
  const result = await cli([...args, "--format", "json", "--quiet"], cwd);
  if (result.code !== 0) throw new Error(`report exited ${result.code}: ${result.stderr}`);
  return JSON.parse(result.stdout) as Report;
}
