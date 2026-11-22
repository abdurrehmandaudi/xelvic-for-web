import type { Drop, Profile } from "@/types/api";
import {
  absoluteImage,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
  postHeadline,
  SITE_NAME,
  SITE_ORIGIN,
  truncate,
} from "./site";

/**
 * schema.org for the things a public page can be.
 *
 * Google reads these to understand *what* a page is — a person, a post, a clip
 * — instead of only what it says. Only facts the server already sent are put
 * in; a field that is absent stays absent rather than being guessed.
 */

type Node = Record<string, unknown>;

function clean(node: Node): Node {
  const kept: Node = {};
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    kept[key] = value;
  }
  return kept;
}

function counters(drop: Drop): Node[] {
  const rows: Node[] = [];
  if (typeof drop.likes === "number") {
    rows.push({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/LikeAction",
      userInteractionCount: drop.likes,
    });
  }
  if (typeof drop.comments === "number") {
    rows.push({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: drop.comments,
    });
  }
  if (typeof drop.shares === "number") {
    rows.push({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/ShareAction",
      userInteractionCount: drop.shares,
    });
  }
  return rows;
}

export function organizationLd(): Node {
  return clean({
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: DEFAULT_IMAGE,
    description: DEFAULT_DESCRIPTION,
  });
}

export function websiteLd(): Node {
  return clean({
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    description: DEFAULT_DESCRIPTION,
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    inLanguage: "en",
  });
}

export function personLd(profile: Profile, url: string): Node {
  const followers = profile.followers_count;
  return clean({
    "@type": "Person",
    "@id": `${url}#person`,
    name: profile.name || profile.username,
    alternateName: `@${profile.username}`,
    identifier: profile.username,
    description: profile.bio ? truncate(profile.bio, 300) : undefined,
    image: absoluteImage(profile.avatar) ?? undefined,
    url,
    interactionStatistic:
      typeof followers === "number"
        ? [
            {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/FollowAction",
              userInteractionCount: followers,
            },
          ]
        : undefined,
  });
}

export function profilePageLd(profile: Profile, url: string): Node {
  return clean({
    "@type": "ProfilePage",
    "@id": `${url}#profile`,
    url,
    name: `${profile.name || profile.username} (@${profile.username}) on ${SITE_NAME}`,
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    mainEntity: { "@id": `${url}#person` },
  });
}

export function postLd(drop: Drop, url: string, authorUrl: string): Node {
  const image = absoluteImage(drop.asset?.thumbnail_url ?? drop.asset?.content_url);
  const coordinates =
    typeof drop.place_latitude === "number" && typeof drop.place_longitude === "number"
      ? {
          "@type": "GeoCoordinates",
          latitude: drop.place_latitude,
          longitude: drop.place_longitude,
        }
      : undefined;
  return clean({
    "@type": "SocialMediaPosting",
    "@id": `${url}#post`,
    url,
    mainEntityOfPage: url,
    headline: postHeadline(drop.body, `A drop by ${drop.author.name || drop.author.username}`),
    articleBody: drop.body ? truncate(drop.body, 1_000) : undefined,
    datePublished: drop.created_at || undefined,
    author: {
      "@type": "Person",
      name: drop.author.name || drop.author.username,
      alternateName: `@${drop.author.username}`,
      url: authorUrl,
      image: absoluteImage(drop.author.avatar) ?? undefined,
    },
    image: image ?? undefined,
    keywords: drop.tag ? [drop.tag.replace(/^#/, "")] : undefined,
    locationCreated:
      drop.place || coordinates
        ? clean({
            "@type": "Place",
            name: drop.place,
            geo: coordinates,
          })
        : undefined,
    interactionStatistic: counters(drop),
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
  });
}

export function videoLd(drop: Drop, url: string, authorUrl: string): Node {
  const duration =
    typeof drop.asset?.duration_ms === "number" && drop.asset.duration_ms > 0
      ? `PT${Math.max(1, Math.round(drop.asset.duration_ms / 1_000))}S`
      : undefined;
  return clean({
    "@type": "VideoObject",
    "@id": `${url}#video`,
    url,
    mainEntityOfPage: url,
    name: postHeadline(drop.body, `A vibe by ${drop.author.name || drop.author.username}`),
    description: drop.body ? truncate(drop.body, 1_000) : undefined,
    thumbnailUrl: absoluteImage(drop.asset?.thumbnail_url ?? drop.asset?.content_url) ?? undefined,
    uploadDate: drop.created_at || undefined,
    duration,
    author: {
      "@type": "Person",
      name: drop.author.name || drop.author.username,
      alternateName: `@${drop.author.username}`,
      url: authorUrl,
    },
    interactionStatistic: counters(drop),
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
  });
}

export function breadcrumbLd(items: { name: string; url: string }[]): Node {
  return clean({
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  });
}
