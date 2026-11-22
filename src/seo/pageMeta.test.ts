import { describe, expect, it } from "vitest";
import type { Drop, Profile } from "@/types/api";
import {
  canonicalUrl,
  postHeadline,
  SITE_ORIGIN,
  truncate,
} from "./site";
import {
  GATE_ROBOTS,
  INDEX,
  NOINDEX,
  metaForDrop,
  metaForGate,
  metaForPrivateProfile,
  metaForProfile,
} from "./pageMeta";
import { personLd, postLd, videoLd } from "./structured";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 7,
    username: "shariq",
    name: "Shariq Daudi",
    avatar: "/media/avatars/me.jpg",
    initials: "SD",
    bio: "Building Xelvic.",
    followers_count: 12,
    posts_count: 3,
    is_private: false,
    can_view: true,
    professional: { location: "Mumbai" },
    ...overrides,
  } as Profile;
}

function drop(overrides: Partial<Drop> = {}): Drop {
  return {
    id: "d1",
    author: {
      id: 7,
      username: "shariq",
      name: "Shariq Daudi",
      avatar: "/media/avatars/me.jpg",
      initials: "SD",
      is_private: false,
    },
    kind: "image",
    body: "A quiet morning by the water\nSecond line",
    asset: {
      id: "a1",
      kind: "image",
      content_url: "/media/drops/d1.jpg",
      thumbnail_url: "/media/drops/d1-thumb.jpg",
      width: 1200,
      height: 900,
    },
    place: "Marine Drive",
    place_region: "IN-MH",
    place_latitude: 18.943,
    place_longitude: 72.823,
    tag: "#morning",
    created_at: "2026-11-20T08:00:00Z",
    likes: 4,
    comments: 2,
    shares: 1,
    ...overrides,
  } as Drop;
}

describe("canonicalUrl", () => {
  it("drops the query and the hash and has one trailing spelling", () => {
    expect(canonicalUrl("/u/shariq?utm_source=x#top")).toBe(`${SITE_ORIGIN}/u/shariq`);
    expect(canonicalUrl("/d/d1/")).toBe(`${SITE_ORIGIN}/d/d1`);
    expect(canonicalUrl("/")).toBe(`${SITE_ORIGIN}/`);
  });
});

describe("page metadata", () => {
  it("indexes a public profile and describes it as a Person", () => {
    const meta = metaForProfile(profile());
    expect(meta.robots).toBe(INDEX);
    expect(meta.type).toBe("profile");
    expect(meta.title).toContain("@shariq");
    expect(meta.description).toBe("Building Xelvic.");
    expect(meta.profileUsername).toBe("shariq");
    expect(meta.geo?.placename).toBe("Mumbai");
    expect(meta.jsonLd?.[0]?.["@type"]).toBe("Person");
  });

  it("never asks a crawler to index a private profile", () => {
    const meta = metaForPrivateProfile(profile({ is_private: true }));
    expect(meta.robots).toBe(NOINDEX);
    expect(meta.description).toContain("private");
    expect(meta.jsonLd).toBeUndefined();
  });

  it("uses the first line of a drop as its title, and its place as geo", () => {
    const meta = metaForDrop(drop(), "/d/d1");
    expect(meta.title).toContain("A quiet morning by the water");
    expect(meta.type).toBe("article");
    expect(meta.robots).toBe(INDEX);
    expect(meta.publishedTime).toBe("2026-11-20T08:00:00Z");
    expect(meta.geo?.placename).toBe("Marine Drive");
    expect(meta.geo?.region).toBe("IN-MH");
    expect(meta.geo?.latitude).toBe(18.943);
    expect(meta.geo?.longitude).toBe(72.823);
    expect(meta.jsonLd?.some((node) => node["@type"] === "SocialMediaPosting")).toBe(true);
  });

  it("treats a vibe as a video", () => {
    const meta = metaForDrop(drop({ kind: "vibe", body: "" }), "/v/d1", "vibe");
    expect(meta.type).toBe("video.other");
    expect(meta.title).toContain("A vibe by Shariq Daudi");
    expect(meta.jsonLd?.some((node) => node["@type"] === "VideoObject")).toBe(true);
  });

  it("does not index a post whose author is private", () => {
    const author = drop().author;
    const meta = metaForDrop(
      drop({ author: { ...author, is_private: true } }),
      "/d/d1",
    );
    expect(meta.robots).toBe(NOINDEX);
  });

  it("tells a crawler a gate is not the content, but may follow its links", () => {
    const meta = metaForGate("profile", "shariq", "/u/shariq");
    expect(meta.robots).toBe(GATE_ROBOTS);
    expect(meta.title).toContain("@shariq");
    expect(meta.description).toContain("Sign in");
  });
});

describe("schema.org nodes", () => {
  it("builds a Person with the fields the profile actually has", () => {
    const node = personLd(profile(), "https://web.xelvic.com/u/shariq");
    expect(node["@type"]).toBe("Person");
    expect(node["alternateName"]).toBe("@shariq");
    expect(JSON.stringify(node)).not.toContain("undefined");
  });

  it("builds a post with counters and a place", () => {
    const node = postLd(
      drop(),
      "https://web.xelvic.com/d/d1",
      "https://web.xelvic.com/u/shariq",
    );
    expect(node["@type"]).toBe("SocialMediaPosting");
    expect(node["keywords"]).toEqual(["morning"]);
    expect(node["locationCreated"]).toEqual({
      "@type": "Place",
      name: "Marine Drive",
      geo: { "@type": "GeoCoordinates", latitude: 18.943, longitude: 72.823 },
    });
    expect(JSON.stringify(node)).not.toContain("undefined");
  });

  it("builds a VideoObject with an ISO duration", () => {
    const node = videoLd(
      drop({
        kind: "vibe",
        asset: {
          id: "v1",
          kind: "video",
          content_url: "/media/vibes/v1.mp4",
          thumbnail_url: "/media/vibes/v1.jpg",
          duration_ms: 15_400,
        },
      }),
      "https://web.xelvic.com/v/d1",
      "https://web.xelvic.com/u/shariq",
    );
    expect(node["@type"]).toBe("VideoObject");
    expect(node["duration"]).toBe("PT15S");
  });
});

describe("text helpers", () => {
  it("truncates on a word boundary and adds an ellipsis", () => {
    const value = truncate("one two three four five six", 14);
    expect(value.endsWith("…")).toBe(true);
    expect(value.length).toBeLessThanOrEqual(15);
  });

  it("uses the first non-empty line as a post headline", () => {
    expect(postHeadline("\n\n  first line \nsecond", "fallback")).toBe("first line");
    expect(postHeadline("   ", "fallback")).toBe("fallback");
  });
});
