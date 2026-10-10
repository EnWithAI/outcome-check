import { code, text } from "./escape.js";
import { formatValue, SEGMENT_LABELS } from "./format.js";
/** Renders the report as GitHub-flavoured Markdown. */
export function renderMarkdown(report, options) {
    const out = [];
    const w = report.window;
    const p = report.population;
    const a = report.attribution;
    out.push("# Outcome Check report", "");
    for (const notice of report.notices)
        out.push(`> ${text(notice)}`);
    out.push("");
    out.push(`Window: ${w.since ?? w.observed_first ?? "—"} to ${w.until ?? w.observed_last ?? "—"}` +
        (w.baseline_since ? ` · baseline ${w.baseline_since} to ${w.baseline_until}` : "") +
        ` · min_sample ${report.run_metadata.min_sample}`, "");
    out.push("| Records | Invalid | Duplicates | Bots excl. | Drafts excl. | Label excl. | Open | Closed in window | Merged in window |");
    out.push("|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    out.push(`| ${p.records} | ${p.invalid} | ${p.duplicates} | ${p.bots_excluded} | ${p.drafts_excluded} | ${p.label_excluded} | ${p.open} | ${p.closed_in_window} | ${p.merged_in_window} |`, "");
    out.push(`Attribution (${a.sources.length > 0 ? a.sources.join(", ") : "no sources configured"}): AI-assisted ${a.ai_assisted} · not AI-assisted ${a.not_ai_assisted} · unknown ${a.unknown}` +
        (a.conflicts > 0 ? ` · conflicts ${a.conflicts}` : "") +
        (a.unmatched_rows > 0 ? ` · unmatched rows ${a.unmatched_rows}` : ""), "");
    out.push("## Metrics", "");
    const hasBaseline = report.metrics.some((m) => m.baseline !== null);
    out.push(`| Metric | Status | ${Object.values(SEGMENT_LABELS).join(" | ")}${hasBaseline ? " | Baseline (all)" : ""} |`);
    out.push(`|---|---|${Object.keys(SEGMENT_LABELS)
        .map(() => "---")
        .join("|")}${hasBaseline ? "|---" : ""}|`);
    for (const m of report.metrics) {
        const cells = Object.keys(SEGMENT_LABELS).map((s) => formatValue(m, m.segments[s]));
        out.push(`| ${text(m.title)} | ${m.status === "hypothesis" ? "proxy" : m.status === "unknown" ? "unknown" : "measured"} | ${cells.join(" | ")}${hasBaseline ? ` | ${formatValue(m, m.baseline)}` : ""} |`);
    }
    out.push("");
    out.push("## AI cost (as recorded)", "");
    if (report.ai_cost.length === 0)
        out.push("No costs recorded for merged AI-assisted PRs.", "");
    for (const c of report.ai_cost)
        out.push(`- ${code(c.currency)}: total ${c.total}, ${c.per_pr} per merged AI-assisted PR with a recorded cost (${c.prs_with_cost} of ${c.ai_assisted_merged} merged AI-assisted PRs have a cost). No conversion, no labor costs.`);
    if (report.ai_cost.length > 0)
        out.push("");
    out.push("## Definitions", "");
    for (const m of report.metrics)
        out.push(`- **${text(m.title)}** (${code(m.id)}): ${text(m.definition)}`);
    out.push("");
    out.push("## Data limitations", "");
    if (report.coverage_limitations.length === 0)
        out.push("None detected.");
    for (const l of report.coverage_limitations)
        out.push(`- ${code(l.code)} (${l.count}) — ${text(l.message)}`);
    out.push("");
    out.push(`<sub>Outcome Check ${text(report.run_metadata.tool_version)} · offline · inputs: ${code(report.inputs.prs.path)}` +
        (report.inputs.runs ? `, ${code(report.inputs.runs.path)}` : "") +
        (report.inputs.attribution ? `, ${code(report.inputs.attribution.path)}` : "") +
        (options.branding
            ? " · An EnWithAI Engineering Commons tool · [crewpe.ai](https://crewpe.ai)</sub>"
            : "</sub>"), "");
    return out.join("\n");
}
