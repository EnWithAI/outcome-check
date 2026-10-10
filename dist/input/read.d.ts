/** Caps that keep runs bounded. */
export declare const INPUT_LIMITS: {
    readonly maxBytes: number;
    readonly maxRecords: 200000;
};
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
export declare function readInput(path: string, label: string): ReadFile;
/** Parses a JSON array; throws an input error when the file is not a JSON array. */
export declare function parseJsonArray(text: string, label: string): unknown[];
/** Validates one gh PR record; returns null when invalid. */
export declare function toPullRequest(raw: unknown): PullRequest | null;
/** Validates one gh run record; returns null when invalid. */
export declare function toRun(raw: unknown): Run | null;
/** Minimal RFC 4180 CSV reader (quoted fields, escaped quotes, CRLF). */
export declare function parseCsv(text: string): string[][];
/** Parses the attribution file (CSV with header or JSON array). Returns rows plus the number of invalid rows. */
export declare function parseAttribution(text: string, path: string): {
    rows: AttributionRow[];
    invalid: number;
};
