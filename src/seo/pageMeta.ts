import type { Drop, Profile } from "@/types/api";
import {
  absoluteImage,
  canonicalUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
  DEFAULT_LOCALE,
  DEFAULT_TITLE,
  postHeadline,
  PUBLIC_ROUTES,
  SITE_NAME,
  truncate,
} from "./site";
import {
  breadcrumbLd,
  personLd,
  postLd,
  profilePageLd,
  videoLd,
} from "./structured";

/**
 * What a page tells a crawler and a share sheet.
 *
 * This is deliberately a plain data type: the hook applies it to the document,
 * and the server-side injector in `docs/PUBLIC_CONTENT_AND_SEO.md` reads the
 * same fields. A page that cannot fetch its subject (a signed-out visitor, a
 * private account, a deleted drop) still describes *itself* honestly and asks
 * the crawler not to index the gate as if it were the content.
 */

export interface GeoMeta {
  placename?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

export interface PageMeta {
  title: string;
  description?: string;
  /** App path, e.g. `/u/shariq`. Canonical is built from `SITE_ORIGIN`. */
  path?: string;
  image?: string | null;
  imageAlt?: string;
  type?: "website" | "profile" | "article" | "video.other";
  robots?: string;
  locale?: string;
  publishedTime?: string;
  profileUsername?: string;
  geo?: GeoMeta;
  jsonLd?: Record<string, unknown>[];
}

/** A page that should be found. */
export const INDEX = "index, follow, max-image-preview:large";
/** A page behind the account, or the private half of one. */
export const NOINDEX = "noindex, nofollow";
/** A gate: not the content, but its links are still worth following. */
export const GATE_ROBOTS = "noindex, follow";

export function metaForSignIn(): PageMeta {
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/signin",
    image: DEFAULT_IMAGE,
    type: "website",
    robots: INDEX,
    locale: DEFAULT_LOCALE,
    // The landing page's Organization/WebSite graph is already static in
    // `index.html`, so this page does not add a second copy.
  };
}

/** Somebody's public page. */
export function metaForProfile(profile: Profile, path = PUBLIC_ROUTES.profile(profile.username)): PageMeta {
  const url = canonicalUrl(path);
  const name = profile.name || profile.username;
  const isPublic = profile.is_private !== true && profile.can_view !== false;
  const place =
    typeof profile.professional?.location === "string"
      ? profile.professional.location.trim()
      : "";
  return {
    title: `${name} (@${profile.username}) on ${SITE_NAME}`,
    description: profile.bio
      ? truncate(profile.bio, 160)
      : `Drops, vibes and moments from @${profile.username} on ${SITE_NAME}.`,
    path,
    image: absoluteImage(profile.avatar) ?? DEFAULT_IMAGE,
    imageAlt: `${name}'s profile picture`,
    type: "profile",
    robots: isPublic ? INDEX : NOINDEX,
    locale: DEFAULT_LOCALE,
    profileUsername: profile.username,
    geo: place ? { placename: place } : undefined,
    jsonLd: isPublic ? [personLd(profile, url), profilePageLd(profile, url)] : [personLd(profile, url)],
  };
}

/** A private account whose name may be shown, but whose things may not. */
export function metaForPrivateProfile(
  profile: Profile,
  path = PUBLIC_ROUTES.profile(profile.username),
): PageMeta {
  const name = profile.name || profile.username;
  return {
    title: `${name} (@${profile.username}) on ${SITE_NAME}`,
    description: `@${profile.username} is private on ${SITE_NAME}. Sign in and follow to see their drops, vibes and moments.`,
    path,
    image: absoluteImage(profile.avatar) ?? DEFAULT_IMAGE,
    imageAlt: `${name}'s profile picture`,
    type: "profile",
    robots: NOINDEX,
    locale: DEFAULT_LOCALE,
    profileUsername: profile.username,
  };
}

/** A post or a clip, by whichever base it lives on. */
export function metaForDrop(
  drop: Drop,
  path: string,
  kind: "drop" | "vibe" = "drop",
): PageMeta {
  const url = canonicalUrl(path);
  const authorUrl = canonicalUrl(PUBLIC_ROUTES.profile(drop.author.username));
  const authorName = drop.author.name || drop.author.username;
  const isVideo = kind === "vibe" || drop.kind === "video";
  const image =
    absoluteImage(drop.asset?.thumbnail_url ?? drop.asset?.content_url) ??
    absoluteImage(drop.author.avatar) ??
    DEFAULT_IMAGE;
  const title = postHeadline(
    drop.body,
    isVideo ? `A vibe by ${authorName}` : `A drop by ${authorName}`,
  );
  const description = drop.body
    ? truncate(drop.body, 160)
    : `${authorName} shared ${isVideo ? "a vibe" : "a drop"} on ${SITE_NAME}.`;
  const authorPrivate = drop.author.is_private === true;
  return {
    title: `${title} · ${SITE_NAME}`,
    description,
    path,
    image,
    imageAlt: drop.asset?.original_name
      ? `${drop.asset.original_name} — shared by ${authorName}`
      : `${authorName} on ${SITE_NAME}`,
    type: isVideo ? "video.other" : "article",
    robots: authorPrivate ? NOINDEX : INDEX,
    locale: DEFAULT_LOCALE,
    publishedTime: drop.created_at,
    geo:
      drop.place || typeof drop.place_latitude === "number"
        ? {
            placename: drop.place,
            region: drop.place_region ?? undefined,
            latitude:
              typeof drop.place_latitude === "number" ? drop.place_latitude : undefined,
            longitude:
              typeof drop.place_longitude === "number" ? drop.place_longitude : undefined,
          }
        : undefined,
    jsonLd: [
      isVideo ? videoLd(drop, url, authorUrl) : postLd(drop, url, authorUrl),
      breadcrumbLd([
        { name: SITE_NAME, url: canonicalUrl("/") },
        { name: `@${drop.author.username}`, url: authorUrl },
        { name: isVideo ? "Vibe" : "Drop", url },
      ]),
    ].filter((node) => Object.keys(node).length > 0),
  };
}

/** The sign-in door a stranger sees in place of the content. */
export function metaForGate(
  kind: "profile" | "drop" | "vibe",
  subject: string,
  path: string,
): PageMeta {
  const noun = kind === "profile" ? "profile" : kind === "vibe" ? "vibe" : "drop";
  // A profile is known by its handle; a post is not known by its id, and an id
  // in a title is noise in a search result.
  const title =
    kind === "profile" ? `@${subject} on ${SITE_NAME}` : `A ${noun} on ${SITE_NAME}`;
  return {
    title,
    description: `Sign in to ${SITE_NAME} to see this ${noun}.`,
    path,
    image: DEFAULT_IMAGE,
    type: "website",
    robots: GATE_ROBOTS,
    locale: DEFAULT_LOCALE,
  };
}
