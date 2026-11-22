/**
 * A path to a file this build ships, under whatever base it was built for.
 *
 * The same source is served at the root in development and under `/app/`
 * beside the marketing site. Vite rewrites everything it can see — imported
 * assets and the references in `index.html` — but a string written as
 * `"/themes/x.png"` is just a string to it, and at `/app/` the browser would
 * ask the marketing site's host for a file the marketing site has never had.
 * Everything this build serves itself goes through here, so moving the app is
 * still one build-time variable and not an inventory of paths.
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
