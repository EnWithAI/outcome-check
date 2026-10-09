/**
 * Static HTML reporter: one self-contained page with inline CSS, no JavaScript and no external requests. Every
 * string is HTML-escaped.
 */
import type { Report } from "../types.js";
import { html } from "./escape.js";
import { formatValue, SEGMENT_LABELS } from "./format.js";
import type { RenderOptions } from "./markdown.js";

const CSS = `
:root{--bg:#ffffff;--fg:#1f2328;--muted:#59636e;--line:#d1d9e0;--head:#f6f8fa;--warn:#9a6700}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--line:#3d444d;--head:#151b23;--warn:#d29922}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}h1{font-size:1.6rem;margin:0 0 12px}h2{font-size:1.15rem;margin:28px 0 8px}
.notice{border-left:3px solid var(--warn);padding:4px 12px;color:var(--muted);margin:4px 0}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:var(--head)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}footer{margin-top:32px;color:var(--muted);font-size:.85rem}
a{color:inherit}`;

/** Renders the report as a self-contained HTML document. */
export function renderHtml(report: Report, options: RenderOptions): string {
  const w = report.window;
  const p = report.population;
  const a = report.attribution;
  const hasBaseline = report.metrics.some((m) => m.baseline !== null);
  const segs = Object.keys(SEGMENT_LABELS) as (keyof typeof SEGMENT_LABELS)[];
  const rows = report.metrics
    .map((m) => {
      const status = m.status === "hypothesis" ? "proxy" : m.status === "unknown" ? "unknown" : "measured";
      const cells = segs.map((s) => `<td>${html(formatValue(m, m.segments[s]))}</td>`).join("");
      return `<tr><th scope="row">${html(m.title)}</th><td>${status}</td>${cells}${hasBaseline ? `<td>${html(formatValue(m, m.baseline))}</td>` : ""}</tr>`;
    })
    .join("\n");
  const limitations = report.coverage_limitations
    .map((l) => `<li><code>${html(l.code)}</code> (${l.count}) — ${html(l.message)}</li>`)
    .join("\n");
  const costs = report.ai_cost
    .map(
      (c) =>
        `<li><code>${html(c.currency)}</code>: total ${c.total}, ${c.per_pr} per merged AI-assisted PR with a recorded cost (${c.prs_with_cost} of ${c.ai_assisted_merged}).</li>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Outcome Check report</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>Outcome Check report</h1>
${report.notices.map((n) => `<p class="notice">${html(n)}</p>`).join("\n")}
<p>Window: ${html(w.since ?? w.observed_first ?? "—")} to ${html(w.until ?? w.observed_last ?? "—")}${w.baseline_since ? ` · baseline ${html(w.baseline_since)} to ${html(w.baseline_until ?? "")}` : ""} · min_sample ${report.run_metadata.min_sample}</p>
<div class="scroll"><table>
<tr><th>Records</th><th>Invalid</th><th>Duplicates</th><th>Bots excl.</th><th>Drafts excl.</th><th>Label excl.</th><th>Open</th><th>Closed in window</th><th>Merged in window</th></tr>
<tr><td>${p.records}</td><td>${p.invalid}</td><td>${p.duplicates}</td><td>${p.bots_excluded}</td><td>${p.drafts_excluded}</td><td>${p.label_excluded}</td><td>${p.open}</td><td>${p.closed_in_window}</td><td>${p.merged_in_window}</td></tr>
</table></div>
<p>Attribution (${html(a.sources.length > 0 ? a.sources.join(", ") : "no sources configured")}): AI-assisted ${a.ai_assisted} · not AI-assisted ${a.not_ai_assisted} · unknown ${a.unknown}${a.conflicts > 0 ? ` · conflicts ${a.conflicts}` : ""}</p>
<h2>Metrics</h2>
<div class="scroll"><table>
<tr><th>Metric</th><th>Status</th>${segs.map((s) => `<th>${html(SEGMENT_LABELS[s])}</th>`).join("")}${hasBaseline ? "<th>Baseline (all)</th>" : ""}</tr>
${rows}
</table></div>
<h2>AI cost (as recorded)</h2>
${costs ? `<ul>${costs}</ul>` : "<p>No costs recorded for merged AI-assisted PRs.</p>"}
<h2>Definitions</h2>
<ul>${report.metrics.map((m) => `<li><strong>${html(m.title)}</strong> (<code>${html(m.id)}</code>): ${html(m.definition)}</li>`).join("\n")}</ul>
<h2>Data limitations</h2>
${limitations ? `<ul>${limitations}</ul>` : "<p>None detected.</p>"}
<footer>Outcome Check ${html(report.run_metadata.tool_version)} · offline${options.branding ? ' · Built by EnWithAI · Part of CrewPE Engineering Commons · <a href="https://crewpe.ai">crewpe.ai</a>' : ""}</footer>
</main>
</body>
</html>
`;
}
