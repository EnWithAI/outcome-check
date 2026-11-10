/**
 * Library entry point: programmatic analysis, renderers, config validation and the metric catalog.
 */
export { analyze, NOTICES, type AnalyzeOptions } from "./analyze.js";
export { DEFAULT_CONFIG, loadConfigFile, validateConfig, type Config } from "./config.js";
export { ExitCode, OutcomeCheckError } from "./errors.js";
export { METRICS } from "./metrics/metrics.js";
export { renderHtml } from "./report/html.js";
export { renderJson } from "./report/json.js";
export { renderMarkdown } from "./report/markdown.js";
export type * from "./types.js";
export { TOOL_VERSION } from "./version.js";
