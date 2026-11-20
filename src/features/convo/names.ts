import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "@/constants/storage";
import { readMe } from "@/store/me";

type Book = Record<string, string>;

let book: Book | null = null;
let version = 0;
const listeners = new Set<() => void>();

function load(): Book {
  if (book) return book;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.names);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    book =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Book)
        : {};
  } catch {
    book = {};
  }
  return book;
}

function keep(next: Book) {
  book = next;
  version += 1;
  try {
    localStorage.setItem(STORAGE_KEYS.names, JSON.stringify(next));
  } catch {
    return;
  } finally {
    for (const listener of listeners) listener();
  }
}

function keysFor(id?: string | null, username?: string | null): string[] {
  const me = readMe()?.id;
  if (me == null || me === "") return [];
  const out: string[] = [];
  const person = (id ?? "").trim();
  if (person) out.push(`${me}|${person}`);
  const handle = (username ?? "").trim().toLowerCase();
  if (handle) out.push(`${me}|@${handle}`);
  return out;
}

export function aliasOf(id?: string | null, username?: string | null): string | null {
  const held = load();
  for (const key of keysFor(id, username)) {
    const name = held[key];
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

export function rememberName(
  id: string | number | null | undefined,
  username: string | null | undefined,
  name: string,
): void {
  const keys = keysFor(id == null ? "" : String(id), username);
  if (!keys.length) return;
  const next = { ...load() };
  const trimmed = name.trim();
  if (trimmed) {
    next[keys[0]] = trimmed;
    for (const stale of keys.slice(1)) delete next[stale];
  } else {
    for (const stale of keys) delete next[stale];
  }
  keep(next);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNames(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}