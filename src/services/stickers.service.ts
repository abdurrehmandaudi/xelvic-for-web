import api from "@/config/axios";
import type { Sticker } from "@/types/api";

/** One pack the catalogue groups its stickers into — `apps/stickers`. */
export interface StickerPack {
  id: string | number;
  name: string;
  slug: string;
  count?: number;
}

/**
 * Our sticker service — the shelf the phone actually draws from.
 *
 * The app reads its stickers from here first and only falls back to our own
 * `/api/v1/stickers/` when this refuses (`app/lib/editor/stickers.dart`). The
 * two shelves are not the same list: this one is the catalogue stickers are
 * added to now and it holds several times what our own server does, which is
 * why a picker reading only the server showed a different, smaller set than the
 * phone's did.
 *
 * It is a public, token-free read — a catalogue of pictures — and it answers
 * with `access-control-allow-origin: *`, so a browser can ask it directly. No
 * part of the session goes with the request.
 */
export const STICKER_SERVICE = "https://sticker.gaongram.in/api";

/** How many stickers one ask brings back. The service's own ceiling. */
const PAGE = 100;

/**
 * How many one shelf is willing to read.
 *
 * The owner counts over a thousand. Ten pages is that, and it is a ceiling
 * rather than a target: a page shorter than the one asked for ends the walk,
 * and a shelf that grows past this is still searched by what came back.
 */
const SHELF = 1000;

/**
 * One sticker as a picker draws it, whichever shelf it came off.
 *
 * `words` is what a search matches against — the name, the tags and the name of
 * the shelf — because the service has no text search of its own: it filters by
 * shelf and by tag, and somebody typing "cat" means either.
 */
export interface ShelfSticker {
  id: string;
  name: string;
  url: string;
  kind: StickerKind;
  /** The shelf it came off, as that catalogue names it. */
  pack: string;
  packName: string;
  words: string;
}

export type StickerKind = "gif" | "sticker";

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function kindOf(row: Record<string, unknown>, fallback: StickerKind): StickerKind {
  const said = `${text(row.kind)} ${text(row.type)}`.toLowerCase();
  if (said.includes("gif")) return "gif";
  if (said.includes("sticker")) return "sticker";
  return fallback;
}

/** One row of the sticker service's answer: `pack` is an object and there are `tags`. */
export function shelfRowFromService(
  raw: unknown,
  kind: StickerKind = "sticker",
): ShelfSticker | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const url = text(row.url);
  const id = text(row.id);
  if (!url || !id) return null;
  const pack = row.pack && typeof row.pack === "object" ? (row.pack as Record<string, unknown>) : {};
  const tags = (Array.isArray(row.tags) ? row.tags : [])
    .map((tag) => text(tag))
    .filter((tag) => tag.length > 0);
  const packName = text(pack.name).trim();
  // The name is what the chat line falls back to saying, so it is the first
  // tag — "batman", "smile-3" — or the shelf's name when it has none.
  const name = tags.length ? tags[0] : packName;
  return {
    id,
    name,
    url,
    kind: kindOf(row, kind),
    pack: text(pack.id),
    packName,
    words: [name, packName, ...tags].join(" ").toLowerCase(),
  };
}

/** One row of our own server's shelf, which is a different shape: flat, no tags. */
export function shelfRowFromOwn(raw: Sticker): ShelfSticker | null {
  const url = text(raw.url);
  if (!url) return null;
  const name = text(raw.name);
  // The server's own words: the name, its comma-separated `keywords` column and
  // the shelf it is filed under. A list is read too, because a serializer that
  // ever sends one should not turn into stickers nobody can find.
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.join(" ")
    : text(raw.keywords);
  const pack = text(raw.pack);
  return {
    id: text(raw.id),
    name,
    url,
    kind: "sticker",
    pack,
    packName: "",
    words: [name, keywords, pack].join(" ").toLowerCase(),
  };
}

/**
 * The shelf, once it has been read, and whether the service has refused.
 *
 * Kept for the session exactly as the phone keeps it: a picker is opened many
 * times and the catalogue is the same list each time. Refusing is remembered
 * too — a search box that waits on a host that is down is a search box that
 * hangs on every keystroke — so every ask after the first failure takes the
 * near road straight away.
 */
let shelfCache: ShelfSticker[] | null = null;
let shelfPending: Promise<ShelfSticker[]> | null = null;
let serviceDown = false;
let shelfSink: ((rows: ShelfSticker[]) => void) | null = null;

const SHELF_KEY = "xelvic.stickers.shelf.v2";

