import type { Config } from "./config.js";
import type { Report } from "./types.js";
/** Options for one report. */
export interface AnalyzeOptions {
    prsPath: string;
    runsPath: string | null;
    attributionPath: string | null;
    since: string | null;
    until: string | null;
    baselineSince: string | null;
    baselineUntil: string | null;
    config: Config;
    configSource: string;
    audit: boolean;
    now?: () => Date;
}
/** Fixed statements printed in every report. */
export declare const NOTICES: string[];
/** Runs the analysis and returns a report. */
export declare function analyze(options: AnalyzeOptions): Report;
