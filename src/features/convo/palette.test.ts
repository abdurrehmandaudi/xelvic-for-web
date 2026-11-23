import { describe, expect, it } from "vitest";
import {
  bestInk,
  contrastRatio,
  dimInk,
  mix,
  paletteOf,
  parseHex,
} from "@/features/convo/palette";

describe("a picture's colours", () => {
  it("reads a hex the two ways it is written, and refuses anything else", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("0a0b0c")).toEqual([10, 11, 12]);
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("nope")).toBeNull();
  });

  it("measures contrast the way the rule does", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("mixes towards a colour by a share", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#ffffff", "#000000", 0)).toBe("#ffffff");
  });

  it("answers the best ink a ground allows, and dimmer words that still read", () => {
    for (const ground of ["#ffffff", "#000000", "#8a2be2", "#7a7a7a", "#f5d0a9"]) {
      const ink = bestInk(ground);
      expect(contrastRatio(ink, ground)).toBeGreaterThanOrEqual(4.3);
      expect(contrastRatio(dimInk(ground, ink), ground)).toBeGreaterThanOrEqual(2.9);
    }
  });

  it("moves a ground that cannot hold a readable ink until it can", () => {
    const mid: [number, number, number] = [122, 122, 122];
    const read = paletteOf([mid, mid, mid]);
    expect(read).not.toBeNull();
    expect(contrastRatio(read!.ink, read!.ground)).toBeGreaterThanOrEqual(4.5);
  });

  it("takes the picture's most common colour as the ground", () => {
    const blue: [number, number, number] = [20, 40, 200];
    const red: [number, number, number] = [200, 30, 30];
    const read = paletteOf([blue, blue, blue, blue, red]);
    expect(read).not.toBeNull();
    expect(read!.ground).toBe("#1428c8");
    expect(contrastRatio(read!.ink, read!.ground)).toBeGreaterThanOrEqual(4.4);
    expect(read!.tones.length).toBeGreaterThan(0);
    expect(read!.accent).toBe(read!.tones[0]);
  });

  it("says nothing rather than guessing at an empty picture", () => {
    expect(paletteOf([])).toBeNull();
  });
});