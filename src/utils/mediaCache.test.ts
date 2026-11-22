import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaUrl } from "@/config/urls";

/**
 * The disk copy of media, tested where it can actually be wrong.
 *
 * The bytes in this app are read with an `Authorization` header, which the
 * browser's HTTP cache ignores — so `Cache Storage` is the only thing standing
 * between a reload and every picture in the feed being downloaded again. The
 * two ways that can go wrong are worth a test: handing one account's file to
 * another, and keeping a collection of clips until the quota refuses.
 */

const ACCOUNT_ID = 7;
const PICTURE = "https://api.xelvic.com/media/drops/a.jpg";
const CLIP = "https://api.xelvic.com/media/drops/b.mp4";
const CDN_COVER = "https://cdn.xelvic.com/covers/a.png";
// A serializer signs private byte routes per file when the deployment keeps
// its bytes in a bucket. The signature is the permission; there is no XHR to
// make, and making one is what broke every picture on the deployed web client.
const SIGNED_PICTURE =
  "https://api.xelvic.com/api/v1/drops/drops/1/thumbnail/?s=abc.def";

class MemoryStorage {
  private map = new Map<string, string>();

  getItem(key: string) {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }

  removeItem(key: string) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

/** As much of a `Cache` as `mediaCache` asks for: put, match, keys, delete. */
class MemoryCache {
  private entries = new Map<string, Response>();

  get size() {
    return this.entries.size;
  }

  async match(url: string) {
    return this.entries.get(url)?.clone();
  }

  async put(url: string, response: Response) {
    this.entries.set(url, response);
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async delete(request: Request | string) {
    const url = typeof request === "string" ? request : request.url;
    return this.entries.delete(url);
  }
}

class MemoryCacheStorage {
  readonly opened = new Map<string, MemoryCache>();

  async open(name: string) {
    let cache = this.opened.get(name);
    if (!cache) {
      cache = new MemoryCache();
      this.opened.set(name, cache);
    }
    return cache;
  }

  async keys() {
    return [...this.opened.keys()];
  }

  async delete(name: string) {
    return this.opened.delete(name);
  }
}

function install(account: number | null = ACCOUNT_ID) {
  const storage = new MemoryStorage();
  vi.stubGlobal("sessionStorage", storage);
  if (account !== null) {
    storage.setItem(
      "xelvic.me",
      JSON.stringify({ id: account, username: "me", name: "Me" }),
    );
  }
  const caches = new MemoryCacheStorage();
  vi.stubGlobal("caches", caches);
  return { storage, caches };
}

/** A fresh module graph, after the globals it reads at call time exist. */
async function load() {
  vi.resetModules();
  return import("@/utils/mediaCache");
}

function file(text: string, type: string) {
  return new Blob([text], { type });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the media disk cache", () => {
  it("keeps a file per account and hands it back", async () => {
    const { caches } = install();
    const { rememberMedia, storedMedia } = await load();

    await rememberMedia(PICTURE, file("jpeg-bytes", "image/jpeg"));
    const back = await storedMedia(PICTURE);

    expect(caches.opened.has(`xelvic-media-${ACCOUNT_ID}`)).toBe(true);
    expect(back).not.toBeNull();
    expect(await back!.text()).toBe("jpeg-bytes");
    expect(back!.type).toBe("image/jpeg");
  });

  it("misses when the file was never kept", async () => {
    install();
    const { storedMedia } = await load();

    expect(await storedMedia(CLIP)).toBeNull();
  });

  it("does not offer one account's file to another", async () => {
    const { storage, caches } = install();
    const { rememberMedia, storedMedia } = await load();
    await rememberMedia(PICTURE, file("jpeg-bytes", "image/jpeg"));

    // The same tab, signed in as somebody else: a different cache, so nothing
    // from the account before it can be drawn.
    storage.setItem("xelvic.me", JSON.stringify({ id: 8, username: "other", name: "Other" }));

    expect(await storedMedia(PICTURE)).toBeNull();
    expect(caches.opened.has("xelvic-media-8")).toBe(true);
  });

  it("refuses a file too large to keep", async () => {
    const { caches } = install();
    const { STORE_MAX_BYTES, rememberMedia, storedMedia } = await load();

    // One byte over the cap, without holding that many bytes to say so.
    const over = { size: STORE_MAX_BYTES + 1, type: "video/mp4" } as Blob;
    await rememberMedia(CLIP, over);

    expect(await storedMedia(CLIP)).toBeNull();
    expect(caches.opened.get(`xelvic-media-${ACCOUNT_ID}`)?.size ?? 0).toBe(0);
  });

  it("forgets every account's files when the session ends", async () => {
    const { storage, caches } = install();
    const { rememberMedia, storedMedia, clearMediaCache } = await load();
    await rememberMedia(PICTURE, file("jpeg-bytes", "image/jpeg"));
    // A second account that used this browser earlier, still on disk.
    storage.setItem("xelvic.me", JSON.stringify({ id: 8, username: "other", name: "Other" }));
    await rememberMedia(CLIP, file("mp4-bytes", "video/mp4"));
    expect(caches.opened.size).toBe(2);

    await clearMediaCache();

    expect(await caches.keys()).toEqual([]);
    expect(await storedMedia(PICTURE)).toBeNull();
  });

  it("warms a convo's files off the disk, and leaves other addresses alone", async () => {
    install();
    const { peekMedia, rememberMedia, warmMedia } = await load();
    // Kept under the address the reader will ask for, which is the one the
    // app's own arithmetic makes of it.
    await rememberMedia(mediaUrl(PICTURE)!, file("jpeg-bytes", "image/jpeg"));

    warmMedia([PICTURE, CDN_COVER, null]);

    await vi.waitFor(() => expect(peekMedia(PICTURE)).not.toBeNull());
    expect(peekMedia(CDN_COVER)).toBeNull();
  });

  it("warms no more files than it was told to", async () => {
    install();
    const { peekMedia, rememberMedia, warmMedia } = await load();
    await rememberMedia(mediaUrl(PICTURE)!, file("jpeg-bytes", "image/jpeg"));
    await rememberMedia(mediaUrl(CLIP)!, file("mp4-bytes", "video/mp4"));

    warmMedia([PICTURE, CLIP], 1);

    await vi.waitFor(() => expect(peekMedia(PICTURE)).not.toBeNull());
    expect(peekMedia(CLIP)).toBeNull();
  });

  it("hands a signed private address to the element instead of fetching it", async () => {
    install();
    const { entryFor } = await load();

    // Resolving is the whole assertion: the unsigned path below this one would
    // try a network read, and this test has no server. A signed address is its
    // own permission, so the cache returns it (resolved to the API origin) and
    // keeps the signature that makes it one.
    const resolved = mediaUrl(SIGNED_PICTURE)!;
    expect(resolved).toContain("?s=abc.def");
    await expect(entryFor(SIGNED_PICTURE).promise).resolves.toBe(resolved);
  });

  it("does nothing when the browser has no Cache Storage", async () => {
    install();
    vi.stubGlobal("caches", undefined);
    const { rememberMedia, storedMedia, clearMediaCache } = await load();

    await expect(rememberMedia(PICTURE, file("jpeg-bytes", "image/jpeg"))).resolves.toBeUndefined();
    expect(await storedMedia(PICTURE)).toBeNull();
    await expect(clearMediaCache()).resolves.toBeUndefined();
  });
});