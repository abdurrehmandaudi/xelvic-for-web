import { describe, expect, it } from "vitest";
import { fromFrame, optimistic, settle } from "./felt";

describe("optimistic", () => {
  it("adds a heart and turns it on", () => {
    expect(optimistic({ likes: 3, liked: false }, true)).toEqual({ likes: 4, liked: true });
  });

  it("takes a heart back", () => {
    expect(optimistic({ likes: 3, liked: true }, false)).toEqual({ likes: 2, liked: false });
  });

  it("does not count a tap twice", () => {
    expect(optimistic({ likes: 3, liked: true }, true)).toEqual({ likes: 3, liked: true });
  });

  it("never goes below zero", () => {
    expect(optimistic({ likes: 0, liked: true }, false)).toEqual({ likes: 0, liked: false });
  });
});

describe("settle", () => {
  it("takes the server's count and state", () => {
    expect(settle({ likes: 4, liked: true }, { likes: 9, liked: false })).toEqual({
      likes: 9,
      liked: false,
    });
  });

  it("keeps what it has when the answer is partial", () => {
    expect(settle({ likes: 4, liked: true }, { likes: 9 })).toEqual({ likes: 9, liked: true });
  });
});

describe("fromFrame", () => {
  it("moves the count for anybody's heart", () => {
    expect(fromFrame({ likes: 4, liked: false }, { likes: 5, user: "other" }, "me")).toEqual({
      likes: 5,
      liked: false,
    });
  });

  it("reads liked only for my own frame", () => {
    expect(fromFrame({ likes: 4, liked: false }, { likes: 5, liked: true, user: "me" }, "me")).toEqual({
      likes: 5,
      liked: true,
    });
    expect(fromFrame({ likes: 4, liked: true }, { likes: 5, liked: false, user: "other" }, "me")).toEqual({
      likes: 5,
      liked: true,
    });
  });
});