function usableShelf(rows: unknown): ShelfSticker[] | null {
  if (!Array.isArray(rows)) return null;
  const list = rows.filter(
    (row): row is ShelfSticker =>
      Boolean(
        row &&
          typeof row === "object" &&
          typeof (row as ShelfSticker).id === "string" &&
          typeof (row as ShelfSticker).url === "string" &&
          (row as ShelfSticker).url,
      ),
  );
  return list.length ? list : null;
}

function keptShelf(): ShelfSticker[] | null {
  if (shelfCache) return shelfCache;
  try {
    const raw = sessionStorage.getItem(SHELF_KEY);
    if (!raw) return null;
    const rows = usableShelf(JSON.parse(raw));
    if (rows) shelfCache = rows;
    return rows;
  } catch {
    return null;
  }
}

function keepShelf(rows: ShelfSticker[]) {
  shelfCache = rows;
  try {
    sessionStorage.setItem(SHELF_KEY, JSON.stringify(rows));
  } catch {
    // A full or refused store still leaves the tab's own copy standing.
  }
}

/** One half of the house's shelf, read a page at a time until it runs out. */
async function askHalf(kind: StickerKind): Promise<ShelfSticker[]> {
  const shelf = kind === "gif" ? "gifs" : "stickers";
  const rows: ShelfSticker[] = [];
  let offset = 0;
  while (offset < SHELF) {
    const response = await fetch(
      `${STICKER_SERVICE}/${shelf}?limit=${PAGE}&offset=${offset}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`${response.status} from the sticker service`);
    }
    const answer: unknown = await response.json();
    const page = Array.isArray(answer)
      ? answer
      : ((answer as { data?: unknown } | null)?.data ?? []);
    const list = Array.isArray(page) ? page : [];
    for (const raw of list) {
      const row = shelfRowFromService(raw, kind);
      if (row) rows.push(row);
    }
    offset += PAGE;
    if (list.length < PAGE) break;
    const matched = Number((answer as { matched?: unknown } | null)?.matched);
    if (Number.isFinite(matched) && matched > 0 && offset >= matched) break;
  }
  return rows;
}

async function askService(
  onPage?: (rows: ShelfSticker[]) => void,
): Promise<ShelfSticker[]> {
  const rows: ShelfSticker[] = [];
  for (const kind of ["gif", "sticker"] as const) {
    try {
      const half = await askHalf(kind);
      rows.push(...half);
      if (rows.length) onPage?.(rows.slice());
    } catch {
      continue;
    }
  }
  if (!rows.length) throw new Error("the sticker service answered nothing");
  return rows;
}

async function askOwnServer(): Promise<ShelfSticker[]> {
  const response = await api.get<{ stickers?: Sticker[] }>("/stickers/");
  const rows = Array.isArray(response.data?.stickers) ? response.data.stickers : [];
  return rows
    .map(shelfRowFromOwn)
    .filter((row): row is ShelfSticker => Boolean(row));
}

/**
 * What a search matches.
 *
 * Every word typed has to land somewhere, so a second word narrows the shelf
 * instead of widening it — the app's own rule, kept here so the sheet and the
 * phone cannot drift apart on what "cat hat" means.
 */
const SAVED_KEY = "xelvic.stickers.saved.v1";
const RECENT_KEY = "xelvic.stickers.recent.v1";
const KEPT_ROWS = 60;

function readRows(key: string): ShelfSticker[] {
  try {
    const raw = localStorage.getItem(key);
    return usableShelf(raw ? JSON.parse(raw) : null) ?? [];
  } catch {
    return [];
  }
}

function writeRows(key: string, rows: ShelfSticker[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(rows.slice(0, KEPT_ROWS)));
  } catch {
    return;
  }
}

export function siftShelf(
  rows: readonly ShelfSticker[],
  query: string,
  pack = "",
): ShelfSticker[] {
  const wanted = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  return rows.filter(
    (row) =>
      (pack === "" || row.pack === pack) &&
      wanted.every((word) => row.words.includes(word)),
  );
}

const PREVIEW_WIDTH = 160;

const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//;

export function shelfPreview(row: ShelfSticker): string {
  if (row.kind !== "gif") return row.url;
  const store = row.url.match(CLOUDINARY);
  if (!store) return row.url;
  const rest = row.url.slice(store[0].length);
  const cut = rest.indexOf("/");
  if (cut < 0) return row.url;
  const step = rest.slice(0, cut);
  if (step.startsWith("s--")) return row.url;
  if (/^v\d+$/.test(step)) {
    return `${store[0]}w_${PREVIEW_WIDTH},c_limit/${rest}`;
  }
  const tuned = step.replace(/(^|,)w_\d+(?=,|$)/, `$1w_${PREVIEW_WIDTH}`);
  if (tuned === step) return row.url;
  return `${store[0]}${tuned}/${rest.slice(cut + 1)}`;
}

/**
 * The shelves those stickers came off, in the order the catalogue lists them.
 *
 * Built from the stickers themselves rather than from a pack list, so a chip
 * can never lead to an empty grid: a shelf with nothing on it is not offered.
 */
export function shelvesOf(
  rows: readonly ShelfSticker[],
): { id: string; name: string; count: number }[] {
  const order: string[] = [];
  const names = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.pack) continue;
    if (!counts.has(row.pack)) {
      order.push(row.pack);
      names.set(row.pack, row.packName);
    }
    counts.set(row.pack, (counts.get(row.pack) ?? 0) + 1);
  }
  return order.map((id) => ({
    id,
    name: names.get(id) ?? "",
    count: counts.get(id) ?? 0,
  }));
}

/**
 * Stickers.
 *
 * Two roads, and `list` and `shelf` are deliberately different asks rather than
 * one with a flag:
 *
 * - `shelf` is a picker's shelf — the service's, which is where the stickers
 *   live now, falling back to our own server when it refuses. A sticker picked
 *   off it travels as its own `{id, url, name}`, so the shelf it came off does
 *   not matter to the server that stores the message.
 * - `list` is our own server's shelf and only that. It is what a *comment* on a
 *   drop has to read, because a comment sends the id back and our server can
 *   only check the stickers it has a row for (`_comment_sticker()` in the drops
 *   service). An id from the sticker service is not one of those, and would
 *   come back "That sticker is not available" — or match an unrelated row with
 *   the same number.
 */
export const stickersService = {
  /** Every sticker on the shelf, from wherever the shelf is being read. */
  shelf: async (
    onRows?: (rows: ShelfSticker[]) => void,
  ): Promise<ShelfSticker[]> => {
    if (onRows) shelfSink = onRows;
    const kept = keptShelf();
    if (kept) {
      shelfSink?.(kept);
      return kept;
    }
    const running = shelfPending;
    if (running) return running;
    shelfPending = (async () => {
      if (!serviceDown) {
        try {
          const rows = await askService((page) => shelfSink?.(page));
          if (rows.length) {
            keepShelf(rows);
            return rows;
          }
          // An empty answer is a refusal like any other: the near road is the
          // one that at least has something on it.
          serviceDown = true;
        } catch {
          serviceDown = true;
        }
      }
      const rows = await askOwnServer();
      // Only a shelf with something on it is kept. Caching an empty one would
      // pin a picker with no stickers in it for the rest of the session over
      // what was a moment's bad connection.
      if (rows.length) {
        keepShelf(rows);
        shelfSink?.(rows);
      }
      return rows;
    })().finally(() => {
      shelfPending = null;
      shelfSink = null;
    });
    return shelfPending;
  },

  /** Every sticker on our own shelf, and nothing else. See the note above. */
  list: async <T = { stickers: Sticker[] }>(): Promise<T> => {
    const response = await api.get<T>("/stickers/");
    return response.data;
  },

  /** The packs those stickers came in. */
  packs: async (): Promise<{ packs: StickerPack[] }> => {
    const response = await api.get<{ packs: StickerPack[] }>("/stickers/packs/");
    return response.data;
  },

  /** The pictures this browser has starred, newest first. */
  saved: (): ShelfSticker[] => readRows(SAVED_KEY),

  /** The pictures this browser has sent into a convo, newest first. */
  recent: (): ShelfSticker[] => readRows(RECENT_KEY),

  /** Star a picture, or take the star off. Answers whether it is starred now. */
  star: (row: ShelfSticker): boolean => {
    const held = readRows(SAVED_KEY);
    const at = held.findIndex((one) => one.url === row.url);
    const next = at >= 0 ? held.filter((_, index) => index !== at) : [row, ...held];
    writeRows(SAVED_KEY, next);
    return at < 0;
  },

  /** Remember a picture that was sent, for the history shelf. */
  noteSent: (row: ShelfSticker): void => {
    const held = readRows(RECENT_KEY).filter((one) => one.url !== row.url);
    writeRows(RECENT_KEY, [row, ...held]);
  },

  /** A door for tests: forget the shelf, so the next ask reads it again. */
  forget: (): void => {
    shelfCache = null;
    shelfPending = null;
    shelfSink = null;
    serviceDown = false;
    try {
      sessionStorage.removeItem(SHELF_KEY);
    } catch {
      // Nothing stored, nothing to forget.
    }
  },
};

export default stickersService;
