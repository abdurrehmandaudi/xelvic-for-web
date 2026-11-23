import { describe, expect, it } from "vitest";
import {
  kidsCursor,
  kidsDoor,
  kidsLength,
  kidsPoster,
  kidsShelf,
  mergeNewest,
} from "./model";
import type { Drop } from "@/types/api";

function make(over: Partial<Drop> & { id: string }): Drop {
  return {
    author: { id: "u1", username: "maya", name: "Maya", avatar: null, initials: "M" },
    kind: "image",
    body: "",
    asset: null,
    created_at: "2026-01-01T00:00:00Z",
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    liked: false,
    saved: false,
    mine: false,
    ...over,
  };
}

describe("mergeNewest", () => {
  it("dedupes by id and orders newest first", () => {
    const older = make({ id: "a", created_at: "2026-01-01T00:00:00Z" });
    const newer = make({ id: "b", created_at: "2026-03-01T00:00:00Z" });
    const rows = mergeNewest([older, newer], [older]);
    expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("puts a row with no readable time after the dated ones", () => {
    const dated = make({ id: "a", created_at: "2026-01-01T00:00:00Z" });
    const undated = make({ id: "b", created_at: "" });
    expect(mergeNewest([undated, dated]).map((row) => row.id)).toEqual(["a", "b"]);
  });
});

describe("kidsCursor", () => {
  it("reads the cursor out of a next page", () => {
    expect(kidsCursor("/drops/kids/?cursor=next-12&limit=20")).toBe("next-12");
  });

  it("answers nothing when there is no next page", () => {
    expect(kidsCursor(null)).toBeUndefined();
    expect(kidsCursor("/drops/kids/")).toBeUndefined();
  });
});

describe("kidsDoor", () => {
  it("opens a vibe in the walk", () => {
    expect(kidsDoor(make({ id: "v1", kind: "vibe" }))).toBe("/drops?vibe=v1");
  });

  it("opens a drop on its own page", () => {
    expect(kidsDoor(make({ id: "d1", kind: "video" }))).toBe("/drops/d1");
  });
});

describe("kidsPoster", () => {
  it("uses a sound's cover rather than its audio", () => {
    const sound = make({
      id: "s1",
      kind: "audio",
      cover: {
        id: "c1",
        kind: "image",
        content_url: "/cover.jpg",
        thumbnail_url: "/cover-thumb.jpg",
      },
      asset: { id: "a1", kind: "audio", content_url: "/song.mp3" },
    });
    expect(kidsPoster(sound)).toBe("/cover-thumb.jpg");
  });

  it("falls back to the thumbnail of a picture", () => {
    const picture = make({
      id: "p1",
      asset: {
        id: "a2",
        kind: "image",
        content_url: "/full.jpg",
        thumbnail_url: "/thumb.jpg",
      },
    });
    expect(kidsPoster(picture)).toBe("/thumb.jpg");
  });
});

describe("kidsLength", () => {
  it("writes a measured clip as minutes and seconds", () => {
    const clip = make({
      id: "c1",
      kind: "video",
      asset: { id: "a3", kind: "video", content_url: "/clip.mp4", duration_ms: 65000 },
    });
    expect(kidsLength(clip)).toBe("1:05");
  });

  it("says nothing when no length was measured", () => {
    expect(kidsLength(make({ id: "c2" }))).toBe("");
  });
});

describe("kidsShelf", () => {
  it("maps Games to its own key and no server shelf", () => {
    expect(kidsShelf("games").api).toBeUndefined();
  });

  it("maps Cartoons to the shelf the server knows", () => {
    expect(kidsShelf("cartoons").api).toBe("cartoons");
  });
});