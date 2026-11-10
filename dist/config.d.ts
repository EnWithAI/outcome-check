/** Validated configuration. See docs/CONFIG.md. */
export interface Config {
    /** Label name → AI-assisted (true) or not (false). */
    attributionLabels: Record<string, boolean>;
    /** Commit-message line prefixes that mark a PR as AI-assisted (case-insensitive). */
    commitTrailers: string[];
    excludeLabels: string[];
    includeBots: boolean;
    minSample: number;
}
/** Defaults: no attribution rules (everything unknown unless an attribution file says otherwise). */
export declare const DEFAULT_CONFIG: Config;
/** Validates a parsed JSON value and applies defaults. Exported for tests. */
export declare function validateConfig(raw: unknown): Config;
/** Reads and validates a config file. */
export declare function loadConfigFile(path: string): Config;
