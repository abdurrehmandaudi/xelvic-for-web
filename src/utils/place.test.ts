/**
 * What this browser says when it will not say where it is.
 *
 * The one part of `place.ts` that can be measured without a browser and without
 * a network: which refusal comes back out. `myPlace` folds every way a position
 * can fail into four words, and which word it is happens to be the whole point —
 * `denied` is the only one a person can act on, because it is their own
 * browser's setting, so the sheet may say "allow it" for that one and must not
 * say it for a browser that simply had no idea where it was.
 *
 * Every geocoder is down in this file. A refusal never reaches one, and the case
 * that does is exactly the case where the lookup fails: a pair that no geocoder
 * can name is still a pair, and it travels with the map link that makes it
 * useful. That is why the last two cases expect `ok` from a dead geocoder rather
 * than an error.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { myPlace } from "./place";

vi.mock("axios", () => ({
  default: {
    get: () => Promise.reject(new Error("no geocoder here")),
    isCancel: () => false,
  },
}));

/** The browser this machine really has, put back after every case. */
const realNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

afterEach(() => {
  if (realNavigator) {
    Object.defineProperty(globalThis, "navigator", realNavigator);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }
});

/** How a browser answers, in the two shapes `getCurrentPosition` has. */
type Ask = (
  ok: (position: unknown) => void,
  fail: (error: { code: number }) => void,
) => void;

function asBrowser(geolocation: unknown) {
  Object.defineProperty(globalThis, "navigator", {
    value: { geolocation },
    configurable: true,
    writable: true,
  });
}

/** A browser that refuses, numbered the way the specification numbers it. */
function refusing(code: number): Ask {
  return (_ok, fail) => {
    fail({ code });
  };
}

describe("where this browser is, when it will not say", () => {
  it("answers a page with no navigator at all rather than waiting on one", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    await expect(myPlace()).resolves.toEqual({
      ok: false,
      why: "unsupported",
    });
  });

  it("answers a browser that has a navigator but no geolocation the same way", async () => {
    asBrowser(undefined);

    await expect(myPlace()).resolves.toEqual({
      ok: false,
      why: "unsupported",
    });
  });

  it("calls the browser's own refusal what it is, so the sheet may say 'allow it'", async () => {
    asBrowser({ getCurrentPosition: refusing(1) });

    await expect(myPlace()).resolves.toEqual({ ok: false, why: "denied" });
  });

  it("calls a position that took too long a timeout", async () => {
    asBrowser({ getCurrentPosition: refusing(3) });

    await expect(myPlace()).resolves.toEqual({ ok: false, why: "timeout" });
  });

  it("folds every other refusal into one word, because they read the same to a person", async () => {
    asBrowser({ getCurrentPosition: refusing(2) });
    await expect(myPlace()).resolves.toEqual({ ok: false, why: "unavailable" });

    // A code the specification does not define is the same sentence as one it
    // does: "this browser could not work out where it is."
    asBrowser({ getCurrentPosition: refusing(7) });
    await expect(myPlace()).resolves.toEqual({ ok: false, why: "unavailable" });
  });

  it("hands out a position no geocoder could name, with the browser's own accuracy", async () => {
    asBrowser({
      getCurrentPosition: (ok: (position: unknown) => void) => {
        ok({ coords: { latitude: 19.076, longitude: 72.8777, accuracy: 35 } });
      },
    });

    await expect(myPlace()).resolves.toEqual({
      ok: true,
      fix: {
        label: "19.0760, 72.8777",
        latitude: 19.076,
        longitude: 72.8777,
        accuracy: 35,
      },
    });
  });

  it("says an accuracy the browser never gave is unknown rather than zero", async () => {
    asBrowser({
      getCurrentPosition: (ok: (position: unknown) => void) => {
        ok({ coords: { latitude: 19.076, longitude: 72.8777 } });
      },
    });

    const answer = await myPlace();

    expect(answer.ok && answer.fix.accuracy).toBe(null);
  });
});
