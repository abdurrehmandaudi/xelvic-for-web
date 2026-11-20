import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/constants/storage";
import { RETRY_WINDOW_MS, claimRetry, isBrokenTree, retriedRecently } from "./recover";

const KEY = STORAGE_KEYS.renderRetry;

function fake(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    read: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    drop: (key: string) => data.delete(key),
  };
}

describe("isBrokenTree", () => {
  it("knows the dispatcher failure React 19 leaves behind", () => {
    expect(isBrokenTree(new TypeError("Cannot read properties of null (reading 'useContext')"))).toBe(
      true,
    );
    expect(isBrokenTree(new TypeError("Cannot read properties of null (reading 'useState')"))).toBe(
      true,
    );
    expect(
      isBrokenTree(new TypeError("Cannot read properties of null (reading 'useSyncExternalStore')")),
    ).toBe(true);
  });

  it("knows React's own words for it", () => {
    expect(
      isBrokenTree(new Error("Invalid hook call. Hooks can only be called inside of the body…")),
    ).toBe(true);
  });

  it("leaves an ordinary failure alone", () => {
    expect(isBrokenTree(new Error("Could not reach the server."))).toBe(false);
    expect(isBrokenTree(new TypeError("Cannot read properties of null (reading 'name')"))).toBe(
      false,
    );
    expect(isBrokenTree(new TypeError("Cannot read properties of undefined (reading 'useContext')"))).toBe(
      false,
    );
  });

  it("refuses anything that is not an error", () => {
    expect(isBrokenTree(null)).toBe(false);
    expect(isBrokenTree(undefined)).toBe(false);
    expect(isBrokenTree("Cannot read properties of null (reading 'useContext')")).toBe(false);
    expect(isBrokenTree({ message: "Cannot read properties of null (reading 'useContext')" })).toBe(
      false,
    );
  });
});

describe("claimRetry", () => {
  it("lets the first failure reload and refuses the next one", () => {
    const where = fake();
    expect(claimRetry(1_000, where)).toBe(true);
    expect(where.read(KEY)).toBe("1000");
    expect(claimRetry(1_001, where)).toBe(false);
    expect(retriedRecently(1_001, where)).toBe(true);
  });

  it("lets a later failure reload again", () => {
    const where = fake();
    expect(claimRetry(1_000, where)).toBe(true);
    expect(claimRetry(1_000 + RETRY_WINDOW_MS, where)).toBe(true);
    expect(claimRetry(1_000 + RETRY_WINDOW_MS + 1, where)).toBe(false);
  });

  it("counts a fresh window as clear", () => {
    expect(retriedRecently(60_000, fake())).toBe(false);
  });

  it("reloads when the note in storage is not a time", () => {
    expect(claimRetry(60_000, fake({ [KEY]: "yesterday" }))).toBe(true);
    expect(claimRetry(60_000, fake({ [KEY]: "" }))).toBe(true);
    expect(claimRetry(60_000, fake({ [KEY]: "0" }))).toBe(true);
  });

  it("treats a note from the future as no note at all", () => {
    expect(retriedRecently(60_000, fake({ [KEY]: "90000" }))).toBe(false);
    expect(claimRetry(60_000, fake({ [KEY]: "90000" }))).toBe(true);
  });

  it("refuses when there is nowhere to write", () => {
    expect(claimRetry(1_000, null)).toBe(false);
    expect(retriedRecently(1_000, null)).toBe(false);
  });

  it("refuses when storage will not answer", () => {
    const angry = {
      getItem: () => {
        throw new Error("Storage is off");
      },
      setItem: () => {
        throw new Error("Storage is off");
      },
    };
    expect(claimRetry(1_000, angry)).toBe(false);
    expect(retriedRecently(1_000, angry)).toBe(false);
  });

  it("refuses when storage will not take a write", () => {
    const silent = {
      getItem: () => null,
      setItem: () => {
        throw new Error("Full");
      },
    };
    expect(claimRetry(1_000, silent)).toBe(false);
  });
});
