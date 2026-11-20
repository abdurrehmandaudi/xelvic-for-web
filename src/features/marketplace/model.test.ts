import { describe, expect, it } from "vitest";
import { figureOnChat } from "./model";

/**
 * The four values staff can set a figure to, and which surface each one opens.
 * `both` and `chat` stand over a composer; `profile` and `none` do not. The
 * pairs are what matter: `chat` is refused a profile and `profile` is refused a
 * convo, so a rule that admitted three of the four values would look right on
 * the shop's own figures and be wrong on every theme's.
 */
describe("whether a figure comes up over a composer", () => {
  it("let a figure meant for both places come up", () => {
    expect(figureOnChat("both")).toBe(true);
  });

  it("let a figure meant for the convo come up", () => {
    expect(figureOnChat("chat")).toBe(true);
  });

  it("refuse one staff set aside for the profile", () => {
    expect(figureOnChat("profile")).toBe(false);
  });

  it("refuse one staff turned off altogether", () => {
    expect(figureOnChat("none")).toBe(false);
  });

  it("let the app's own figure come up, since no row sets its placement", () => {
    // The bundled figure is drawn from the bundle and has no shelf row, so
    // there is nobody's `placement` for this to read.
    expect(figureOnChat(undefined)).toBe(true);
  });
});
