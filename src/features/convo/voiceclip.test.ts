import { describe, expect, it } from "vitest";
import {
  SPEED_RING,
  boundedWaveform,
  cleanWaveform,
  danceHeights,
  idleHeights,
  nextSpeed,
  sampleHeights,
  trackProgress,
  waveCell,
} from "./voiceclip";

describe("cleanWaveform", () => {
  it("keeps real readings and drops everything else", () => {
    expect(cleanWaveform([0, 50, 100])).toEqual([0, 50, 100]);
    expect(cleanWaveform([1, Number.NaN, 2])).toEqual([1, 2]);
    expect(cleanWaveform([1, Infinity, 2])).toEqual([1, 2]);
    expect(cleanWaveform([-5, 120])).toEqual([0, 100]);
    expect(cleanWaveform([12.7])).toEqual([12]);
    expect(cleanWaveform(null)).toEqual([]);
    expect(cleanWaveform([])).toEqual([]);
  });
});

describe("boundedWaveform", () => {
  it("answers nothing for nothing", () => {
    expect(boundedWaveform([])).toEqual([]);
    expect(boundedWaveform(null)).toEqual([]);
    expect(boundedWaveform([1, 2, 3], 0)).toEqual([]);
  });

  it("draws a short reading exactly as it came", () => {
    expect(boundedWaveform([10, 90, 30])).toEqual([10, 90, 30]);
    expect(boundedWaveform([10, 90, 30])).toHaveLength(3);
  });

  it("cuts a long reading down to the limit, one peak per bar", () => {
    const long = Array.from({ length: 112 }, (_, index) => index % 101);
    const bars = boundedWaveform(long);
    expect(bars).toHaveLength(56);
    expect(bars[0]).toBe(1);
    expect(bars[55]).toBe(10);
  });

  it("holds a reading above the ceiling down to it", () => {
    expect(boundedWaveform([150, 900])).toEqual([100, 100]);
  });

  it("takes the loudest reading in a bucket, not the first or the average", () => {
    expect(boundedWaveform([0, 100, 100, 0, 20, 30, 0, 0], 2)).toEqual([100, 30]);
  });

  it("never answers more bars than it was asked for", () => {
    const long = Array.from({ length: 500 }, (_, index) => index % 101);
    expect(boundedWaveform(long, 24)).toHaveLength(24);
    expect(boundedWaveform(long, 56)).toHaveLength(56);
  });
});

describe("waveCell", () => {
  it("thins the bars as they get more numerous", () => {
    const many = waveCell(150, 56);
    expect(many.thick).toBeCloseTo(1.125, 6);
    expect(many.gap).toBeCloseTo(0.776786, 6);

    const few = waveCell(150, 24);
    expect(few.thick).toBeCloseTo(2.625, 6);
    expect(few.gap).toBeCloseTo(1.8125, 6);
  });

  it("holds the hairline and the ceiling either side", () => {
    expect(waveCell(20, 56).thick).toBe(0.8);
    expect(waveCell(600, 24).thick).toBe(4);
    expect(waveCell(600, 24, 56).thick).toBe(5);
    expect(waveCell(0, 0).thick).toBeGreaterThan(0);
  });

  it("never lets a gap grow past the phone's two points", () => {
    expect(waveCell(600, 24).gap).toBe(2);
  });
});

describe("the bars", () => {
  it("keeps the still shape's cycle while nothing plays", () => {
    expect(idleHeights(7)).toEqual([4, 6, 8, 10, 12, 14, 4]);
    expect(idleHeights(24)).toHaveLength(24);
  });

  it("reads a real reading straight off the sound", () => {
    expect(sampleHeights([0, 50, 100])).toEqual([4, 16, 28]);
  });

  it("keeps the dance inside the same band the phone draws it in", () => {
    for (const phase of [0, 1.2, 3.5, 6.2]) {
      const bars = danceHeights(24, phase);
      expect(bars).toHaveLength(24);
      for (const height of bars) {
        expect(height).toBeGreaterThanOrEqual(5);
        expect(height).toBeLessThanOrEqual(26);
      }
      expect(new Set(bars).size).toBeGreaterThan(1);
    }
  });

  it("scales to a taller box without a different shape", () => {
    expect(idleHeights(1)).toEqual([4]);
    expect(idleHeights(1, 60)).toEqual([8]);
    expect(sampleHeights([100], 60)).toEqual([56]);
  });
});

describe("nextSpeed", () => {
  it("walks the phone's own ring of speeds", () => {
    expect(SPEED_RING).toEqual([1, 1.5, 2]);
    expect(nextSpeed(1)).toBe(1.5);
    expect(nextSpeed(1.5)).toBe(2);
    expect(nextSpeed(2)).toBe(1);
  });

  it("answers the first speed for one the ring does not hold", () => {
    expect(nextSpeed(1.25)).toBe(1);
    expect(nextSpeed(0)).toBe(1);
  });
});

describe("trackProgress", () => {
  it("is the share of the sound that has played", () => {
    expect(trackProgress(30, 60)).toBe(0.5);
    expect(trackProgress(0, 60)).toBe(0);
    expect(trackProgress(60, 60)).toBe(1);
  });

  it("refuses to answer a sound with no length", () => {
    expect(trackProgress(5, 0)).toBe(0);
    expect(trackProgress(5, Number.NaN)).toBe(0);
    expect(trackProgress(90, 60)).toBe(1);
    expect(trackProgress(-4, 60)).toBe(0);
  });
});
