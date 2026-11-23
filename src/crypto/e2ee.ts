import { x25519 } from "@noble/curves/ed25519.js";
import api from "@/config/axios";
import { readMe } from "@/store/me";
import type { Message, Page } from "@/types/api";

export const ENVELOPE_VERSION = 1;
export const E2EE_SALT = "xelvic.e2ee.v1.salt.32.bytes!!!!";
export const SEAL_BUDGET_MS = 2000;

const E2EE_INFO = "xelvic.e2ee.v1";
const VAULT_PREFIX = "xelvic.e2ee.v1.";
const KEYS_FRESH_MS = 5 * 60 * 1000;
const OPENED_LIMIT = 400;

export interface EnvelopeKey {
  d: string;
  e: string;
  n: string;
  b: string;
  g: string;
}

export type Envelope = Record<string, unknown> & {
  v: number;
  n: string;
  c: string;
  m: string;
  k: EnvelopeKey[];
};

export interface DeviceKey {
  device: string;
  key: string;
}

export interface DeviceStore {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
}

export interface KeyClient {
  register: (device: string, publicKey: string) => Promise<void>;
  devices: (account: string) => Promise<DeviceKey[]>;
}

const browserStore: DeviceStore = {
  read(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      return;
    }
  },
};

const axiosClient: KeyClient = {
  async register(device, publicKey) {
    await api.put("/chat/keys/", { device, public_key: publicKey });
  },
  async devices(account) {
    const response = await api.get<{
      devices?: { device?: unknown; public_key?: unknown }[];
    }>("/chat/keys/", { params: { user: account } });
    return (response.data?.devices ?? [])
      .filter(
        (row) =>
          row &&
          String(row.device ?? "").length > 0 &&
          String(row.public_key ?? "").length > 0,
      )
      .map((row) => ({
        device: String(row.device),
        key: String(row.public_key),
      }));
  },
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type Bytes = Uint8Array<ArrayBuffer>;

function bytes(value: Uint8Array): Bytes {
  const out = new Uint8Array(value.length);
  out.set(value);
  return out;
}

function b64(input: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < input.length; index += 1) {
    binary += String.fromCharCode(input[index]);
  }
  return btoa(binary);
}

function fromB64(text: string): Bytes {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
}

function b64url(input: Uint8Array): string {
  return b64(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(count: number): Bytes {
  const out = new Uint8Array(count);
  crypto.getRandomValues(out);
  return out;
}

async function aesKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function sealBytes(
  plain: Bytes,
  key: Bytes,
  nonce: Bytes,
): Promise<{ cipher: Bytes; mac: Bytes }> {
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      await aesKey(key),
      plain,
    ),
  );
  return {
    cipher: sealed.slice(0, sealed.length - 16),
    mac: sealed.slice(sealed.length - 16),
  };
}

async function openBytes(
  cipher: Bytes,
  mac: Bytes,
  key: Bytes,
  nonce: Bytes,
): Promise<Bytes> {
  const joined = new Uint8Array(cipher.length + mac.length);
  joined.set(cipher, 0);
  joined.set(mac, cipher.length);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      await aesKey(key),
      joined,
    ),
  );
}

async function agreedKey(shared: Uint8Array): Promise<Bytes> {
  const material = await crypto.subtle.importKey(
    "raw",
    bytes(shared),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bytes(textEncoder.encode(E2EE_SALT)),
      info: bytes(textEncoder.encode(E2EE_INFO)),
    },
    material,
    256,
  );
  return new Uint8Array(bits);
}

