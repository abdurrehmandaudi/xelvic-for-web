import { describe, expect, it } from "vitest";
import { PICK_LIMIT, pickNext, pileHolds, pileTake } from "@/features/convo/pile";

describe("a pile of convos", () => {
  it("takes a row in, and lets it out again", () => {
    expect(pickNext([], "a").picked).toEqual(["a"]);
    expect(pickNext(["a"], "b").picked).toEqual(["a", "b"]);
    expect(pickNext(["a", "b"], "a").picked).toEqual(["b"]);
  });

  it("ends the mode when the last row leaves it", () => {
    expect(pickNext(["a"], "a").empty).toBe(true);
    expect(pickNext(["a", "b"], "a").empty).toBe(false);
  });

  it("holds ten and answers the eleventh tap rather than swallowing it", () => {
    const ten = Array.from({ length: PICK_LIMIT }, (_, at) => `t${at}`);
    const step = pickNext(ten, "eleventh");
    expect(step.full).toBe(true);
    expect(step.picked).toBe(ten);
    expect(pickNext(ten, "t0").picked).toHaveLength(PICK_LIMIT - 1);
  });

  it("lets a row already in a full pile come out", () => {
    const ten = Array.from({ length: PICK_LIMIT }, (_, at) => `t${at}`);
    expect(pickNext(ten, "t5").full).toBe(false);
  });

  it("says 'all' means all the pile can hold", () => {
    const rows = ["a", "b", "c"];
    expect(pileHolds(rows, ["a", "b", "c"])).toBe(true);
    expect(pileHolds(rows, ["a", "b"])).toBe(false);
    expect(pileHolds(rows, [])).toBe(false);
    expect(pileHolds([], [])).toBe(false);
    const many = Array.from({ length: 14 }, (_, at) => `t${at}`);
    expect(pileHolds(many, pileTake(many))).toBe(true);
    expect(pileHolds(many, pileTake(many).slice(1))).toBe(false);
  });
});
