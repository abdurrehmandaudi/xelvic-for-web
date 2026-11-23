import { describe, expect, test } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";
import {
  E2ee,
  E2EE_SALT,
  openPage,
  type DeviceKey,
  type DeviceStore,
  type Envelope,
  type KeyClient,
} from "@/crypto/e2ee";
import type { Message, Page } from "@/types/api";

type Bytes = Uint8Array<ArrayBuffer>;

const INFO = new TextEncoder().encode("xelvic.e2ee.v1");
const SALT = new TextEncoder().encode(E2EE_SALT);

const THEM_SEED = fromHex(
  "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb",
);
const THEM_DEVICE = "dev-them";
const THEM_PUBLIC = copy(x25519.getPublicKey(THEM_SEED));

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

function hex(value: Uint8Array): string {
  return [...value].map((one) => one.toString(16).padStart(2, "0")).join("");
}

function fromB64(text: string): Bytes {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
}

function toB64(value: Uint8Array): string {
  let binary = "";
  for (const one of value) binary += String.fromCharCode(one);
  return btoa(binary);
}

function random(count: number): Bytes {
  const out = new Uint8Array(count);
  crypto.getRandomValues(out);
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Bytes> {
  const material = await crypto.subtle.importKey(
    "raw",
    copy(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", material, copy(data)),
  );
}

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Bytes> {
  const prk = await hmac(salt, ikm);
  const out = new Uint8Array(length);
  let previous = new Uint8Array(0);
  let block = 1;
  for (let offset = 0; offset < length; block += 1) {
    const message = new Uint8Array(previous.length + info.length + 1);
    message.set(previous, 0);
    message.set(info, previous.length);
    message[message.length - 1] = block;
    previous = await hmac(prk, message);
    const take = Math.min(previous.length, length - offset);
    out.set(previous.subarray(0, take), offset);
    offset += take;
  }
  return out;
}

function agreed(shared: Uint8Array): Promise<Bytes> {
  return hkdf(shared, SALT, INFO, 32);
}

async function aesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", copy(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function gcmSeal(key: Uint8Array, iv: Uint8Array, plain: Uint8Array) {
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: copy(iv), tagLength: 128 },
      await aesKey(key),
      copy(plain),
    ),
  );
  return {
    box: sealed.slice(0, sealed.length - 16),
    mac: sealed.slice(sealed.length - 16),
  };
}

async function gcmOpen(
  key: Uint8Array,
  iv: Uint8Array,
  box: Uint8Array,
  mac: Uint8Array,
): Promise<Bytes> {
  const joined = new Uint8Array(box.length + mac.length);
  joined.set(box, 0);
  joined.set(mac, box.length);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: copy(iv), tagLength: 128 },
      await aesKey(key),
      joined,
    ),
  );
}

class MemoryStore implements DeviceStore {
  held = new Map<string, string>();

  read(key: string): string | null {
    return this.held.get(key) ?? null;
  }

  write(key: string, value: string): void {
    this.held.set(key, value);
  }
}

function harness() {
  const registry = new Map<string, Map<string, string>>();
  const client = (account: string): KeyClient => ({
    async register(device: string, publicKey: string): Promise<void> {
      const rows = registry.get(account) ?? new Map<string, string>();
      rows.set(device, publicKey);
      registry.set(account, rows);
    },
    async devices(target: string): Promise<DeviceKey[]> {
      const rows = registry.get(target) ?? new Map<string, string>();
      return [...rows.entries()].map(([device, key]) => ({ device, key }));
    },
  });
  const phone = (account: string, store = new MemoryStore()) =>
    new E2ee({ store, client: client(account), account: () => account });
  return { phone, registry };
}

function fixedStore(
  account: string,
  seed: Uint8Array,
  device: string,
): MemoryStore {
  const store = new MemoryStore();
  store.write(
    `xelvic.e2ee.v1.${account}`,
    JSON.stringify({ s: toB64(seed), d: device }),
  );
  return store;
}