function withBudget<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function sealedDocument(words: string): Record<string, unknown> | null {
  const trimmed = words.trimStart();
  if (!trimmed.startsWith("{")) return null;
  try {
    const decoded: unknown = JSON.parse(trimmed);
    if (
      decoded &&
      typeof decoded === "object" &&
      !Array.isArray(decoded) &&
      "b" in decoded
    ) {
      return decoded as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export class E2ee {
  private readonly store: DeviceStore;
  private readonly client: KeyClient;
  private readonly accountOf: () => string;

  private pair: Uint8Array | null = null;
  private pairAccount: string | null = null;
  private device: string | null = null;
  private registered: string | null = null;
  private publicCache: string | null = null;

  private readonly known = new Map<
    string,
    { devices: DeviceKey[]; at: number }
  >();
  private readonly opened = new Map<string, Message>();

  constructor(
    options: {
      store?: DeviceStore;
      client?: KeyClient;
      account?: () => string;
    } = {},
  ) {
    this.store = options.store ?? browserStore;
    this.client = options.client ?? axiosClient;
    this.accountOf =
      options.account ?? (() => String(readMe()?.id ?? ""));
  }

  private account(): string {
    return this.accountOf();
  }

  get deviceId(): string | null {
    return this.device;
  }

  async ensurePair(account: string): Promise<boolean> {
    if (!account) return false;
    if (this.pair && this.pairAccount === account) return true;
    this.pairAccount = account;
    this.publicCache = null;
    const held = this.store.read(VAULT_PREFIX + account);
    if (held) {
      try {
        const data = JSON.parse(held) as { s?: unknown; d?: unknown };
        const seed = fromB64(String(data.s ?? ""));
        const device = String(data.d ?? "");
        if (seed.length === 32 && device.length > 0) {
          this.pair = seed;
          this.device = device;
          return true;
        }
      } catch {
        this.pair = null;
        this.device = null;
      }
    }
    const seed = randomBytes(32);
    this.pair = seed;
    this.device = b64url(randomBytes(9));
    this.store.write(
      VAULT_PREFIX + account,
      JSON.stringify({ s: b64(seed), d: this.device }),
    );
    return true;
  }

  async publicKey(): Promise<string | null> {
    if (!(await this.ensurePair(this.account()))) return null;
    if (!this.pair) return null;
    if (this.publicCache) return this.publicCache;
    this.publicCache = b64(x25519.getPublicKey(this.pair));
    return this.publicCache;
  }

  async prepare(): Promise<boolean> {
    const account = this.account();
    if (!account) return false;
    if (!(await this.ensurePair(account))) return false;
    const publicKey = await this.publicKey();
    const device = this.device;
    if (!publicKey || !device) return false;
    const stamp = `${account}:${device}:${publicKey}`;
    if (this.registered === stamp) return true;
    try {
      await this.client.register(device, publicKey);
      this.registered = stamp;
      return true;
    } catch {
      return false;
    }
  }

  private async wrap(
    key: Bytes,
    publicKey: Uint8Array,
  ): Promise<Omit<EnvelopeKey, "d"> | null> {
    try {
      const ephemeral = randomBytes(32);
      const ephemeralPublic = x25519.getPublicKey(ephemeral);
      const shared = x25519.getSharedSecret(ephemeral, publicKey);
      const agreed = await agreedKey(shared);
      const nonce = randomBytes(12);
      const { cipher, mac } = await sealBytes(key, agreed, nonce);
      return {
        e: b64(ephemeralPublic),
        n: b64(nonce),
        b: b64(cipher),
        g: b64(mac),
      };
    } catch {
      return null;
    }
  }

  private async unwrap(entry: EnvelopeKey): Promise<Bytes | null> {
    const pair = this.pair;
    if (!pair) return null;
    try {
      const shared = x25519.getSharedSecret(pair, fromB64(String(entry.e)));
      const agreed = await agreedKey(shared);
      return await openBytes(
        fromB64(String(entry.b)),
        fromB64(String(entry.g)),
        agreed,
        fromB64(String(entry.n)),
      );
    } catch {
      return null;
    }
  }

  private async keysOf(account: string, fresh = false): Promise<DeviceKey[]> {
    const held = this.known.get(account);
    const now = Date.now();
    if (!fresh && held && now - held.at < KEYS_FRESH_MS) return held.devices;
    try {
      const devices = await this.client.devices(account);
      this.known.set(account, { devices, at: now });
      return devices;
    } catch {
      return [];
    }
  }

  async seal(
    plaintext: string,
    accounts: string[],
  ): Promise<Envelope | null> {
    try {
      return await withBudget(
        this.sealNow(plaintext, accounts),
        SEAL_BUDGET_MS,
      );
    } catch {
      return null;
    }
  }

  private async sealNow(
    plaintext: string,
    accounts: string[],
  ): Promise<Envelope | null> {
    if (!(await this.ensurePair(this.account()))) return null;
    const mine = this.device;
    if (!mine) return null;
    const audience = new Set<string>(accounts);
    audience.add(this.account());
    audience.delete("");
    const devices: DeviceKey[] = [];
    for (const account of audience) {
      const theirs = await this.keysOf(account);
      if (theirs.length === 0) return null;
      devices.push(...theirs);
    }
    if (devices.length === 0) return null;

    const content = randomBytes(32);
    const nonce = randomBytes(12);
    const { cipher, mac } = await sealBytes(
      bytes(textEncoder.encode(plaintext)),
      content,
      nonce,
    );

    const keys: EnvelopeKey[] = [];
    for (const device of devices) {
      const sealed = await this.wrap(content, fromB64(device.key));
      if (!sealed) return null;
      keys.push({ d: device.device, ...sealed });
    }
    return {
      v: ENVELOPE_VERSION,
      n: b64(nonce),
      c: b64(cipher),
      m: b64(mac),
      k: keys,
    };
  }

  async open(envelope: unknown): Promise<string | null> {
    const box = envelope as Envelope | null | undefined;
    if (!box || typeof box !== "object" || box.v !== ENVELOPE_VERSION)
      return null;
    if (!(await this.ensurePair(this.account()))) return null;
    const mine = this.device;
    if (!mine) return null;
    const entries = Array.isArray(box.k) ? box.k : [];
    const entry = entries.find(
      (one) => String((one as EnvelopeKey)?.d ?? "") === mine,
    );
    if (!entry) return null;
    try {
      const raw = await this.unwrap(entry);
      if (!raw) return null;
      const clear = await openBytes(
        fromB64(String(box.c)),
        fromB64(String(box.m)),
        raw,
        fromB64(String(box.n)),
      );
      return textDecoder.decode(clear);
    } catch {
      return null;
    }
  }

  async openWire(message: Message): Promise<Message> {
    const enc = message?.enc;
    if (!enc || typeof enc !== "object") return message;
    const words = await this.open(enc);
    if (words === null) {
      return { ...message, body: "", encrypted: true };
    }
    const doc = sealedDocument(words);
    if (doc === null) {
      return { ...message, body: words, encrypted: true };
    }
    const payload = { ...(message.payload ?? {}) };
    if (doc.f && typeof doc.f === "object") payload.e2ee_file = doc.f;
    if (doc.t && typeof doc.t === "object") payload.e2ee_thumb = doc.t;
    const next: Message = {
      ...message,
      body: String(doc.b ?? ""),
      encrypted: true,
    };
    if (Object.keys(payload).length > 0) next.payload = payload;
    return next;
  }

  async absorb(message: Message): Promise<Message> {
    void this.prepare().catch(() => undefined);
    if (!message || !message.enc) return message;
    const key = `${String(message.id)}:${String(
      message.revision ?? message.updated_at ?? "",
    )}`;
    const held = this.opened.get(key);
    if (held) return held;
    const opened = await this.openWire(message);
    if (this.opened.size >= OPENED_LIMIT) {
      const oldest = this.opened.keys().next().value;
      if (oldest !== undefined) this.opened.delete(oldest);
    }
    this.opened.set(key, opened);
    return opened;
  }
}

export const e2ee = new E2ee();

export async function openPage(
  page: Page<Message>,
  engine: E2ee = e2ee,
): Promise<Page<Message>> {
  if (!page?.results?.length) return page;
  const results = await Promise.all(page.results.map((one) => engine.absorb(one)));
  return { ...page, results };
}
