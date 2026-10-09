/**
 * Acceptance scenarios O1–O4 (docs/SPEC.md §8). Expected values in test/acceptance/expected/ were computed by hand
 * from the specification before the metrics existed (verification-first). Metric changes must update them first.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { copyFixture, reportJson } from "../helpers.js";
import type { Metric, MetricValue, Report } from "../../src/types.js";

const load = (name: string): Record<string, unknown> & { args: string[]; fixture: string } =>
  JSON.parse(readFileSync(new URL(`./expected/${name}.json`, import.meta.url), "utf8"));

/** Picks the keys present in `expected` from a metric value. */
function pick(value: MetricValue | null, expected: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(expected).map((k) => [k, (value as unknown as Record<string, unknown>)?.[k]])
  );
}

const metric = (report: Report, id: string): Metric => {
  const m = report.metrics.find((x) => x.id === id);
  if (!m) throw new Error(`metric ${id} missing`);
  return m;
};

describe("acceptance (docs/SPEC.md §8)", () => {
  it("O1: population, attribution, every `all` metric, statuses and AI cost match hand-computed values", async () => {
    const exp = load("o1-all") as ReturnType<typeof load> & {
      population: Report["population"];
      attribution: Record<string, number>;
      all: Record<string, Record<string, unknown>>;
      statuses: Record<string, string>;
      ai_cost: Report["ai_cost"];
    };
    const report = await reportJson(copyFixture(exp.fixture), exp.args);
    expect(report.population).toEqual(exp.population);
    expect(report.attribution).toMatchObject(exp.attribution);
    for (const [id, values] of Object.entries(exp.all)) {
      expect(pick(metric(report, id).segments.all, values), id).toEqual(values);
      expect(metric(report, id).status, id).toBe(exp.statuses[id]);
    }
    expect(report.ai_cost).toEqual(exp.ai_cost);
  });

  it("O3: with the default min_sample, segments are withheld and `all` is flagged small", async () => {
    const exp = load("o1-all");
    const report = await reportJson(copyFixture(exp.fixture), exp.args);
    for (const m of report.metrics) {
      expect(m.segments.all.small_sample, m.id).toBe(true);
      for (const seg of ["ai_assisted", "not_ai_assisted", "unknown_attribution"] as const) {
        expect(m.segments[seg].value, `${m.id}/${seg}`).toBeNull();
        expect(m.segments[seg].median, `${m.id}/${seg}`).toBeNull();
        expect(["insufficient-sample", "no-data"]).toContain(m.segments[seg].unavailable_reason);
      }
      expect(m.baseline).toBeNull();
    }
    expect(report.notices.join(" ")).toMatch(/not causal/i);
  });

  it("O2: with --min-sample 1, segment values match hand-computed values", async () => {
    const exp = load("o2-segments") as ReturnType<typeof load> & {
      segments: Record<string, Record<string, Record<string, unknown>>>;
    };
    const report = await reportJson(copyFixture(exp.fixture), exp.args);
    for (const [segment, metrics] of Object.entries(exp.segments)) {
      for (const [id, values] of Object.entries(metrics)) {
        const actual = metric(report, id).segments[segment as keyof Metric["segments"]];
        expect(pick(actual, values), `${segment}/${id}`).toEqual(values);
      }
    }
  });

  it("O4: baseline window values", async () => {
    const exp = load("o4-baseline") as ReturnType<typeof load> & {
      baseline: Record<string, Record<string, unknown>>;
    };
    const report = await reportJson(copyFixture(exp.fixture), exp.args);
    for (const [id, values] of Object.entries(exp.baseline)) {
      expect(pick(metric(report, id).baseline, values), id).toEqual(values);
    }
    expect(report.window.baseline_since).toBe("2026-08-01");
  });
});
