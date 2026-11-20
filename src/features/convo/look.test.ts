import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  } as Storage;
}

async function fresh(storage: Storage = fakeStorage()) {
  vi.resetModules();
  vi.stubGlobal("localStorage", storage);
  return { storage, look: await import("./look") };
}

const PHOTO = "data:image/jpeg;base64,AAAA";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("own convo wallpaper", () => {
  it("has nothing for a convo nobody gave a photo", async () => {
    const { look } = await fresh();
    expect(look.ownWallOf("thread-a")).toBeNull();
  });

  it("keeps a photo and hands it straight back", async () => {
    const { look, storage } = await fresh();
    expect(look.setOwnWall("thread-a", PHOTO)).toBe(true);
    expect(look.ownWallOf("thread-a")).toEqual({
      src: PHOTO,
      opacity: look.OWN_WALL_OPACITY,
    });
    expect(storage.getItem("convo_wallpaper_thread-a")).toContain(PHOTO);
  });

  it("ignores a row a reload cannot draw", async () => {
    const storage = fakeStorage();
    storage.setItem(
      "convo_wallpaper_thread-a",
      JSON.stringify({ preview: "blob:http://localhost/1234", opacity: 0.5 }),
    );
    const { look } = await fresh(storage);
    expect(look.ownWallOf("thread-a")).toBeNull();
  });

  it("takes the opacity it was given, held between nothing and everything", async () => {
    const { look } = await fresh();
    look.setOwnWall("thread-a", PHOTO, 0.4);
    expect(look.ownWallOf("thread-a")?.opacity).toBe(0.4);
    look.setOwnWallOpacity("thread-a", 2);
    expect(look.ownWallOf("thread-a")?.opacity).toBe(1);
    look.setOwnWallOpacity("thread-a", -1);
    expect(look.ownWallOf("thread-a")?.opacity).toBe(0);
  });

  it("writes an opacity once the slider stops, not on every step", async () => {
    const { look, storage } = await fresh();
    look.setOwnWall("thread-a", PHOTO, 0.8);
    look.setOwnWallOpacity("thread-a", 0.6);
    look.setOwnWallOpacity("thread-a", 0.4);
    expect(JSON.parse(storage.getItem("convo_wallpaper_thread-a") ?? "{}").opacity).toBe(0.8);
    vi.advanceTimersByTime(200);
    expect(JSON.parse(storage.getItem("convo_wallpaper_thread-a") ?? "{}").opacity).toBe(0.4);
  });

  it("clears the photo and its row", async () => {
    const { look, storage } = await fresh();
    look.setOwnWall("thread-a", PHOTO);
    look.clearOwnWall("thread-a");
    expect(look.ownWallOf("thread-a")).toBeNull();
    expect(storage.getItem("convo_wallpaper_thread-a")).toBeNull();
  });

  it("still shows a photo the browser would not keep", async () => {
    const storage = fakeStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const { look } = await fresh(storage);
    expect(look.setOwnWall("thread-a", PHOTO)).toBe(false);
    expect(look.ownWallOf("thread-a")?.src).toBe(PHOTO);
  });
});