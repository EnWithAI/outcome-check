const REASONS = {
    "no-data": "no data",
    "insufficient-sample": "withheld: sample below min_sample",
    "field-not-exported": "field not in export",
    "input-not-provided": "input not provided",
};
/** Formats a number without trailing zeros. */
const num = (n) => String(n);
/** Formats one metric value as text, e.g. "71.43% (5/7)" or "median 10 h · p75 24 · p90 48 (n=5)". */
export function formatValue(metric, v) {
    if (v === null)
        return "—";
    if (v.unavailable_reason !== null) {
        const reason = REASONS[v.unavailable_reason] ?? v.unavailable_reason;
        return v.unavailable_reason === "insufficient-sample" ? `— (${reason}, n=${v.n})` : `— (${reason})`;
    }
    const flag = v.small_sample ? " ⚠ small sample" : "";
    if (metric.kind === "rate") {
        const pct = Math.round(v.value * 10000) / 100;
        return `${num(pct)}% (${v.numerator}/${v.denominator})${flag}`;
    }
    const unit = metric.unit === "hours" ? " h" : "";
    return `median ${num(v.median)}${unit} · p75 ${num(v.p75)} · p90 ${num(v.p90)} (n=${v.n})${flag}`;
}
/** Human labels for segments. */
export const SEGMENT_LABELS = {
    all: "All PRs",
    ai_assisted: "AI-assisted",
    not_ai_assisted: "Not AI-assisted",
    unknown_attribution: "Attribution unknown",
};
