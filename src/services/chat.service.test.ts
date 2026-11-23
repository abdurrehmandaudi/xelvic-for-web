import { beforeEach, describe, expect, test, vi } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";
import {
  E2ee,
  type DeviceKey,
  type DeviceStore,
  type Envelope,
  type KeyClient,
} from "@/crypto/e2ee";
import type { Message } from "@/types/api";

const { api, registry } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
  registry: new Map<string, { device: string; key: string }[]>(),
}));

vi.mock("@/config/axios", () => ({ default: api }));
vi.mock("@/store/me", () => ({ readMe: () => ({ id: "me" }) }));

type Bytes = Uint8Array<ArrayBuffer>;

function copy(value: Uint8Array): Bytes {
  const out = new Uint8Array(value.length);
  out.set(value);
  return out;
}

function fromHex(text: string): Bytes {
  const out = new Uint8Array(text.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = parseInt(text.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

function toB64(value: Uint8Array): string {
  let binary = "";
  for (const one of value) binary += String.fromCharCode(one);
  return btoa(binary);
}

const THEM_SEED = fromHex(
  "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb",
);
const THEM_DEVICE = "them-device1";
const THEM_PUBLIC = copy(x25519.getPublicKey(THEM_SEED));

class MemoryStorage {
  private held = new Map<string, string>();

  getItem(key: string): string | null {
    return this.held.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.held.set(key, value);
  }

  removeItem(key: string): void {
    this.held.delete(key);
  }
}

class MemoryStore implements DeviceStore {
  private held = new Map<string, string>();

  read(key: string): string | null {
    return this.held.get(key) ?? null;
  }

  write(key: string, value: string): void {
    this.held.set(key, value);
  }
}

function recipient(): E2ee {
  const store = new MemoryStore();
  store.write(
    "xelvic.e2ee.v1.them",
    JSON.stringify({ s: toB64(THEM_SEED), d: THEM_DEVICE }),
  );
  const client: KeyClient = {
    async register(): Promise<void> {
      return;
    },
    async devices(): Promise<DeviceKey[]> {
      return [];
    },
  };
  return new E2ee({ store, client, account: () => "them" });
}

function sentBox(): { enc?: Envelope; body: string } {
  const call = api.post.mock.calls.at(-1);
  const payload = (call?.[1] as { payload?: { enc?: Envelope; body?: string } })
    ?.payload;
  return { enc: payload?.enc, body: String(payload?.body ?? "") };
}

let storage: MemoryStorage;

beforeEach(() => {
  vi.resetModules();
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.patch.mockReset();
  registry.clear();
  registry.set("them", [{ device: THEM_DEVICE, key: toB64(THEM_PUBLIC) }]);
  api.put.mockImplementation((_url: string, body: { device: string; public_key: string }) => {
    const rows = registry.get("me") ?? [];
    if (!rows.some((row) => row.device === body.device)) {
      rows.push({ device: body.device, key: body.public_key });
    }
    registry.set("me", rows);
    return Promise.resolve({ data: {} });
  });
  api.get.mockImplementation((_url: string, config?: { params?: { user?: string } }) => {
    const rows = registry.get(config?.params?.user ?? "") ?? [];
    return Promise.resolve({
      data: { devices: rows.map((row) => ({ device: row.device, public_key: row.key })) },
    });
  });
  api.post.mockResolvedValue({
    data: {
      replayed: false,
      result: {
        message: {
          id: "srv-1",
          thread: "t1",
          kind: "text",
          body: "",
          sender: {
            id: "me",
            name: "Me",
            username: "me",
            avatar: null,
            initials: "M",
          },
          mine: true,
          created_at: "2026-11-23T00:00:00.000Z",
        } satisfies Message,
      },
    },
  });
  api.patch.mockResolvedValue({ data: {} });
});

async function loadChat(warm = true) {
  const mod = await import("@/services/chat.service");
  if (warm) {
    const { e2ee } = await import("@/crypto/e2ee");
    await e2ee.prepare();
  }
  return mod.chatService;
}

describe("chatService sealed sends", () => {
  test("a sealed send carries no words the server can read, and round trips", async () => {
    const chatService = await loadChat();
    await chatService.send("t1", {
      kind: "text",
      body: "milte hain 5 baje",
      audience: ["them"],
      client_id: "c-round",
    });
    const { enc, body } = sentBox();
    expect(enc).toBeTruthy();
    expect(body).toBe("");
    expect(JSON.stringify(enc)).not.toContain("milte");
    expect(await recipient().open(enc)).toBe("milte hain 5 baje");
  });

  test("a retry after a reload reuses the very same envelope bytes", async () => {
    const chatService = await loadChat();
    await chatService.send("t1", {
      kind: "text",
      body: "pehla",
      audience: ["them"],
      client_id: "c-retry",
    });
    const first = sentBox().enc;
    expect(first).toBeTruthy();

    vi.resetModules();
    const afterReload = await loadChat(false);
    await afterReload.send("t1", {
      kind: "text",
      body: "dusra",
      audience: ["them"],
      client_id: "c-retry",
    });
    const again = sentBox().enc;
    expect(again).toEqual(first);
  });
});

describe("chatService sealed edits", () => {
  test("editing a sealed line sends the box and never the clear words", async () => {
    const chatService = await loadChat();
    await chatService.edit("t1", "m1", "badla hua text", {
      audience: ["them"],
      sealed: true,
    });
    const call = api.patch.mock.calls.at(-1);
    expect(String(call?.[0])).toContain("/messages/m1/");
    const data = call?.[1] as { body?: string; enc?: Envelope };
    expect(data.body).toBe("");
    expect(data.enc).toBeTruthy();
    expect(JSON.stringify(data)).not.toContain("badla");
    expect(await recipient().open(data.enc)).toBe("badla hua text");
  });

  test("a sealed edit refuses rather than downgrading when no audience is known", async () => {
    const chatService = await loadChat();
    await expect(
      chatService.edit("t1", "m1", "plain fallback", { sealed: true }),
    ).rejects.toThrow(/sealed/i);
    expect(api.patch).not.toHaveBeenCalled();
  });

  test("a sealed edit refuses rather than downgrading when the other side has no key", async () => {
    registry.delete("them");
    const chatService = await loadChat();
    await expect(
      chatService.edit("t1", "m1", "plain fallback", {
        audience: ["them"],
        sealed: true,
      }),
    ).rejects.toThrow(/sealed/i);
    expect(api.patch).not.toHaveBeenCalled();
  });

  test("an ordinary edit still sends its words in the body", async () => {
    const chatService = await loadChat();
    await chatService.edit("t1", "m1", "plain edit");
    const data = api.patch.mock.calls.at(-1)?.[1] as { body?: string };
    expect(data.body).toBe("plain edit");
    expect(data).not.toHaveProperty("enc");
  });
});
