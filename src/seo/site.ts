import { mediaUrl } from "@/config/urls";
import { asset, mountedPath } from "@/utils/asset";

/**
 * The one place the public site says who it is.
 *
 * A crawler and a share sheet read different things — Google can run the page's
 * JavaScript, a WhatsApp or Facebook preview cannot — so every value here is
 * also read by the server-side meta injector described in
 * `docs/PUBLIC_CONTENT_AND_SEO.md`. Keep the names and the description stable
 * enough to be written into static HTML as well as into this app.
 */

export const SITE_NAME = "Xelvic";

/**
 * Where public links point.
 *
 * `VITE_WEB_URL` is the deployed origin (`https://xelvic.com`); the browser
 * origin is the fallback so a preview build still emits absolute URLs rather
 * than relative ones a crawler cannot resolve. The `/app` base is added by
 * [canonicalUrl], not here: an origin has no path.
 */
export const SITE_ORIGIN = (() => {
  // In a browser the address being served is the truth: a `.env.local` written
  // for local API work must not put `localhost` into a deployed page's
  // canonical address.
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  const configured = import.meta.env.VITE_WEB_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "https://xelvic.com";
})();

export const DEFAULT_TITLE = "Xelvic — share what you are looking at";
export const DEFAULT_DESCRIPTION =
  "Xelvic is where drops, moments, conversations, audio and live rooms meet. Share a post, a clip or a thought, and keep the room you keep.";
export const DEFAULT_IMAGE = `${SITE_ORIGIN}${asset("/xelvic.png")}`;
export const DEFAULT_LOCALE = "en_GB";
export const DEFAULT_THEME_COLOR = "#F7F7FB";

/** Public routes. One spelling each, so a shared link has one canonical form. */
export const PUBLIC_ROUTES = {
  profile: (username: string) => `/u/${encodeURIComponent(username)}`,
  drop: (id: string) => `/d/${encodeURIComponent(id)}`,
  vibe: (id: string) => `/v/${encodeURIComponent(id)}`,
} as const;

/**
 * An absolute, query-free canonical address for a public route.
 *
 * [path] is the router's own path (`/u/shariq`), with the base already stripped
 * by React Router. It goes back on here, because the public address of that
 * route is `https://xelvic.com/app/u/shariq` when the build is mounted under
 * `/app` and `https://xelvic.com/u/shariq` when it is at the root.
 */
export function canonicalUrl(path: string): string {
  const clean = (path.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  return `${SITE_ORIGIN}${mountedPath(clean)}`;
}

/**
 * A media address a crawler can fetch.
 *
 * Public content must hand back URLs that work without the account's token —
 * see the backend contract in `docs/PUBLIC_CONTENT_AND_SEO.md`. This resolves
 * relative API paths against the API origin; it does not add credentials.
 */
export function absoluteImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:)/i.test(url)) return url;
  return mediaUrl(url);
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** A post's headline: its first line, or a sentence about its author. */
export function postHeadline(body: string, fallback: string): string {
  const firstLine = body.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine ? truncate(firstLine, 110) : fallback;
}
