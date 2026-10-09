/**
 * Command-line interface: argument parsing (node:util parseArgs), commands (report, metrics, schema), config
 * loading, output writing and the mapping of every error to a documented exit code.
 */
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyze } from "../analyze.js";
import { DEFAULT_CONFIG, loadConfigFile, validateConfig, type Config } from "../config.js";
import { ExitCode, OutcomeCheckError, usageError } from "../errors.js";
import { METRICS } from "../metrics/metrics.js";
import { renderHtml } from "../report/html.js";
import { renderJson } from "../report/json.js";
import { renderMarkdown } from "../report/markdown.js";
import { TOOL_VERSION } from "../version.js";

/** I/O seams for the CLI so it can run in-process in tests. */
export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd: string;
  now?: () => Date;
}

/** Text printed by `outcome-check --help`. */
export const HELP = `Outcome Check ${TOOL_VERSION} — what did the work actually deliver?

Usage:
  outcome-check report --prs <file> [options]   Compute delivery-outcome metrics from exported data
  outcome-check metrics                          Print metric definitions
  outcome-check schema                           Print the JSON Schema of the report
  outcome-check --help | --version

Export inputs yourself (Outcome Check never calls an API):
  gh pr list --state all --limit 1000 --json number,title,state,isDraft,createdAt,closedAt,mergedAt,author,labels,additions,deletions,reviews,commits > prs.json
  gh run list --limit 1000 --json databaseId,headSha,event,status,conclusion,attempt,createdAt,workflowName > runs.json

Options:
  --prs <file>               PR export (JSON array, required)
  --runs <file>              CI run export (JSON array)
  --attribution <file>       CSV (pr,ai_assisted[,cost,currency]) or JSON; AI attribution is unknown otherwise
  --since / --until <date>   Window, YYYY-MM-DD inclusive, UTC (default: all data)
  --baseline-since / --baseline-until <date>   Optional baseline window (both required)
  --min-sample <n>           Withhold segment/baseline values below n PRs (default 20)
  --audit                    Include PR numbers behind every value (numbers only)
  --format <fmt>             markdown (default), json or html
  --output <file>            Write the report to a file instead of stdout
  --config <file>            JSON config (default: .outcome-check.json in the current directory, if present)
  --quiet                    No progress messages on stderr
  -h, --help / -v, --version

Exit codes: 0 ok · 1 internal error · 2 usage/config error · 3 input error
Privacy: offline; no network, no telemetry; no names, logins, emails or titles in any output.
`;

