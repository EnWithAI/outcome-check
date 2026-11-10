/**
 * Error types and documented process exit codes. Every expected failure is a OutcomeCheckError carrying an exit
 * code and an optional remediation hint; anything else is treated as an internal bug (exit 1).
 */
export declare const ExitCode: {
    readonly Ok: 0;
    readonly Internal: 1;
    readonly Usage: 2;
    readonly Input: 3;
};
/** One of the documented exit codes. */
export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
/** An expected, user-facing error with a defined exit code and optional remediation hint. */
export declare class OutcomeCheckError extends Error {
    readonly exitCode: ExitCodeValue;
    readonly hint: string | undefined;
    constructor(message: string, exitCode: ExitCodeValue, hint?: string);
}
/** Creates a usage/configuration error (exit 2). */
export declare const usageError: (message: string, hint?: string) => OutcomeCheckError;
/** Creates an input error: an input file is missing, unreadable or malformed (exit 3). */
export declare const inputError: (message: string, hint?: string) => OutcomeCheckError;
