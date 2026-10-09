/**
 * Input files: size-capped reading, JSON arrays from `gh pr list --json` / `gh run list --json`, and the attribution
 * file (CSV with a header, or JSON). Records are validated one by one; invalid records are counted, not fatal.
 * Identity fields are kept in memory only for aggregate logic and never reach the report.
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { inputError } from "../errors.js";

/** Caps that keep runs bounded. */
export const INPUT_LIMITS = { maxBytes: 100 * 1024 * 1024, maxRecords: 200_000 } as const;

/** A review as used by the metrics. */
export interface Review {
  login: string | null;
  state: string;
  submittedAt: number | null;
}

/** A commit as used by the metrics. */
export interface Commit {
  oid: string;
  committedDate: number | null;
  message: string;
}

/** A validated pull request. Times are epoch milliseconds. */
export interface PullRequest {
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  createdAt: number;
  closedAt: number | null;
  mergedAt: number | null;
  authorLogin: string | null;
  isBot: boolean;
  labels: string[];
  size: number | null;
  title: string;
  /** null when the export did not include `reviews` for this record. */
  reviews: Review[] | null;
  /** null when the export did not include `commits` for this record. */
  commits: Commit[] | null;
}

/** A validated CI run. */
export interface Run {
  headSha: string;
  status: string;
  conclusion: string;
  attempt: number;
}

/** One attribution row. */
export interface AttributionRow {
  pr: number;
  aiAssisted: boolean | null;
  cost: number | null;
  currency: string | null;
}

/** A read file: raw text hash plus parsed content. */
export interface ReadFile {
  sha256: string;
  text: string;
}

/** Reads a file with the size cap; throws an input error (exit 3) on failure. */
export function readInput(path: string, label: string): ReadFile {
  let buffer: Buffer;
  try {
    if (statSync(path).size > INPUT_LIMITS.maxBytes) throw inputError(`${label} is larger than 100 MiB: ${path}`);
    buffer = readFileSync(path);
  } catch (error) {
    if (error instanceof Error && error.name === "OutcomeCheckError") throw error;
    throw inputError(`Cannot read ${label}: ${path}`);
  }
  return { sha256: createHash("sha256").update(buffer).digest("hex"), text: buffer.toString("utf8").replace(/^﻿/, "") };
}

/** Parses a JSON array; throws an input error when the file is not a JSON array. */
export function parseJsonArray(text: string, label: string): unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw inputError(`${label} is not valid JSON: ${(error as Error).message}`);
  }
  if (!Array.isArray(value))
    throw inputError(`${label} must be a JSON array`, "Export with `gh pr list --json …` / `gh run list --json …`.");
  if (value.length > INPUT_LIMITS.maxRecords) throw inputError(`${label} has more than ${INPUT_LIMITS.maxRecords} records`);
  return value;
}

/** Parses an ISO-8601 timestamp to epoch ms, or undefined when invalid. */
function time(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "" || value === "0001-01-01T00:00:00Z") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

/** Validates one gh PR record; returns null when invalid. */
export function toPullRequest(raw: unknown): PullRequest | null {
  if (!isObject(raw)) return null;
  const number = raw.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) return null;
  const state = raw.state;
  if (state !== "OPEN" && state !== "CLOSED" && state !== "MERGED") return null;
  const createdAt = time(raw.createdAt);
  const closedAt = time(raw.closedAt);
  const mergedAt = time(raw.mergedAt);
  if (createdAt === null || createdAt === undefined || closedAt === undefined || mergedAt === undefined) return null;
  if (state === "MERGED" && mergedAt === null) return null;
  const author = isObject(raw.author) ? raw.author : null;
  const login = typeof author?.login === "string" ? author.login : null;
  const labels = Array.isArray(raw.labels)
    ? raw.labels.map((l) => (isObject(l) && typeof l.name === "string" ? l.name : null)).filter((l): l is string => l !== null)
    : [];
  const additions = typeof raw.additions === "number" ? raw.additions : null;
  const deletions = typeof raw.deletions === "number" ? raw.deletions : null;
  let reviews: Review[] | null = null;
  if (Array.isArray(raw.reviews)) {
    reviews = raw.reviews.filter(isObject).map((r) => {
      const at = time(r.submittedAt);
      return {
        login: isObject(r.author) && typeof r.author.login === "string" ? r.author.login : null,
        state: typeof r.state === "string" ? r.state : "",
        submittedAt: at === undefined ? null : at,
      };
    });
  }
  let commits: Commit[] | null = null;
  if (Array.isArray(raw.commits)) {
    commits = raw.commits.filter(isObject).flatMap((c) => {
      if (typeof c.oid !== "string" || !/^[0-9a-f]{7,64}$/i.test(c.oid)) return [];
      const at = time(c.committedDate);
      const message = [c.messageHeadline, c.messageBody].filter((m) => typeof m === "string").join("\n");
      return [{ oid: c.oid.toLowerCase(), committedDate: at === undefined ? null : at, message }];
    });
  }
  return {
    number,
    state,
    isDraft: raw.isDraft === true,
    createdAt,
    closedAt: closedAt ?? mergedAt,
    mergedAt,
    authorLogin: login,
    isBot: author?.is_bot === true || (login?.startsWith("app/") ?? false),
    labels,
    size: additions !== null && deletions !== null ? additions + deletions : null,
    title: typeof raw.title === "string" ? raw.title : "",
    reviews,
    commits,
  };
}

