import { describe, expect, it } from "vitest";
import type { FigureArt } from "@/features/marketplace/model";
import type { Gaze } from "@/features/presence/looking";
import { peekOn, peekWords } from "./peek";

const POSES: FigureArt = {
  wait: "/pose/wait",
  typing: "/pose/typing",
  bio: "/pose/bio",
};

const CHAT: Gaze = { look: "chat", at: 0 };
const PROFILE: Gaze = { look: "profile", at: 0 };

describe("which character stands over the composer", () => {
  it("stands their typing pose while they write to me", () => {
    expect(peekOn({ typing: true, gaze: null, last: null, poses: POSES })).toEqual({
      pose: "/pose/typing",
      up: true,
    });
  });

  it("stands their wait pose while they are merely on one of my places", () => {
    // The second character, and the one the owner asked for by name: nobody is
    // typing, and they are sitting on my convo doing nothing with it.
    expect(peekOn({ typing: false, gaze: CHAT, last: null, poses: POSES })).toEqual({
      pose: "/pose/wait",
      up: true,
    });
    // My profile is the other place, and it is the same picture: from this side
    // of the screen "on my convo" and "on my profile" are one fact — they are on
    // me — and the place only decides where they are, not what they look like.
    expect(peekOn({ typing: false, gaze: PROFILE, last: null, poses: POSES })).toEqual({
      pose: "/pose/wait",
      up: true,
    });
  });

  it("lets writing win over merely being there", () => {
    // Both facts true at once — they have my convo open *and* are writing in it,
    // which is the usual case — and only one picture fits on the border.
    expect(
      peekOn({ typing: true, gaze: CHAT, last: "/pose/wait", poses: POSES }),
    ).toEqual({ pose: "/pose/typing", up: true });
  });

  it("keeps the last pose and puts the figure down when neither is true", () => {
    // The pose is kept so the figure has something to be while it slides back
    // down; dropping it would have it vanish off the border rather than leave
    // through it.
    expect(
      peekOn({ typing: false, gaze: null, last: "/pose/typing", poses: POSES }),
    ).toEqual({ pose: "/pose/typing", up: false });
  });

  it("has nothing to draw at all on a first frame with nobody there", () => {
    expect(peekOn({ typing: false, gaze: null, last: null, poses: POSES })).toEqual({
      pose: null,
      up: false,
    });
  });

  it("keeps the last pose when their figure has no picture for the pose that fits", () => {
    // A shelf row can genuinely have no `wait` upload, where the phone's own
    // poses are three non-nullable strings. The fallback is the same memory the
    // quiet case uses.
    const partial: FigureArt = { wait: null, typing: "/pose/typing", bio: null };
    expect(
      peekOn({ typing: false, gaze: CHAT, last: "/pose/typing", poses: partial }),
    ).toEqual({ pose: "/pose/typing", up: true });
    expect(
      peekOn({ typing: false, gaze: CHAT, last: null, poses: partial }),
    ).toEqual({ pose: null, up: true });
  });
});

describe("the figure in words", () => {
  it("says what the picture says, for somebody who cannot see it", () => {
    expect(peekWords({ typing: true, gaze: null, name: "Jaya" })).toBe(
      "Jaya is typing...",
    );
    expect(peekWords({ typing: false, gaze: CHAT, name: "Jaya" })).toBe(
      "Jaya has this convo open",
    );
    expect(peekWords({ typing: false, gaze: PROFILE, name: "Jaya" })).toBe(
      "Jaya is looking at your profile",
    );
  });

  it("lets writing win here too", () => {
    expect(peekWords({ typing: true, gaze: CHAT, name: "Jaya" })).toBe(
      "Jaya is typing...",
    );
  });

  it("says nothing while the figure is down", () => {
    expect(peekWords({ typing: false, gaze: null, name: "Jaya" })).toBe("");
  });
});