/** Writes a report file atomically (temp file + rename); the parent directory must exist. */
function writeOutput(path: string, content: string): void {
  if (existsSync(path) && statSync(path).isDirectory())
    throw usageError(`--output points to a directory: ${path}`);
  if (!existsSync(dirname(path))) throw usageError(`Output directory does not exist: ${dirname(path)}`);
  const temp = join(dirname(path), `.outcome-check-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(temp, content, { mode: 0o644 });
  renameSync(temp, path);
}

/** Returns the bundled report JSON Schema (works from both src/ and dist/). */
export function readSchema(): string {
  return readFileSync(new URL("../../schema/outcome-check-report.schema.json", import.meta.url), "utf8");
}

/** Metric catalog as text. */
function metricsText(): string {
  return (
    METRICS.map(
      (m) =>
        `${m.id} (${m.status === "hypothesis" ? "proxy" : "measured"}, ${m.anchor} PRs)\n  ${m.definition}`
    ).join("\n\n") + "\n"
  );
}

/** Parses arguments and runs one command. */
async function main(argv: string[], io: CliIO): Promise<number> {
  const { values, positionals } = (() => {
    try {
      return parseArgs({
        args: argv,
        allowPositionals: true,
        strict: true,
        options: {
          prs: { type: "string" },
          runs: { type: "string" },
          attribution: { type: "string" },
          since: { type: "string" },
          until: { type: "string" },
          "baseline-since": { type: "string" },
          "baseline-until": { type: "string" },
          "min-sample": { type: "string" },
          audit: { type: "boolean" },
          format: { type: "string" },
          output: { type: "string" },
          config: { type: "string" },
          offline: { type: "boolean" },
          "no-branding": { type: "boolean" },
          quiet: { type: "boolean" },
          help: { type: "boolean", short: "h" },
          version: { type: "boolean", short: "v" },
        },
      });
    } catch (error) {
      throw usageError((error as Error).message, "Run `outcome-check --help` for usage.");
    }
  })();
  if (values.help) {
    io.stdout(HELP);
    return ExitCode.Ok;
  }
  if (values.version) {
    io.stdout(`${TOOL_VERSION}\n`);
    return ExitCode.Ok;
  }
  const [command, ...rest] = positionals;
  if (command === undefined) {
    io.stderr(HELP);
    return ExitCode.Usage;
  }
  if (rest.length > 0) throw usageError(`Unexpected argument: ${rest[0] as string}`);
  if (command === "schema" || command === "metrics") {
    io.stdout(command === "schema" ? readSchema() : metricsText());
    return ExitCode.Ok;
  }
  if (command !== "report")
    throw usageError(`Unknown command: ${command}`, "Commands: report, metrics, schema.");
  if (values.prs === undefined)
    throw usageError("report requires --prs <file>", "See `outcome-check --help` for the gh export command.");
  const format = values.format ?? "markdown";
  if (format !== "markdown" && format !== "json" && format !== "html")
    throw usageError(`--format must be "markdown", "json" or "html"`);

  const abs = (p: string): string => (isAbsolute(p) ? p : resolve(io.cwd, p));
  let config: Config = DEFAULT_CONFIG;
  let configSource = "defaults";
  if (values.config !== undefined) {
    config = loadConfigFile(abs(values.config));
    configSource = "--config";
  } else if (existsSync(join(io.cwd, ".outcome-check.json"))) {
    config = loadConfigFile(join(io.cwd, ".outcome-check.json"));
    configSource = ".outcome-check.json";
  }
  if (values["min-sample"] !== undefined) {
    if (!/^\d+$/.test(values["min-sample"]))
      throw usageError("--min-sample must be an integer from 1 to 10000");
    config = { ...config, minSample: validateConfig({ min_sample: Number(values["min-sample"]) }).minSample };
  }

  const report = analyze({
    prsPath: abs(values.prs),
    runsPath: values.runs === undefined ? null : abs(values.runs),
    attributionPath: values.attribution === undefined ? null : abs(values.attribution),
    since: values.since ?? null,
    until: values.until ?? null,
    baselineSince: values["baseline-since"] ?? null,
    baselineUntil: values["baseline-until"] ?? null,
    config,
    configSource,
    audit: values.audit === true,
    ...(io.now ? { now: io.now } : {}),
  });
  const options = { branding: !values["no-branding"] };
  const rendered =
    format === "json"
      ? renderJson(report)
      : format === "html"
        ? renderHtml(report, options)
        : renderMarkdown(report, options);
  if (values.output !== undefined) writeOutput(abs(values.output), rendered);
  else io.stdout(rendered);
  if (!values.quiet) {
    const p = report.population;
    io.stderr(
      `outcome-check: ${p.records} PR record(s), ${p.closed_in_window} closed and ${p.merged_in_window} merged in window, ${report.coverage_limitations.length} data limitation(s)\n`
    );
  }
  return ExitCode.Ok;
}

/** Runs the CLI and returns the process exit code. Never throws. */
export async function run(argv: string[], io: CliIO): Promise<number> {
  try {
    return await main(argv, io);
  } catch (error) {
    if (error instanceof OutcomeCheckError) {
      io.stderr(`outcome-check: error: ${error.message}\n`);
      if (error.hint) io.stderr(`outcome-check: hint: ${error.hint}\n`);
      return error.exitCode;
    }
    io.stderr(`outcome-check: internal error: ${(error as Error)?.message ?? String(error)}\n`);
    return ExitCode.Internal;
  }
}