/** Validates one gh run record; returns null when invalid. */
export function toRun(raw: unknown): Run | null {
  if (!isObject(raw)) return null;
  if (typeof raw.headSha !== "string" || !/^[0-9a-f]{7,64}$/i.test(raw.headSha)) return null;
  const attempt = typeof raw.attempt === "number" && Number.isInteger(raw.attempt) && raw.attempt >= 1 ? raw.attempt : 1;
  return {
    headSha: raw.headSha.toLowerCase(),
    status: typeof raw.status === "string" ? raw.status.toLowerCase() : "",
    conclusion: typeof raw.conclusion === "string" ? raw.conclusion.toLowerCase() : "",
    attempt,
  };
}

/** Minimal RFC 4180 CSV reader (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Parses the attribution file (CSV with header or JSON array). Returns rows plus the number of invalid rows. */
export function parseAttribution(text: string, path: string): { rows: AttributionRow[]; invalid: number } {
  let records: Record<string, unknown>[];
  if (/\.json$/i.test(path) || text.trimStart().startsWith("[")) {
    records = parseJsonArray(text, "--attribution").filter(isObject);
  } else {
    const [header, ...body] = parseCsv(text);
    if (!header) throw inputError("--attribution CSV is empty");
    const columns = header.map((h) => h.trim().toLowerCase());
    if (!columns.includes("pr") || !columns.includes("ai_assisted"))
      throw inputError("--attribution CSV needs the columns pr and ai_assisted", "Header example: pr,ai_assisted,cost,currency");
    if (body.length > INPUT_LIMITS.maxRecords) throw inputError("--attribution has too many rows");
    records = body.map((cells) => Object.fromEntries(columns.map((c, i) => [c, (cells[i] ?? "").trim()])));
  }
  const rows: AttributionRow[] = [];
  let invalid = 0;
  for (const r of records) {
    const pr = typeof r.pr === "number" ? r.pr : /^\d+$/.test(String(r.pr ?? "")) ? Number(r.pr) : NaN;
    const flag = r.ai_assisted;
    const ai =
      flag === true || flag === "true" ? true : flag === false || flag === "false" ? false : flag === null || flag === undefined || flag === "" || flag === "unknown" ? null : undefined;
    const costRaw = r.cost;
    const cost =
      costRaw === undefined || costRaw === null || costRaw === ""
        ? null
        : typeof costRaw === "number"
          ? costRaw
          : /^\d+(\.\d+)?$/.test(String(costRaw))
            ? Number(costRaw)
            : NaN;
    const currency = typeof r.currency === "string" && /^[A-Za-z]{3}$/.test(r.currency.trim()) ? r.currency.trim().toUpperCase() : null;
    if (!Number.isInteger(pr) || pr < 1 || ai === undefined || Number.isNaN(cost) || (cost !== null && (cost < 0 || currency === null))) {
      invalid++;
      continue;
    }
    rows.push({ pr, aiAssisted: ai, cost, currency });
  }
  return { rows, invalid };
}
