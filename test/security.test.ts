// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Security invariants: no network, process or eval primitives in src/; the tool reads only the inputs and writes
 * only --output.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cli, copyFixture } from "./helpers.js";

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
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

/** Lists every file under a directory (relative paths, sorted). */
function tree(dir: string, prefix = ""): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? tree(path, `${prefix}${name}/`) : [`${prefix}${name}`];
    })
    .sort();
}

describe("security invariants", () => {
  it("source code contains no network, process or eval primitives", () => {
    const src = fileURLToPath(new URL("../src", import.meta.url));
    for (const file of sourceFiles(src)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(
        /from "node:(http|https|net|tls|dgram|http2|child_process|worker_threads|vm)"/
      );
      expect(text, file).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|\beval\(|new Function\(|\bimport\(/);
    }
  });

  it("source and tests contain no invisible or bidirectional control characters (Trojan Source)", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    for (const file of [...sourceFiles(join(root, "src")), ...sourceFiles(join(root, "test"))]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/);
    }
  });

  it("writes nothing except --output", async () => {
    const dir = copyFixture("o1");
    const before = tree(dir);
    await cli([...O1, "--quiet"], dir);
    await cli([...O1, "--format", "html", "--quiet"], dir);
    expect(tree(dir)).toEqual(before);
    await cli([...O1, "--quiet", "--output", "r.md"], dir);
    expect(tree(dir)).toEqual([...before, "r.md"].sort());
  });
});
