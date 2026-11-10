/**
 * Static HTML reporter: one self-contained page with inline CSS, no JavaScript and no external requests. Every
 * string is HTML-escaped.
 */
import type { Report } from "../types.js";
import type { RenderOptions } from "./markdown.js";
/** Renders the report as a self-contained HTML document. */
export declare function renderHtml(report: Report, options: RenderOptions): string;
