import { describe, expect, it } from "vitest";
import { rangeHeader, totalFrom } from "@/features/media/transfer";

describe("a paused download", () => {
  it("asks for the bytes it already has, and for nothing when it has none", () => {
    expect(rangeHeader(0)).toBeNull();
    expect(rangeHeader(1536)).toBe("bytes=1536-");
  });

  it("reads the whole size out of a ranged answer", () => {
    expect(totalFrom("bytes 100-399/400", null, 100)).toBe(400);
    expect(totalFrom("bytes 0-0/8189", null, 0)).toBe(8189);
  });

  it("counts a plain answer against where it started", () => {
    expect(totalFrom(null, "400", 100)).toBe(500);
    expect(totalFrom(null, "400", 0)).toBe(400);
  });

  it("says nothing rather than guessing when the far end says nothing", () => {
    expect(totalFrom(null, null, 0)).toBeNull();
    expect(totalFrom(null, "0", 0)).toBeNull();
    expect(totalFrom(null, "not a number", 0)).toBeNull();
  });
});