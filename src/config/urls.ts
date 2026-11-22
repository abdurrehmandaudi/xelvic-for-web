/**
 * Address arithmetic, with no requests in it.
 *
 * These three helpers used to live beside the fetch wrapper in `src/lib/api.ts`.
 * They never fetched anything — they only decide what a string should look like
 * — so when the requests moved to `services/*` these moved here rather than
 * into a service, where they would have looked like calls that do nothing.
 */

import { API_BASE, API_ORIGIN } from "@/config/env";

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** A page's own address back to the API's, for a cursor the server handed out. */
export function apiPathFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const base = new URL(`${API_BASE}/`);
    const parsed = new URL(url, base);
    const prefix = base.pathname.replace(/\/$/, "");
    const path = parsed.pathname.startsWith(prefix) ? parsed.pathname.slice(prefix.length) : parsed.pathname;
    return `${path || "/"}${parsed.search}`;
  } catch {
    return url;
  }
}

const BACKEND_MEDIA_PATH = /^\/(?:api|media|ws)(?:\/|$)/;

/** True when the bytes behind an address need this account's credentials. */
export function isBackendMediaPath(pathname: string): boolean {
  return BACKEND_MEDIA_PATH.test(pathname);
}

/**
 * Whether an address is its own permission — a signed media address.
 *
 * Private byte routes are signed per file (`?s=<media token>`) by the server's
 * serializers when the deployment keeps its bytes in a bucket, and a bucket's
 * own address carries `X-Amz-Signature`. Those are read by a browser element
 * directly, and an `Authorization` header on the same request is not merely
 * unnecessary: a presigned bucket address refuses two authentication
 * mechanisms at once, and the API's 302 to the bucket crosses an origin the
 * bucket answers no CORS headers for. A public CDN address is the same answer
 * for the same reason — it was never private.
 *
 * An unsigned backend address is not signed, so it still needs the account's
 * token through `mediaService`.
 */
export function isSignedMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, API_ORIGIN);
    if (!isBackendMediaPath(parsed.pathname)) return true;
    return parsed.searchParams.has("s") || parsed.searchParams.has("X-Amz-Signature");
  } catch {
    return false;
  }
}

/**
 * An absolute address for a media URL the server sent.
 *
 * A CDN address is handed back untouched, because an `<img>` a CDN will serve
 * is a picture, while the same address read through a request is a cross-origin
 * call the CDN answers no CORS headers for.
 */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(data:|blob:)/i.test(url)) return url;
  try {
    const parsed = new URL(url, API_ORIGIN);
    if (isBackendMediaPath(parsed.pathname)) {
      return `${API_ORIGIN}${parsed.pathname}${parsed.search}`;
    }
    if (/^(https?:)/i.test(url)) return url;
    return `${API_ORIGIN}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
