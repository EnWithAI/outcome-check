/**
 * Markdown reporter. Only tool-generated text and numbers are rendered (no titles or identities from the export);
 * file names are still escaped as code spans.
 */
import type { Report } from "../types.js";
/** Rendering options. */
export interface RenderOptions {
    branding: boolean;
}
/** Renders the report as GitHub-flavoured Markdown. */
export declare function renderMarkdown(report: Report, options: RenderOptions): string;
