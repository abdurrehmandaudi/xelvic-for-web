import { describe, expect, it } from "vitest";
import {
  focusAskFrame,
  focusLeaveFrame,
  focusSayFrame,
  GAZE_RECHECK_MS,
  GAZE_REFRESH_MS,
  GAZE_STALE_MS,
  gazeFrom,
  lookOf,
  sameLook,
  staleGazes,
  type Gaze,
} from "./looking";

describe("reading a focus frame", () => {
  it("knows the two places the app knows", () => {
    expect(lookOf("chat")).toBe("chat");
    expect(lookOf("profile")).toBe("profile");
  });

  it("answers nothing for none, for a kind it does not know, and for no kind at all", () => {
    // `none` is the server saying they are not on anything of mine, which
    // includes the case where their entry lapsed and nobody said goodbye.
    expect(lookOf("none")).toBeNull();
    // A newer server naming a third place must leave this screen quiet rather
    // than have the web invent a character for somewhere it cannot draw.
    expect(lookOf("stage")).toBeNull();
    expect(lookOf(undefined)).toBeNull();
    expect(lookOf(7)).toBeNull();
  });

  it("makes a gaze of a frame, and nothing of a frame with no place in it", () => {
    expect(gazeFrom({ user_id: "u1", kind: "chat" }, 5)).toEqual({
      look: "chat",
      at: 5,
    });
    expect(gazeFrom({ user_id: "u1", kind: "none" }, 5)).toBeNull();
    expect(gazeFrom({ user_id: "u1" }, 5)).toBeNull();
    expect(gazeFrom(null, 5)).toBeNull();
    expect(gazeFrom("chat", 5)).toBeNull();
  });

  it("counts the same place as the same fact, whenever it arrived", () => {
    const first: Gaze = { look: "chat", at: 1_000 };
    const again: Gaze = { look: "chat", at: 9_000 };
    const other: Gaze = { look: "profile", at: 1_000 };
    expect(sameLook(first, again)).toBe(true);
    expect(sameLook(first, other)).toBe(false);
  });
});

describe("a gaze that has gone quiet", () => {
  it("is believed for the whole window and not a millisecond longer", () => {
    const seen = new Map<string, Gaze>([["u1", { look: "chat", at: 0 }]]);
    expect(staleGazes(seen, GAZE_STALE_MS - 1)).toEqual([]);
    expect(staleGazes(seen, GAZE_STALE_MS)).toEqual(["u1"]);
  });

  it("is twice how often the person is asked about", () => {
    // The ratio is the point: a person genuinely sitting on the convo is
    // renewed by every poll, so it takes two missed polls in a row to reach
    // this, and by then the frame is not late, it is gone.
    expect(GAZE_STALE_MS).toBe(GAZE_RECHECK_MS * 2);
  });

  it("repeats my own word twice as often as the server would forget it", () => {
    // FOCUS_TTL_SECONDS is 30 on the server; half of it is one dropped frame
    // away from being enough.
    expect(GAZE_REFRESH_MS).toBe(15_000);
  });

  it("names every gaze that has gone quiet, and leaves the rest alone", () => {
    const seen = new Map<string, Gaze>([
      // A minute old, and a poll landed fifteen seconds ago.
      ["old", { look: "chat", at: 0 }],
      ["fresh", { look: "profile", at: 45_000 }],
      // Silent for forty seconds, which is two missed polls in a row.
      ["gone", { look: "chat", at: 20_000 }],
    ]);
    expect(staleGazes(seen, 60_000)).toEqual(["old", "gone"]);
  });

  it("has nothing to say about nobody", () => {
    expect(staleGazes(new Map(), 999_999)).toEqual([]);
  });
});

describe("the three frames this side says", () => {
  it("says where I am the way the phone says it", () => {
    expect(focusSayFrame("u2", "chat")).toEqual({
      action: "focus",
      user: "u2",
      kind: "chat",
      phase: "idle",
    });
    expect(focusSayFrame("u2", "profile")).toEqual({
      action: "focus",
      user: "u2",
      kind: "profile",
      phase: "idle",
    });
  });

  it("asks about people under the key the backend reads as an ask", () => {
    // `ChatConsumer` tells the two apart by `"users" in content`, so the list
    // is the whole of what makes this a question rather than a statement.
    expect(focusAskFrame(["u2", "u3"])).toEqual({
      action: "focus",
      users: ["u2", "u3"],
    });
  });

  it("takes a word back without naming a place", () => {
    expect(focusLeaveFrame()).toEqual({ action: "focus", kind: "none" });
  });
});
