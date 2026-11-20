import { describe, expect, it } from "vitest";
import { TINT_HEX, chosenTint, convoColors, type ConvoPalette } from "./skin";

const PALETTE: ConvoPalette = {
  accent: "#E31B66",
  page: "#FFFFFF",
  card: "#FFFFFF",
  line: "#E3E3EC",
  ink: "#13131A",
  dim: "#6B6B7B",
  tones: ["#0E7C8C", "#0E7A4A"],
};

describe("the colour a convo leads with", () => {
  it("leaves the theme in charge when nobody picked one", () => {
    expect(chosenTint(null)).toBeNull();
    expect(chosenTint("default")).toBeNull();
  });

  it("answers the swatch's own colour for a key somebody picked", () => {
    expect(chosenTint("cyan")).toBe(TINT_HEX.cyan);
    expect(chosenTint("magenta")).toBe(TINT_HEX.magenta);
  });

  it("falls back to the theme for a key this build has never seen", () => {
    expect(chosenTint("ultraviolet")).toBeNull();
  });
});

describe("a convo painted in a picked colour", () => {
  const picked = chosenTint("cyan") ?? "";

  it("draws my own bubble in that colour rather than the theme's run", () => {
    const colors = convoColors({ ...PALETTE, accent: picked, chatTint: picked });
    expect(colors.convoBubbleRun).toBe("none");
    expect(colors.convoBubbleWash.toLowerCase()).not.toBe(
      convoColors(PALETTE).convoBubbleWash.toLowerCase(),
    );
  });

  it("keeps somebody else's bubble the card it always was", () => {
    const colors = convoColors({ ...PALETTE, accent: picked, chatTint: picked });
    expect(colors.convoInWash).toBe(PALETTE.card);
  });
});