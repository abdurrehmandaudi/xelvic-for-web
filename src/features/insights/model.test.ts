import { describe, expect, it } from "vitest";
import { bucket, fits, niceTop, paired, readsFrom, type InsightMetric } from "./model";

const days = (values: number[], from = "2026-10-18") =>
  values.map((value, index) => {
    const at = new Date(`${from}T00:00:00Z`);
    at.setUTCDate(at.getUTCDate() + index);
    return { day: at.toISOString().slice(0, 10), value };
  });

describe("bucket", () => {
  it("hands a day series back as it came", () => {
    const series = days([1, 2, 3]);
    expect(bucket(series, "day")).toEqual(series);
  });

  it("sums a week into the Monday it starts on", () => {
    const series = days([1, 2, 3, 4, 5, 6, 7], "2026-10-19");
    expect(bucket(series, "week")).toEqual([{ day: "2026-10-19", value: 28 }]);
  });

  it("sums a month into its first, parts and all", () => {
    const series = days([1, 2, 3], "2026-10-30");
    expect(bucket(series, "month")).toEqual([
      { day: "2026-10-01", value: 3 },
      { day: "2026-11-01", value: 3 },
    ]);
  });

  it("adds back up to the total it started with", () => {
    const series = days(Array.from({ length: 30 }, (_, index) => index));
    for (const cut of ["week", "month"] as const) {
      const summed = bucket(series, cut).reduce((total, point) => total + point.value, 0);
      expect(summed).toBe(series.reduce((total, point) => total + point.value, 0));
    }
  });
});

describe("paired", () => {
  it("cuts the period before where this period is cut", () => {
    const now = days([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "2026-10-21");
    const before = days([2, 2, 2, 2, 2, 2, 2, 2, 2, 2], "2026-10-11");
    const both = paired(now, before, "week");
    expect(both.points.map((point) => point.value)).toEqual([5, 5]);
    expect(both.previous.map((point) => point.value)).toEqual([10, 10]);
    expect(both.previous).toHaveLength(both.points.length);
  });

  it("leaves a series with no comparison behind alone", () => {
    const now = days([1, 2, 3]);
    expect(paired(now, [], "week").previous).toEqual([]);
    expect(paired(now, [], "week").points).toEqual(bucket(now, "week"));
  });

  it("says nothing about a window one day long", () => {
    const one = days([5]);
    expect(paired(one, days([7]), "month")).toEqual({ points: one, previous: days([7]) });
  });
});

describe("fits", () => {
  const metric = (values: number[]) =>
    ({ points: days(values) }) as unknown as InsightMetric;

  it("wants two points at the least", () => {
    const week = Array.from({ length: 7 }, () => 1);
    const month = Array.from({ length: 30 }, () => 1);
    expect(fits(metric([1, 2, 3, 4, 5, 6, 7]), "day")).toBe(true);
    expect(fits(metric(week), "week")).toBe(true);
    expect(fits(metric(week), "month")).toBe(false);
    expect(fits(metric(month), "week")).toBe(true);
    expect(fits(metric(month), "month")).toBe(true);
  });
});

describe("niceTop", () => {
  it("rounds up to a number somebody would have picked", () => {
    expect(niceTop(0)).toBe(4);
    expect(niceTop(4)).toBe(4);
    expect(niceTop(137)).toBe(200);
    expect(niceTop(2140)).toBe(5000);
    expect(niceTop(43)).toBe(50);
  });
});

describe("readsFrom", () => {
  const payload = (series: Record<string, unknown>) => ({
    from: "2026-10-18",
    to: "2026-11-16",
    days: 30,
    series: [series],
  });

  it("reads the period before when the request asked for it", () => {
    const reads = readsFrom(
      payload({
        key: "views",
        points: [{ date: "2026-10-18", value: 3 }],
        previous_points: [{ date: "2026-09-18", value: 1 }],
      }),
    );
    expect(reads.metrics[0].previousPoints).toEqual([{ day: "2026-09-18", value: 1 }]);
  });

  it("draws nothing for a server that did not send it", () => {
    const reads = readsFrom(payload({ key: "views", points: [{ date: "2026-10-18", value: 3 }] }));
    expect(reads.metrics[0].previousPoints).toEqual([]);
  });
});