function bytesOf(base64: string): number {
  return atob(base64).length;
}

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "1",
    thread: "t1",
    kind: "text",
    body: "",
    sender: {
      id: "them",
      name: "Them",
      username: "them",
      avatar: null,
      initials: "T",
    },
    mine: false,
    created_at: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("e2ee", () => {
  test("a message sealed for two phones opens on both and nowhere else", async () => {
    const { phone } = harness();
    const sender = phone("me");
    const friend = phone("them");
    const otherPhone = phone("me");
    expect(await sender.prepare()).toBe(true);
    expect(await friend.prepare()).toBe(true);
    expect(await otherPhone.prepare()).toBe(true);

    const envelope = await sender.seal("milte hain 5 baje", ["them"]);
    expect(envelope).not.toBeNull();
    expect(JSON.stringify(envelope)).not.toContain("milte");

    expect(await friend.open(envelope)).toBe("milte hain 5 baje");
    expect(await otherPhone.open(envelope)).toBe("milte hain 5 baje");

    const stranger = phone("stranger");
    await stranger.prepare();
    expect(await stranger.open(envelope)).toBeNull();
  });

  test("a plaintext message is not an error — it is simply not for me", async () => {
    const { phone } = harness();
    const me = phone("me");
    await me.prepare();
    expect(await me.open(null)).toBeNull();
    expect(await me.open({})).toBeNull();
    expect(await me.open({ body: "purana message" })).toBeNull();
    expect(await me.open({ v: 2, k: [] })).toBeNull();
  });

  test("sealing is refused when the other side has no key yet", async () => {
    const { phone } = harness();
    const me = phone("me");
    await me.prepare();
    expect(await me.seal("hello", ["somebody-with-no-app"])).toBeNull();
  });

  test("a second launch keeps the same device and the same key", async () => {
    const { phone } = harness();
    const store = new MemoryStore();
    const first = phone("me", store);
    await first.prepare();
    const before = await first.publicKey();

    const again = phone("me", store);
    await again.prepare();
    expect(await again.publicKey()).toBe(before);
    expect(again.deviceId).toBe(first.deviceId);
  });

  test("every sealed message has a key for every device in the thread", async () => {
    const { phone } = harness();
    const me = phone("me");
    const mySecondPhone = phone("me");
    const them = phone("them");
    await me.prepare();
    await mySecondPhone.prepare();
    await them.prepare();

    const envelope = await me.seal("group ke liye", ["them"]);
    const devices = new Set((envelope?.k ?? []).map((row) => row.d));
    expect(devices.has(them.deviceId!)).toBe(true);
    expect(devices.has(mySecondPhone.deviceId!)).toBe(true);
    expect(devices.has(me.deviceId!)).toBe(true);
    expect(devices.size).toBe(3);
  });

  test("the envelope is the shape the phone writes", async () => {
    const { phone } = harness();
    const me = phone("me");
    const them = phone("them");
    await me.prepare();
    await them.prepare();

    const envelope = await me.seal("hello", ["them"]);
    expect(envelope).not.toBeNull();
    const box = envelope!;

    expect(box.v).toBe(1);
    expect(bytesOf(box.n)).toBe(12);
    expect(bytesOf(box.c)).toBe(5);
    expect(bytesOf(box.m)).toBe(16);
    expect(box.n).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(box.c).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(box.m).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);

    expect(box.k.length).toBe(2);
    for (const entry of box.k) {
      expect(entry.d).toMatch(/^[A-Za-z0-9_-]{12}$/);
      expect(entry.d).not.toContain("=");
      expect(bytesOf(entry.e)).toBe(32);
      expect(bytesOf(entry.n)).toBe(12);
      expect(bytesOf(entry.b)).toBe(32);
      expect(bytesOf(entry.g)).toBe(16);
    }
  });

  test("the public key registered on the server is 32 bytes of base64", async () => {
    const { phone, registry } = harness();
    const me = phone("me");
    await me.prepare();
    const rows = registry.get("me")!;
    const registered = rows.get(me.deviceId!);
    expect(registered).toBeDefined();
    expect(bytesOf(registered!)).toBe(32);
    expect(await me.publicKey()).toBe(registered);
  });

  test("openWire leaves the box and says encrypted when it cannot be opened", async () => {
    const { phone } = harness();
    const me = phone("me");
    const them = phone("them");
    await me.prepare();
    await them.prepare();

    const envelope = await me.seal("dost", ["them"]);
    const stranger = phone("stranger");
    await stranger.prepare();

    const mine = await them.openWire(message({ enc: envelope }));
    expect(mine.body).toBe("dost");
    expect(mine.encrypted).toBe(true);

    const theirs = await stranger.openWire(message({ enc: envelope }));
    expect(theirs.body).toBe("");
    expect(theirs.encrypted).toBe(true);
    expect(theirs.enc).toBe(envelope);
  });

  test("a message that was never sealed comes back untouched", async () => {
    const { phone } = harness();
    const me = phone("me");
    await me.prepare();
    const plain = message({ body: "plain" });
    expect(await me.openWire(plain)).toBe(plain);
  });

  test("absorb opens a row exactly once", async () => {
    const { phone } = harness();
    const me = phone("me");
    const them = phone("them");
    await me.prepare();
    await them.prepare();
    const envelope = await me.seal("ek baar", ["them"]);
    const raw = message({ enc: envelope });

    const first = await them.absorb(raw);
    const second = await them.absorb({ ...raw });
    expect(first.body).toBe("ek baar");
    expect(second).toBe(first);
  });

  test("a sealed document keeps its words and its keys", async () => {
    const { phone } = harness();
    const me = phone("me");
    const them = phone("them");
    await me.prepare();
    await them.prepare();
    const doc = JSON.stringify({ b: "dekho", f: { k: "a" }, t: { k: "b" } });
    const envelope = await me.seal(doc, ["them"]);
    const opened = await them.openWire(message({ enc: envelope, kind: "image" }));
    expect(opened.body).toBe("dekho");
    expect(opened.payload?.e2ee_file).toEqual({ k: "a" });
    expect(opened.payload?.e2ee_thumb).toEqual({ k: "b" });
  });

  test("openPage opens every row on a page", async () => {
    const { phone } = harness();
    const me = phone("me");
    const them = phone("them");
    await me.prepare();
    await them.prepare();
    const a = await me.seal("one", ["them"]);
    const b = await me.seal("two", ["them"]);
    const page: Page<Message> = {
      results: [message({ id: "a", enc: a }), message({ id: "b", enc: b })],
      next: null,
    };
    const opened = await openPage(page, them);
    expect(opened.results.map((row) => row.body)).toEqual(["one", "two"]);
    expect(opened.next).toBeNull();
  });

  test("the key agreement is the RFC 7748 one", () => {
    const a = fromHex(
      "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a",
    );
    const b = fromHex(
      "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb",
    );
    expect(hex(x25519.getPublicKey(a))).toBe(
      "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a",
    );
    expect(hex(x25519.getPublicKey(b))).toBe(
      "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f",
    );
    expect(hex(x25519.getSharedSecret(a, x25519.getPublicKey(b)))).toBe(
      "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742",
    );
  });

  test("an envelope another implementation wrote opens here", async () => {
    const { phone } = harness();
    const them = phone("them", fixedStore("them", THEM_SEED, THEM_DEVICE));
    expect(await them.publicKey()).toBe(toB64(THEM_PUBLIC));

    const content = random(32);
    const contentIv = random(12);
    const words = "phone se bheja";
    const { box: cipher, mac } = await gcmSeal(
      content,
      contentIv,
      new TextEncoder().encode(words),
    );

    const ephemeral = random(32);
    const shared = x25519.getSharedSecret(ephemeral, THEM_PUBLIC);
    const wrapIv = random(12);
    const wrapped = await gcmSeal(await agreed(shared), wrapIv, content);
    const envelope: Envelope = {
      v: 1,
      n: toB64(contentIv),
      c: toB64(cipher),
      m: toB64(mac),
      k: [
        {
          d: THEM_DEVICE,
          e: toB64(x25519.getPublicKey(ephemeral)),
          n: toB64(wrapIv),
          b: toB64(wrapped.box),
          g: toB64(wrapped.mac),
        },
      ],
    };

    expect(await them.open(envelope)).toBe(words);
  });

  test("an envelope written here opens under another implementation", async () => {
    const { phone } = harness();
    const me = phone("me");
    const them = phone("them", fixedStore("them", THEM_SEED, THEM_DEVICE));
    await me.prepare();
    await them.prepare();

    const words = "web se bheja";
    const envelope = (await me.seal(words, ["them"]))!;
    const entry = envelope.k.find((row) => row.d === THEM_DEVICE)!;

    const shared = x25519.getSharedSecret(THEM_SEED, fromB64(entry.e));
    const content = await gcmOpen(
      await agreed(shared),
      fromB64(entry.n),
      fromB64(entry.b),
      fromB64(entry.g),
    );
    const clear = await gcmOpen(
      content,
      fromB64(envelope.n),
      fromB64(envelope.c),
      fromB64(envelope.m),
    );
    expect(new TextDecoder().decode(clear)).toBe(words);
  });
});
