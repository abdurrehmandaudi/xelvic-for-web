/**
 * A path to a file this build ships.
 *
 * The web client is served at the site root — `https://xelvic.com/` — so its
 * own files and its router's paths are already absolute and need no prefix.
 * This helper stays because everything that draws one of the build's own
 * pictures or builds one of its own links already goes through it, and the
 * desktop and visionOS builds share the same source with the same root base.
 *
 * A server address is left exactly as it is: anything with a scheme, a
 * protocol-relative `//host`, or a path that is already relative belongs to
 * somebody else (or to the route that is asking) and is not the build's to
 * move.
 */
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export function asset(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return `${BASE}${path}`;
}

/** The same rule for a picture a design may or may not name. */
export function optionalAsset<T extends string | null | undefined>(path: T): T {
  return (path ? asset(path) : path) as T;
}

/**
 * A path inside this build's router.
 *
 * Pass the router's own path (`/d/1`, `/live/1`), not
 * `window.location.pathname`; at the root base this is the address the browser
 * asks for. It is kept separate from [asset] so a future mount point would be
 * one variable rather than an inventory of links, but the deployed web build
 * has no mount point: `xelvic.com/drops/…`, `xelvic.com/profile/shariq`.
 */
export function mountedPath(path: string): string {
  return asset(path);
}
