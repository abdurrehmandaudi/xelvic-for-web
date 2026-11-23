#!/usr/bin/env node
/**
 * Builds `public/sitemap.xml` from the public content the API is willing to
 * enumerate.
 *
 * A browser cannot list every public profile, drop and vibe; the API can. The
 * contract this reads is in `docs/PUBLIC_CONTENT_AND_SEO.md`:
 *
 *   GET <SITEMAP_API>  →  { urls: [{ loc, lastmod }], next }   (or an array)
 *
 * `next` is followed until it is null. Only canonical public paths are kept:
 * `/u/…`, `/d/…`, `/v/…`, `/s/…`. Anything else — an app route, a media URL, a
 * private post — is dropped rather than published by accident.
 *
 * Environment:
 *   SITEMAP_API          endpoint to read (default: `/api/v1/public/sitemap`)
 *   SITEMAP_PAGES_FILE   read a JSON array from disk instead (tests/exports)
 *   SITE_ORIGIN          public origin (default: https://xelvic.com)
 *   SITEMAP_OUT          output file (default: public/sitemap.xml)
 *
 * Sitemaps are limited to 50,000 URLs / 50 MB each. Past that this writes a
 * sitemap index and numbered files beside `SITEMAP_OUT`.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// `xelvic.com` is the live origin; `web.xelvic.com` was retired and now
// answers 301. A sitemap that names a redirecting host wastes the crawl.
const SITE_ORIGIN = (process.env.SITE_ORIGIN || "https://xelvic.com").replace(/\/+$/, "");
const SITEMAP_API =
  process.env.SITEMAP_API || "https://api.xelvic.com/api/v1/public/sitemap";
const OUT = process.env.SITEMAP_OUT || path.resolve("public/sitemap.xml");
const PAGES_FILE = process.env.SITEMAP_PAGES_FILE;

/** Google's own ceiling. A sitemap index is used past this. */
const MAX_URLS = 50_000;
const PUBLIC_PREFIXES = ["/u/", "/d/", "/v/", "/s/"];

function absoluteOrigin() {
  return SITE_ORIGIN;
}

function normalise(item, origin) {
  if (!item) return null;

  const raw =
    typeof item === "string"
      ? item
      : item.loc ?? item.url ?? item.path ?? null;
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw, `${origin}/`);
  } catch {
    return null;
  }

  // One public origin only. A sitemap must not point at staging, a CDN or an
  // app scheme, even if the API hands one back.
  if (url.origin !== origin) return null;
  if (!PUBLIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return null;
  if (url.search || url.hash) return null;
  if (/\/\.{1,2}(\/|$)/.test(url.pathname)) return null;

  const loc = `${origin}${url.pathname.replace(/\/+$/, "")}`;
  const stamp =
    typeof item === "object" ? item.lastmod ?? item.updated_at ?? item.updatedAt : null;
  const lastmod =
    typeof stamp === "string" && !Number.isNaN(Date.parse(stamp))
      ? new Date(stamp).toISOString()
      : null;

  return { loc, lastmod };
}

async function readFromFile(file) {
  const body = JSON.parse(await readFile(file, "utf8"));
  return Array.isArray(body) ? body : body.urls ?? body.results ?? [];
}

async function readFromApi(origin) {
  const rows = [];
  let next = SITEMAP_API;
  let guard = 0;

  while (next && guard < 500) {
    guard += 1;
    const target = new URL(next, `${origin}/`).toString();
    const response = await fetch(target, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `The sitemap endpoint answered ${response.status}. ` +
          `It must serve public URLs anonymously — see docs/PUBLIC_CONTENT_AND_SEO.md.`,
      );
    }
    const body = await response.json();
    if (Array.isArray(body)) return [...rows, ...body];
    rows.push(...(body.urls ?? body.results ?? []));
    next = body.next ?? null;
  }

  return rows;
}

function dedupe(rows) {
  const byLoc = new Map();
  for (const row of rows) {
    if (!row) continue;
    const current = byLoc.get(row.loc);
    if (!current || (row.lastmod && row.lastmod > (current.lastmod ?? ""))) {
      byLoc.set(row.loc, row);
    }
  }
  return [...byLoc.values()].sort((a, b) => a.loc.localeCompare(b.loc));
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(row) {
  return [
    "  <url>",
    `    <loc>${escapeXml(row.loc)}</loc>`,
    row.lastmod ? `    <lastmod>${escapeXml(row.lastmod)}</lastmod>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

function sitemapDocument(rows) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows.map(urlEntry),
    "</urlset>",
    "",
  ].join("\n");
}

function sitemapIndexDocument(locs) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locs.map((loc) => `  <sitemap><loc>${escapeXml(loc)}</loc></sitemap>`),
    "</sitemapindex>",
    "",
  ].join("\n");
}

async function main() {
  const origin = absoluteOrigin();
  const raw = PAGES_FILE
    ? await readFromFile(PAGES_FILE)
    : await readFromApi(origin);

  const landing = { loc: `${origin}/`, lastmod: null };
  const publicRows = dedupe(
    raw
      .map((item) => normalise(item, origin))
      .filter((row) => row !== null),
  );
  const rows = [landing, ...publicRows];

  await mkdir(path.dirname(OUT), { recursive: true });

  if (rows.length <= MAX_URLS) {
    await writeFile(OUT, sitemapDocument(rows), "utf8");
    console.log(`sitemap: ${rows.length} URLs → ${OUT}`);
    return;
  }

  // More than one sitemap is allowed; Google asks for an index past 50k.
  const chunks = [];
  for (let index = 0; index < rows.length; index += MAX_URLS) {
    chunks.push(rows.slice(index, index + MAX_URLS));
  }

  const base = OUT.replace(/\.xml$/i, "");
  const indexLocs = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const file = `${base}-${index + 1}.xml`;
    await writeFile(file, sitemapDocument(chunks[index]), "utf8");
    indexLocs.push(`${origin}/${path.basename(file)}`);
  }
  await writeFile(OUT.replace(/\.xml$/i, "-index.xml"), sitemapIndexDocument(indexLocs), "utf8");
  console.log(`sitemap: ${rows.length} URLs in ${chunks.length} files → ${base}-index.xml`);
}

main().catch((error) => {
  console.error(`sitemap: ${error.message}`);
  process.exitCode = 1;
});
