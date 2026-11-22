import { useEffect } from "react";
import {
  absoluteImage,
  canonicalUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
  DEFAULT_THEME_COLOR,
  SITE_NAME,
} from "./site";
import { INDEX, type PageMeta } from "./pageMeta";

/**
 * Applies a page's metadata to the document.
 *
 * The app is a client-rendered SPA, so this is the half a browser can do: Google
 * runs the JavaScript and reads these tags, and a person sharing the address
 * from the app copies the canonical one. The other half — the HTML a social
 * crawler receives before any JavaScript runs — is the server-side injector
 * described in `docs/PUBLIC_CONTENT_AND_SEO.md`; it must emit the same values
 * from the same `PageMeta` builders.
 *
 * Each call replaces the tags the previous page set, so a stale `geo.position`
 * from one drop cannot describe the next. Tags that already exist in
 * `index.html` are updated in place rather than duplicated.
 */

const MARK = "data-xelvic-seo";
const SCRIPT_MARK = "data-xelvic-jsonld";

function findMeta(attribute: "name" | "property", key: string): HTMLMetaElement | null {
  for (const node of Array.from(document.head.querySelectorAll("meta"))) {
    if (node.getAttribute(attribute) === key) return node;
  }
  return null;
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  const existing = findMeta(attribute, key);
  const node = existing ?? document.createElement("meta");
  if (!existing) {
    node.setAttribute(attribute, key);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
  node.setAttribute(MARK, "");
  return `${attribute}:${key}`;
}

function canonicalLink(): HTMLLinkElement {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const node = existing ?? document.createElement("link");
  if (!existing) {
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute(MARK, "");
  return node;
}

export function applyPageMeta(meta: PageMeta): void {
  if (typeof document === "undefined") return;

  const title = meta.title.includes(SITE_NAME) ? meta.title : `${meta.title} · ${SITE_NAME}`;
  document.title = title;
  document.documentElement.lang = "en";

  const path = meta.path ?? "/";
  const canonical = canonicalUrl(path);
  const description = meta.description || DEFAULT_DESCRIPTION;
  const image = meta.image === null ? null : absoluteImage(meta.image) ?? DEFAULT_IMAGE;
  const type = meta.type ?? "website";
  const robots = meta.robots ?? INDEX;

  const wanted = new Set<string>();
  wanted.add(upsertMeta("name", "application-name", SITE_NAME));
  wanted.add(upsertMeta("name", "description", description));
  wanted.add(upsertMeta("name", "robots", robots));
  wanted.add(upsertMeta("name", "theme-color", DEFAULT_THEME_COLOR));
  wanted.add(upsertMeta("property", "og:site_name", SITE_NAME));
  wanted.add(upsertMeta("property", "og:title", title));
  wanted.add(upsertMeta("property", "og:description", description));
  wanted.add(upsertMeta("property", "og:url", canonical));
  wanted.add(upsertMeta("property", "og:type", type));
  wanted.add(upsertMeta("property", "og:locale", meta.locale ?? "en_GB"));
  wanted.add(upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary"));
  wanted.add(upsertMeta("name", "twitter:title", title));
  wanted.add(upsertMeta("name", "twitter:description", description));

  if (image) {
    wanted.add(upsertMeta("property", "og:image", image));
    wanted.add(upsertMeta("name", "twitter:image", image));
    if (meta.imageAlt) {
      wanted.add(upsertMeta("property", "og:image:alt", meta.imageAlt));
      wanted.add(upsertMeta("name", "twitter:image:alt", meta.imageAlt));
    }
  }
  if (meta.publishedTime) {
    wanted.add(upsertMeta("property", "article:published_time", meta.publishedTime));
  }
  if (meta.profileUsername) {
    wanted.add(upsertMeta("property", "profile:username", meta.profileUsername));
  }
  if (meta.geo?.placename) {
    wanted.add(upsertMeta("name", "geo.placename", meta.geo.placename));
  }
  if (meta.geo?.region) {
    wanted.add(upsertMeta("name", "geo.region", meta.geo.region));
  }
  if (
    typeof meta.geo?.latitude === "number" &&
    typeof meta.geo?.longitude === "number"
  ) {
    const { latitude, longitude } = meta.geo;
    wanted.add(upsertMeta("name", "geo.position", `${latitude};${longitude}`));
    wanted.add(upsertMeta("name", "ICBM", `${latitude}, ${longitude}`));
  }

  // Anything this module set for the previous page and this page does not want.
  for (const node of Array.from(document.head.querySelectorAll(`meta[${MARK}]`))) {
    const attribute = node.hasAttribute("name") ? "name" : "property";
    const key = node.getAttribute(attribute) ?? "";
    const id = `${attribute}:${key}`;
    if (!wanted.has(id)) node.remove();
  }

  canonicalLink().setAttribute("href", canonical);

  for (const node of Array.from(document.head.querySelectorAll(`script[${SCRIPT_MARK}]`))) {
    node.remove();
  }
  if (meta.jsonLd && meta.jsonLd.length > 0) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute(SCRIPT_MARK, "");
    // `<` is escaped so a caption cannot close the script element early.
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": meta.jsonLd,
    }).replace(/</g, "\\u003c");
    document.head.appendChild(script);
  }
}

/** Applies the metadata for as long as this page is mounted (and its data is current). */
export function usePageMeta(meta: PageMeta): void {
  const signature = JSON.stringify(meta);
  useEffect(() => {
    applyPageMeta(JSON.parse(signature) as PageMeta);
  }, [signature]);
}
