import { STORAGE_KEYS } from "@/constants/storage";
import type { AuthTokens } from "@/types/api";

const ACCESS_KEY = STORAGE_KEYS.accessToken;
const REFRESH_KEY = STORAGE_KEYS.refreshToken;

/**
 * A signed-in browser **stays signed in**, the way the phone and the installed
 * desktop app do.
 *
 * It used to be sessionStorage for the browser — closing the tab signed the
 * person out — and the owner hit exactly that on 2026-11-22: *"xelvic.com/
 * signin agar login hai to redirect kar de, har baar is link pe jaao to login
 * ho ja raha."* A returning person now keeps the session across visits, so the
 * sign-in page's `PublicOnly` redirect sends them straight into the app.
 *
 * The sessionStorage copy from before the change is migrated on first read, so
 * a person who was signed in when this shipped is not signed out by it.
 */
function storage(): Storage | null {
  try {
    // `globalThis` rather than `window` so tests (and any non-window worker)
    // can supply a storage object without a DOM.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The tab-scoped store this used before; read only to migrate it. */
function legacyStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function read(key: string) {
  try {
    const live = storage()?.getItem(key) ?? null;
    if (live) return live;
    const legacy = legacyStorage()?.getItem(key) ?? null;
    if (legacy) {
      // A session from the older, tab-scoped store: carry it over once and
      // clear it there, so both stores cannot disagree later.
      storage()?.setItem(key, legacy);
      legacyStorage()?.removeItem(key);
    }
    return legacy;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    const store = storage();
    if (!store) return;
    if (value) store.setItem(key, value);
    else {
      store.removeItem(key);
      legacyStorage()?.removeItem(key);
    }
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
