import { STORAGE_KEYS } from "@/constants/storage";
import type { AuthTokens } from "@/types/api";

const ACCESS_KEY = STORAGE_KEYS.accessToken;
const REFRESH_KEY = STORAGE_KEYS.refreshToken;

/**
 * A browser tab signs out when it closes, so the web app keeps its tokens in
 * sessionStorage. The installed desktop app is expected to stay signed in, the
 * way the phone does, so its preload marks the window and the tokens move to
 * localStorage there — and only there.
 */
function storage(): Storage | null {
  try {
    const desktop = typeof window !== "undefined" && Boolean(window.xelvicDesktop);
    // `globalThis` rather than `window` so tests (and any non-window worker)
    // can supply a storage object without a DOM.
    return desktop ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function read(key: string) {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    const store = storage();
    if (!store) return;
    if (value) store.setItem(key, value);
    else store.removeItem(key);
  } catch {
    // Storage can be disabled; the in-memory copy below still works.
  }
}

let accessToken: string | null = read(ACCESS_KEY);
let refreshToken: string | null = read(REFRESH_KEY);
let onExpire: (() => void) | null = null;

export const session = {
  access: () => accessToken,
  refresh: () => refreshToken,
  set(tokens: AuthTokens) {
    accessToken = tokens.access;
    refreshToken = tokens.refresh ?? refreshToken;
    write(ACCESS_KEY, accessToken);
    write(REFRESH_KEY, refreshToken);
  },
  setAccess(access: string) {
    accessToken = access;
    write(ACCESS_KEY, access);
  },
  setRefresh(refresh: string | null) {
    refreshToken = refresh;
    write(REFRESH_KEY, refresh);
  },
  clear() {
    accessToken = null;
    refreshToken = null;
    write(ACCESS_KEY, null);
    write(REFRESH_KEY, null);
  },
  onExpire(listener: (() => void) | null) {
    onExpire = listener;
  },
  expire() {
    session.clear();
    onExpire?.();
  },
};
