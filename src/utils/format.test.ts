import { describe, expect, it } from "vitest";
import {
  DELETED_ACCOUNT,
  isDeletedPerson,
  mediaSize,
  personLabel,
} from "./format";

/**
 * `formatMediaSize` in `app/lib/screens/chat_media.dart`, which is what the
 * detail line under a file's name is built from. The two readings that matter
 * are the rounding — one decimal below ten, none at or above it — and the unit
 * a file lands in, because "1.2 MB" and "1184 KB" are the same number and only
 * one of them is what the phone writes.
 */
describe("mediaSize", () => {
  it("leaves bytes whole", () => {
    expect(mediaSize(0)).toBe("Unknown size");
    expect(mediaSize(1)).toBe("1 B");
    expect(mediaSize(999)).toBe("999 B");
  });

  it("gives one decimal below ten of a unit and none at or above it", () => {
    expect(mediaSize(1024)).toBe("1.0 KB");
    expect(mediaSize(1536)).toBe("1.5 KB");
    expect(mediaSize(10240)).toBe("10 KB");
    expect(mediaSize(1183744)).toBe("1.1 MB");
  });

  it("walks up a unit at a time", () => {
    expect(mediaSize(1024 ** 2)).toBe("1.0 MB");
    expect(mediaSize(1024 ** 3)).toBe("1.0 GB");
    expect(mediaSize(1024 ** 4)).toBe("1024 GB");
  });

  it("answers the unknown word rather than nothing", () => {
    expect(mediaSize(null)).toBe("Unknown size");
    expect(mediaSize(undefined)).toBe("Unknown size");
    expect(mediaSize(-5)).toBe("Unknown size");
    expect(mediaSize(Number.NaN)).toBe("Unknown size");
  });
});

describe("personLabel", () => {
  it("says the app's words for an account that has deleted itself", () => {
    expect(personLabel({ name: "Ada", username: "ada", deleted: true })).toBe(
      DELETED_ACCOUNT,
    );
    expect(isDeletedPerson({ deleted: true })).toBe(true);
    expect(isDeletedPerson({})).toBe(false);
    expect(isDeletedPerson(null)).toBe(false);
  });

  it("takes the name, then the handle, then the word the caller gave", () => {
    expect(personLabel({ name: "Ada", username: "ada" })).toBe("Ada");
    expect(personLabel({ name: "  ", username: "ada" })).toBe("ada");
    expect(personLabel({ name: "", username: "" }, "Someone")).toBe("Someone");
    expect(personLabel(null, "Someone")).toBe("Someone");
  });
});
